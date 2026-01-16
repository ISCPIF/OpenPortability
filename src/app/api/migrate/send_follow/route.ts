import { NextRequest, NextResponse } from 'next/server'
import { BlueskyService } from '@/lib/services/blueskyServices'
import { MastodonService } from '@/lib/services/mastodonService'
import { AccountService } from '@/lib/services/accountService'
import { BlueskyRepository } from '@/lib/repositories/blueskyRepository'
import { MatchingService } from '@/lib/services/matchingService'
import { MatchingTarget, MatchedFollower } from '@/lib/types/matching'
import logger from '@/lib/log_utils'
import { withValidation } from '@/lib/validation/middleware'
import { SendFollowRequestSchema, MatchingAccountSchema } from '@/lib/validation/schemas'
import { z } from 'zod'
import { StatsRepository } from '@/lib/repositories/statsRepository'
import { checkRateLimit, consumeRateLimit } from '@/lib/services/rateLimitService'
import { pgMatchingRepository } from '@/lib/repositories/public/pg-matching-repository'
import { publishFollowingStatusUpdate } from '@/lib/sse-publisher'

// Use the schema-inferred type to match the incoming payload shape
type AccountToFollow = z.infer<typeof MatchingAccountSchema>;

// Type guard: treat as MatchedFollower when a string source_twitter_id is present
function isMatchedFollower(account: AccountToFollow): account is MatchedFollower {
  return typeof (account as any).source_twitter_id === 'string' && (account as any).source_twitter_id.length > 0;
}

/**
 * POST - Envoyer des demandes de suivi en lot vers Bluesky et Mastodon
 * Utilise le nouveau middleware de validation standardisé
 */
export const POST = withValidation(
  SendFollowRequestSchema,
  async (request: NextRequest, data: z.infer<typeof SendFollowRequestSchema>, session) => {
    try {
      if (!session?.user?.id) {
        logger.logError('API', 'POST /api/migrate/send_follow', 'Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userId = session.user.id
      const { accounts } = data

      const accountService = new AccountService()
      const blueskyRepository = new BlueskyRepository()
      const blueskyService = new BlueskyService(blueskyRepository)
      const mastodonService = new MastodonService()
      const matchingService = new MatchingService()

      const blueskyAccount = await accountService.getAccountByProviderAndUserId('bluesky', userId)
      const mastodonAccount = await accountService.getAccountByProviderAndUserId('mastodon', userId)

      const results = {
        bluesky: null as any,
        mastodon: null as any
      }
      
      // Track successful node_ids for coord_hash lookup at the end
      const successfulNodeIds: { bluesky: string[]; mastodon: string[] } = {
        bluesky: [],
        mastodon: []
      };

      if (blueskyAccount) {
        const blueskyAccounts = accounts.filter((acc: any) => {
          if (isMatchedFollower(acc)) {
            return acc.bluesky_handle && !acc.has_been_followed_on_bluesky;
          }
          return acc.bluesky_handle && !acc.has_follow_bluesky;
        });
        
        if (blueskyAccounts.length > 0) {
          try {
            // Check rate limit before attempting follows
            const rateLimitCheck = await checkRateLimit(userId, blueskyAccounts.length)
            if (!rateLimitCheck.allowed) {
              logger.logWarning('API', 'POST /api/migrate/send_follow', `Rate limit exceeded: ${rateLimitCheck.reason}`, userId)
              return NextResponse.json({
                error: 'Rate limit exceeded',
                rateLimited: true,
                reason: rateLimitCheck.reason,
                maxFollowsAllowed: rateLimitCheck.maxFollowsAllowed,
                retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
              }, { status: 429 })
            }

            // Verify Bluesky token is valid before attempting follows
            const blueskyTokenCheck = await accountService.verifyAndRefreshBlueskyToken(userId)
            if (!blueskyTokenCheck.success) {
              logger.logWarning('API', 'POST /api/migrate/send_follow', 'Bluesky token invalid, requires reauth', userId)
              return NextResponse.json({
                error: 'Bluesky authentication required',
                requiresReauth: true,
                providers: ['bluesky'],
              }, { status: 401 })
            }

            const blueskyHandles = blueskyAccounts.map((acc: any) => acc.bluesky_handle!)

            const isOAuth = (blueskyAccount.token_type && String(blueskyAccount.token_type).toUpperCase() === 'DPOP')
              || (typeof blueskyAccount.scope === 'string' && blueskyAccount.scope.includes('atproto'))

            if (isOAuth) {
              // Use OAuth flow via dpopFetch
              results.bluesky = await blueskyService.batchFollowOAuth(
                blueskyAccount.provider_account_id,
                blueskyHandles
              )
            } else {
              // Use app-password session via BskyAgent
              await blueskyService.resumeSession({
                accessJwt: blueskyAccount.access_token,
                refreshJwt: blueskyAccount.refresh_token,
                handle: blueskyAccount.username,
                did: blueskyAccount.provider_account_id,
              });

              results.bluesky = await blueskyService.batchFollow(blueskyHandles)
            }

            // Only log error if the entire batch failed (no successes at all)
            if (results.bluesky.failures.length > 0 && results.bluesky.failures.length === blueskyHandles.length) {
              logger.logWarning('API', 'POST /api/migrate/send_follow', 'Entire Bluesky batch failed', userId, {
                failureCount: results.bluesky.failures.length,
                errors: results.bluesky.failures.map((f: any) => f.error)
              });
            }

            // Consume rate limit points for successful follows only
            const successfulFollowCount = blueskyAccounts.length - results.bluesky.failures.length;
            if (successfulFollowCount > 0) {
              await consumeRateLimit(userId, successfulFollowCount);
            }

            // Group accounts by type
            const matchedFollowers = blueskyAccounts.filter(isMatchedFollower);
            const matchingTargets = blueskyAccounts.filter((acc: any) => !isMatchedFollower(acc));

            // Séparer les succès des échecs basé sur les handles
            const failedHandles = new Set(results.bluesky.failures.map((f: any) => f.handle));
            
            // Pour MatchedFollower type
            if (matchedFollowers.length > 0) {
              const successfulFollowers = matchedFollowers.filter((acc: any) => !failedHandles.has(acc.bluesky_handle));
              const failedFollowers = matchedFollowers.filter((acc: any) => failedHandles.has(acc.bluesky_handle));
              
              // Traiter les succès
              if (successfulFollowers.length > 0) {
                await matchingService.updateSourcesFollowersStatusBatch(
                  session.user.twitter_id!,
                  successfulFollowers.map((acc: any) => acc.source_twitter_id),
                  'bluesky',
                  true,
                  undefined
                );
              }
              
              // Traiter les échecs
              if (failedFollowers.length > 0) {
                const errorMessage = results.bluesky.failures
                  .filter((f: any) => failedFollowers.some((acc: any) => acc.bluesky_handle === f.handle))
                  .map((f: any) => f.error)
                  .join('; ');
                  
                await matchingService.updateSourcesFollowersStatusBatch(
                  session.user.twitter_id!,
                  failedFollowers.map((acc: any) => acc.source_twitter_id),
                  'bluesky',
                  false,
                  errorMessage
                );
              }
            }

            // Pour MatchingTarget type
            if (matchingTargets.length > 0) {
              const successfulTargets = matchingTargets.filter((acc: any) => !failedHandles.has(acc.bluesky_handle));
              const failedTargets = matchingTargets.filter((acc: any) => failedHandles.has(acc.bluesky_handle));
              
              // Traiter les succès
              if (successfulTargets.length > 0) {
                const successTargetIds = successfulTargets
                  .map((acc: any) => String(acc.node_id))
                  .filter((id: any): id is string => !!id && id.trim().length > 0);
                  
                if (successTargetIds.length > 0) {
                  // Track for coord_hash lookup
                  successfulNodeIds.bluesky.push(...successTargetIds);
                  
                  // Pour les utilisateurs onboarded, mettre à jour sources_targets
                  if (session.user.has_onboarded) {
                    await matchingService.updateFollowStatusBatch(
                      userId,
                      successTargetIds,
                      'bluesky',
                      true,
                      undefined
                    );
                  } else if (session.user.twitter_id) {
                    // Pour les utilisateurs non-onboarded, mettre à jour sources_followers
                    await matchingService.updateSourcesFollowersByNodeIds(
                      session.user.twitter_id.toString(),
                      successTargetIds,
                      'bluesky',
                      true,
                      undefined
                    );
                  }
                }
              }
              
              // Traiter les échecs
              if (failedTargets.length > 0) {
                const failedTargetIds = failedTargets
                  .map((acc: any) => String(acc.node_id))
                  .filter((id: any): id is string => !!id && id.trim().length > 0);
                  
                if (failedTargetIds.length > 0) {
                  const errorMessage = results.bluesky.failures
                    .filter((f: any) => failedTargets.some((acc: any) => acc.bluesky_handle === f.handle))
                    .map((f: any) => f.error)
                    .join('; ');
                  
                  // Pour les utilisateurs onboarded, mettre à jour sources_targets avec success=false
                  if (session.user.has_onboarded) {
                    await matchingService.updateFollowStatusBatch(
                      userId,
                      failedTargetIds,
                      'bluesky',
                      false,
                      errorMessage
                    );
                  } else if (session.user.twitter_id) {
                    // Pour les utilisateurs non-onboarded, marquer comme "suivi" même si échec
                    // pour les retirer de pending (ils ne reviendront pas dans la liste)
                    await matchingService.updateSourcesFollowersByNodeIds(
                      session.user.twitter_id.toString(),
                      failedTargetIds,
                      'bluesky',
                      true, // Mark as followed even on failure to remove from pending
                      errorMessage
                    );
                  }
                }
              }
            }
          } catch (blueskyError) {
            const err = blueskyError instanceof Error ? blueskyError : new Error(String(blueskyError))
            logger.logError('API', 'POST /api/migrate/send_follow', err, userId, {
              context: 'Bluesky follow operation'
            });
            const errMsg = (blueskyError instanceof Error && blueskyError.message) ? blueskyError.message : 'Failed to follow on Bluesky';
            results.bluesky = { succeeded: 0, failures: [{ error: errMsg }] };
          }
        }
      }

      if (mastodonAccount && session.user.mastodon_instance) {
        const mastodonAccounts = accounts.filter((acc: any) => {
          if (isMatchedFollower(acc)) {
            return acc.mastodon_username && 
                   acc.mastodon_instance && 
                   !acc.has_been_followed_on_mastodon;
          }
          return acc.mastodon_username && 
                 acc.mastodon_instance && 
                 !acc.has_follow_mastodon;
        });

        if (mastodonAccounts.length > 0) {
          try {
            // Verify Mastodon token is valid before attempting follows
            const mastodonTokenCheck = await accountService.verifyAndRefreshMastodonToken(userId)
            if (!mastodonTokenCheck.success) {
              logger.logWarning('API', 'POST /api/migrate/send_follow', 'Mastodon token invalid, requires reauth', userId)
              return NextResponse.json({
                error: 'Mastodon authentication required',
                requiresReauth: true,
                providers: ['mastodon'],
              }, { status: 401 })
            }

            const mastodonTargets = mastodonAccounts.map((acc: any) => ({
              username: acc.mastodon_username!,
              instance: acc.mastodon_instance!,
              id: acc.mastodon_id!
            }))

            results.mastodon = await mastodonService.batchFollow(
              mastodonAccount.access_token,
              session.user.mastodon_instance,
              mastodonTargets
            )

            // Only log error if the entire batch failed (no successes at all)
            if (results.mastodon.failures.length > 0 && results.mastodon.failures.length === mastodonTargets.length) {
              logger.logWarning('API', 'POST /api/migrate/send_follow', 'Entire Mastodon batch failed', userId, {
                failureCount: results.mastodon.failures.length,
                errors: results.mastodon.failures.map((f: any) => f.error)
              });
            }

            // Group accounts by type
            const matchedFollowers = mastodonAccounts.filter(isMatchedFollower);
            const matchingTargets = mastodonAccounts.filter((acc: any) => !isMatchedFollower(acc));

            // Séparer les succès des échecs basé sur les handles (format: username@instance)
            const failedHandles = new Set(results.mastodon.failures.map((f: any) => f.handle));
            
            // Pour MatchedFollower type
            if (matchedFollowers.length > 0) {
              const successfulFollowers = matchedFollowers.filter((acc: any) => {
                const handle = `${acc.mastodon_username}@${acc.mastodon_instance.replace('https://', '')}`;
                return !failedHandles.has(handle);
              });
              const failedFollowers = matchedFollowers.filter((acc: any) => {
                const handle = `${acc.mastodon_username}@${acc.mastodon_instance.replace('https://', '')}`;
                return failedHandles.has(handle);
              });
              
              // Traiter les succès
              if (successfulFollowers.length > 0) {
                await matchingService.updateSourcesFollowersStatusBatch(
                  session.user.twitter_id!,
                  successfulFollowers.map((acc: any) => acc.source_twitter_id),
                  'mastodon',
                  true,
                  undefined
                );
              }
              
              // Traiter les échecs
              if (failedFollowers.length > 0) {
                const errorMessage = results.mastodon.failures
                  .filter((f: any) => {
                    return failedFollowers.some((acc: any) => {
                      const handle = `${acc.mastodon_username}@${acc.mastodon_instance.replace('https://', '')}`;
                      return handle === f.handle;
                    });
                  })
                  .map((f: any) => f.error)
                  .join('; ');
                  
                await matchingService.updateSourcesFollowersStatusBatch(
                  session.user.twitter_id!,
                  failedFollowers.map((acc: any) => acc.source_twitter_id),
                  'mastodon',
                  false,
                  errorMessage
                );
              }
            }

            // Pour MatchingTarget type
            if (matchingTargets.length > 0) {
              const successfulTargets = matchingTargets.filter((acc: any) => {
                const handle = `${acc.mastodon_username}@${acc.mastodon_instance.replace('https://', '')}`;
                return !failedHandles.has(handle);
              });
              const failedTargets = matchingTargets.filter((acc: any) => {
                const handle = `${acc.mastodon_username}@${acc.mastodon_instance.replace('https://', '')}`;
                return failedHandles.has(handle);
              });
              
              // Traiter les succès
              if (successfulTargets.length > 0) {
                const successTargetIds = successfulTargets
                  .map((acc: any) => String(acc.node_id))
                  .filter((id: any): id is string => !!id && id.trim().length > 0);
                  
                if (successTargetIds.length > 0) {
                  // Track for coord_hash lookup
                  successfulNodeIds.mastodon.push(...successTargetIds);
                  
                  // Pour les utilisateurs onboarded, mettre à jour sources_targets
                  if (session.user.has_onboarded) {
                    await matchingService.updateFollowStatusBatch(
                      userId,
                      successTargetIds,
                      'mastodon',
                      true,
                      undefined
                    );
                  } else if (session.user.twitter_id) {
                    // Pour les utilisateurs non-onboarded, mettre à jour sources_followers
                    await matchingService.updateSourcesFollowersByNodeIds(
                      session.user.twitter_id.toString(),
                      successTargetIds,
                      'mastodon',
                      true,
                      undefined
                    );
                  }
                }
              }
              
              // Traiter les échecs
              if (failedTargets.length > 0) {
                const failedTargetIds = failedTargets
                  .map((acc: any) => String(acc.node_id))
                  .filter((id: any): id is string => !!id && id.trim().length > 0);
                  
                if (failedTargetIds.length > 0) {
                  const errorMessage = results.mastodon.failures
                    .filter((f: any) => {
                      return failedTargets.some((acc: any) => {
                        const handle = `${acc.mastodon_username}@${acc.mastodon_instance.replace('https://', '')}`;
                        return handle === f.handle;
                      });
                    })
                    .map((f: any) => f.error)
                    .join('; ');
                  
                  // Pour les utilisateurs onboarded, mettre à jour sources_targets avec success=false
                  if (session.user.has_onboarded) {
                    await matchingService.updateFollowStatusBatch(
                      userId,
                      failedTargetIds,
                      'mastodon',
                      false,
                      errorMessage
                    );
                  } else if (session.user.twitter_id) {
                    // Pour les utilisateurs non-onboarded, marquer comme "suivi" même si échec
                    // pour les retirer de pending (ils ne reviendront pas dans la liste)
                    await matchingService.updateSourcesFollowersByNodeIds(
                      session.user.twitter_id.toString(),
                      failedTargetIds,
                      'mastodon',
                      true, // Mark as followed even on failure to remove from pending
                      errorMessage
                    );
                  }
                }
              }
            }

            console.log('Mastodon follows completed');
            console.log(results.mastodon);
          } catch (mastodonError) {
            const err = mastodonError instanceof Error ? mastodonError : new Error(String(mastodonError))
            logger.logError('API', 'POST /api/migrate/send_follow', err, userId, {
              context: 'Mastodon follow operation'
            });
            results.mastodon = { succeeded: 0, failures: [{ error: 'Failed to follow on Mastodon' }] };
          }
        }
      }

      // For non-onboarded users, refresh the user stats cache after send_follow completes
      try {
        if (!session.user.has_onboarded) {
          const statsRepository = new StatsRepository()
          await statsRepository.refreshUserStatsCache(userId, false)
        }
      } catch (statsErr) {
        const errMsg = statsErr instanceof Error ? statsErr.message : String(statsErr)
        logger.logError('API', 'POST /api/migrate/send_follow', errMsg, userId, {
          context: 'Optional refreshUserStatsCache for non-onboarded user'
        })
      }

      // Get coord_hashes for successful follows (for client-side cache update)
      let coordHashes: { bluesky: string[]; mastodon: string[] } = { bluesky: [], mastodon: [] };
      const allSuccessfulNodeIds = [...new Set([...successfulNodeIds.bluesky, ...successfulNodeIds.mastodon])];
      
      console.log('📊 [send_follow] Successful node_ids:', {
        bluesky: successfulNodeIds.bluesky.length,
        mastodon: successfulNodeIds.mastodon.length,
        total: allSuccessfulNodeIds.length
      });
      
      if (allSuccessfulNodeIds.length > 0) {
        try {
          const { data: hashMap, error: hashError } = await pgMatchingRepository.getCoordHashesByNodeIds(allSuccessfulNodeIds);
          console.log('📊 [send_follow] getCoordHashesByNodeIds result:', {
            hashMapSize: hashMap?.size || 0,
            error: hashError
          });
          if (hashMap) {
            // Map node_ids to coord_hashes for each platform
            coordHashes.bluesky = successfulNodeIds.bluesky
              .map(nodeId => hashMap.get(nodeId))
              .filter((hash): hash is string => !!hash);
            coordHashes.mastodon = successfulNodeIds.mastodon
              .map(nodeId => hashMap.get(nodeId))
              .filter((hash): hash is string => !!hash);
            console.log('📊 [send_follow] coordHashes mapped:', {
              bluesky: coordHashes.bluesky.length,
              mastodon: coordHashes.mastodon.length
            });
          }
        } catch (hashError) {
          // Non-critical error, log and continue
          console.warn('Failed to get coord_hashes for cache update:', hashError);
        }
      }

      // Format response with detailed failure info
      const formattedResults = {
        bluesky: results.bluesky ? {
          succeeded: results.bluesky.succeeded || 0,
          failed: results.bluesky.failures?.length || 0,
          failures: results.bluesky.failures?.map((f: any) => ({
            handle: f.handle || 'unknown',
            error: f.error || 'Unknown error'
          })) || [],
          coordHashes: coordHashes.bluesky
        } : null,
        mastodon: results.mastodon ? {
          succeeded: results.mastodon.succeeded || 0,
          failed: results.mastodon.failures?.length || 0,
          failures: results.mastodon.failures?.map((f: any) => ({
            handle: f.handle || 'unknown',
            error: f.error || 'Unknown error'
          })) || [],
          coordHashes: coordHashes.mastodon
        } : null
      }

      // Publish SSE event for real-time updates to the user's connected clients
      // This allows other tabs/devices to update their UI immediately
      const sseUpdates: Array<{ coord_hash: string; platform: 'bluesky' | 'mastodon'; followed: boolean }> = [];
      
      if (coordHashes.bluesky.length > 0) {
        coordHashes.bluesky.forEach(hash => {
          sseUpdates.push({ coord_hash: hash, platform: 'bluesky', followed: true });
        });
      }
      if (coordHashes.mastodon.length > 0) {
        coordHashes.mastodon.forEach(hash => {
          sseUpdates.push({ coord_hash: hash, platform: 'mastodon', followed: true });
        });
      }
      
      if (sseUpdates.length > 0) {
        // Fire and forget - don't block the response
        publishFollowingStatusUpdate(userId, sseUpdates).catch(err => {
          logger.logWarning('API', 'POST /api/migrate/send_follow', `Failed to publish SSE event: ${err}`, userId);
        });
      }

      return NextResponse.json(formattedResults)
    } catch (error) {
      const userId = session?.user?.id || 'unknown';
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logError('API', 'POST /api/migrate/send_follow', err, userId, {
        context: 'Error in send_follow route'
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false,
  }
);
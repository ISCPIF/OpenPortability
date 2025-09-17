import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { BlueskyService } from '@/lib/services/blueskyServices'
import { MastodonService } from '@/lib/services/mastodonService'
import { AccountService } from '@/lib/services/accountService'
import { BlueskyRepository } from '@/lib/repositories/blueskyRepository'
import { MatchingService } from '@/lib/services/matchingService'
import { supabase } from '@/lib/supabase'
import { MatchingTarget, MatchedFollower } from '@/lib/types/matching'
import logger from '@/lib/log_utils'
import { withValidation } from '@/lib/validation/middleware'
import { SendFollowRequestSchema, MatchingAccountSchema } from '@/lib/validation/schemas'
import { z } from 'zod'
import { StatsRepository } from '@/lib/repositories/statsRepository'

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

      if (blueskyAccount) {
        const blueskyAccounts = accounts.filter((acc: any) => {
          if (isMatchedFollower(acc)) {
            return acc.bluesky_handle && !acc.has_been_followed_on_bluesky;
          }
          return acc.bluesky_handle && !acc.has_follow_bluesky;
        });
        
        if (blueskyAccounts.length > 0) {
          try {
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

            if (results.bluesky.failures.length > 0) {
              logger.logError('API', 'POST /api/migrate/send_follow', 'Some Bluesky follows failed', userId, {
                failureCount: results.bluesky.failures.length,
                errors: results.bluesky.failures.map((f: any) => f.error)
              });
            }

            // Group accounts by type
            const matchedFollowers = blueskyAccounts.filter(isMatchedFollower);
            const matchingTargets = blueskyAccounts.filter((acc: any) => !isMatchedFollower(acc));

            // Determine if there was any success
            const hasSuccess = results.bluesky.succeeded > 0;
            const errorMessage = results.bluesky.failures.length > 0 
              ? results.bluesky.failures.map((f: any) => f.error).join('; ') 
              : undefined;

            // Update sources_followers table for MatchedFollower type
            if (matchedFollowers.length > 0) {
              await matchingService.updateSourcesFollowersStatusBatch(
                session.user.twitter_id!,
                matchedFollowers.map((acc: any) => acc.source_twitter_id),
                'bluesky',
                hasSuccess,
                errorMessage
              );
            }

            // Update sources_targets table for MatchingTarget type
            if (matchingTargets.length > 0) {
              const targetIds = matchingTargets
                .map((acc: any) => String((acc as any).node_id))
                .filter((id: any): id is string => !!id && id.trim().length > 0);
              if (targetIds.length > 0) {
                await matchingService.updateFollowStatusBatch(
                  userId,
                  targetIds,
                  'bluesky',
                  hasSuccess,
                  errorMessage
                );
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

            if (results.mastodon.failures.length > 0) {
              logger.logError('API', 'POST /api/migrate/send_follow', 'Some Mastodon follows failed', userId, {
                failureCount: results.mastodon.failures.length,
                errors: results.mastodon.failures.map((f: any) => f.error)
              });
            }

            // Group accounts by type
            const matchedFollowers = mastodonAccounts.filter(isMatchedFollower);
            const matchingTargets = mastodonAccounts.filter((acc: any) => !isMatchedFollower(acc));

            // Update sources_followers table for MatchedFollower type
            if (matchedFollowers.length > 0) {
              await matchingService.updateSourcesFollowersStatusBatch(
                session.user.twitter_id!,
                matchedFollowers.map((acc: any) => acc.source_twitter_id),
                'mastodon',
                results.mastodon.succeeded > 0,
                results.mastodon.failures.length > 0 
                  ? results.mastodon.failures.map((f: any) => f.error).join('; ') 
                  : undefined
              );
            }

            // Update sources_targets table for MatchingTarget type
            if (matchingTargets.length > 0) {
              const targetIds = matchingTargets
                .map((acc: any) => String((acc as any).node_id))
                .filter((id: any): id is string => !!id && id.trim().length > 0);
              if (targetIds.length > 0) {
                await matchingService.updateFollowStatusBatch(
                  userId,
                  targetIds,
                  'mastodon',
                  results.mastodon.succeeded > 0,
                  results.mastodon.failures.length > 0 
                    ? results.mastodon.failures.map((f: any) => f.error).join('; ') 
                    : undefined
                );
              }
            }
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

      return NextResponse.json(results)
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
    applySecurityChecks: true,
    skipRateLimit: false,
  }
);
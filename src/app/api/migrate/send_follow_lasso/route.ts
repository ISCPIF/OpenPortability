import { NextRequest, NextResponse } from 'next/server'
import { BlueskyService } from '@/lib/services/blueskyServices'
import { MastodonService } from '@/lib/services/mastodonService'
import { AccountService } from '@/lib/services/accountService'
import { BlueskyRepository } from '@/lib/repositories/blueskyRepository'
import { pgLassoRepository } from '@/lib/repositories/public/pg-lasso-repository'
import { GraphNodesService } from '@/lib/services/graphNodesService'
import logger from '@/lib/log_utils'
import { withValidation } from '@/lib/validation/middleware'
import { z } from 'zod'
import { checkRateLimit, consumeRateLimit } from '@/lib/services/rateLimitService'

// Schema for lasso follow request - accepts hashes instead of twitter_ids (RGPD-friendly)
const LassoFollowSchema = z.object({
  hashes: z.array(z.string()).min(1).max(500),
}).strict()

// Internal type for resolved accounts
interface ResolvedAccount {
  twitter_id: string;
  bluesky_handle: string | null;
  mastodon_username: string | null;
  mastodon_instance: string | null;
}

/**
 * POST - Envoyer des demandes de suivi via lasso vers Bluesky et Mastodon
 * Enregistre les demandes dans lasso_follow_requests pour tracking
 */
export const POST = withValidation(
  LassoFollowSchema,
  async (request: NextRequest, data: z.infer<typeof LassoFollowSchema>, session) => {
    try {
      if (!session?.user?.id) {
        logger.logError('API', 'POST /api/migrate/send_follow_lasso', 'Unauthorized access attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userId = session.user.id
      const { hashes } = data

      // Resolve hashes to accounts (twitter_id + handles) via GraphNodesService
      const graphNodesService = new GraphNodesService()
      const resolvedNodes = await graphNodesService.getNodesByHashes(hashes)

      if (resolvedNodes.length === 0) {
        logger.logWarning('API', 'POST /api/migrate/send_follow_lasso', 'No nodes found for provided hashes', userId, {
          hashesCount: hashes.length
        })
        return NextResponse.json({
          bluesky: null,
          mastodon: null,
          total: { requested: hashes.length, resolved: 0, blueskyRequested: 0, mastodonRequested: 0 }
        })
      }

      // Transform resolved nodes to accounts format
      const accounts: ResolvedAccount[] = resolvedNodes.map(node => ({
        twitter_id: node.twitter_id,
        bluesky_handle: node.bluesky_handle,
        mastodon_username: node.mastodon_username,
        mastodon_instance: node.mastodon_instance,
      }))

      logger.logDebug('API', 'POST /api/migrate/send_follow_lasso', `Resolved ${accounts.length} accounts from ${hashes.length} hashes`, userId)

      const accountService = new AccountService()
      const blueskyRepository = new BlueskyRepository()
      const blueskyService = new BlueskyService(blueskyRepository)
      const mastodonService = new MastodonService()

      const blueskyAccount = await accountService.getAccountByProviderAndUserId('bluesky', userId)
      const mastodonAccount = await accountService.getAccountByProviderAndUserId('mastodon', userId)

      const results = {
        bluesky: null as any,
        mastodon: null as any
      }

      // Filter accounts with Bluesky handles
      const blueskyAccounts = accounts.filter((acc: ResolvedAccount) => acc.bluesky_handle)
      
      // Filter accounts with Mastodon handles
      const mastodonAccounts = accounts.filter((acc: ResolvedAccount) => 
        acc.mastodon_username && acc.mastodon_instance
      )

      // Process Bluesky follows
      if (blueskyAccount && blueskyAccounts.length > 0) {
        try {
          // Check rate limit before attempting follows
          const rateLimitCheck = await checkRateLimit(userId, blueskyAccounts.length)
          if (!rateLimitCheck.allowed) {
            logger.logWarning('API', 'POST /api/migrate/send_follow_lasso', `Rate limit exceeded: ${rateLimitCheck.reason}`, userId)
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
            logger.logWarning('API', 'POST /api/migrate/send_follow_lasso', 'Bluesky token invalid, requires reauth', userId)
            return NextResponse.json({
              error: 'Bluesky authentication required',
              requiresReauth: true,
              providers: ['bluesky'],
            }, { status: 401 })
          }

          // Create lasso follow requests in DB
          const blueskyRequests = blueskyAccounts.map((acc: ResolvedAccount) => ({
            user_id: userId,
            target_twitter_id: acc.twitter_id,
            platform: 'bluesky' as const,
          }))
          await pgLassoRepository.createFollowRequestsBatch(blueskyRequests)

          const blueskyHandles = blueskyAccounts.map((acc: ResolvedAccount) => acc.bluesky_handle!)

          const isOAuth = (blueskyAccount.token_type && String(blueskyAccount.token_type).toUpperCase() === 'DPOP')
            || (typeof blueskyAccount.scope === 'string' && blueskyAccount.scope.includes('atproto'))

          if (isOAuth) {
            results.bluesky = await blueskyService.batchFollowOAuth(
              blueskyAccount.provider_account_id,
              blueskyHandles
            )
          } else {
            await blueskyService.resumeSession({
              accessJwt: blueskyAccount.access_token,
              refreshJwt: blueskyAccount.refresh_token,
              handle: blueskyAccount.username,
              did: blueskyAccount.provider_account_id,
            })
            results.bluesky = await blueskyService.batchFollow(blueskyHandles)
          }

          // Update statuses based on results
          const failedHandles = new Set(results.bluesky.failures.map((f: any) => f.handle))
          
          const successfulIds = blueskyAccounts
            .filter((acc: ResolvedAccount) => !failedHandles.has(acc.bluesky_handle))
            .map((acc: ResolvedAccount) => acc.twitter_id)
          
          const failedIds = blueskyAccounts
            .filter((acc: ResolvedAccount) => failedHandles.has(acc.bluesky_handle))
            .map((acc: ResolvedAccount) => acc.twitter_id)

          // Consume rate limit points for successful follows only
          if (successfulIds.length > 0) {
            await consumeRateLimit(userId, successfulIds.length)
          }

          if (successfulIds.length > 0) {
            await pgLassoRepository.updateFollowRequestStatusBatch(
              userId, successfulIds, 'bluesky', 'completed'
            )
          }
          if (failedIds.length > 0) {
            const errorMsg = results.bluesky.failures
              .filter((f: any) => failedIds.some((id: string) => 
                blueskyAccounts.find((a: ResolvedAccount) => a.twitter_id === id)?.bluesky_handle === f.handle
              ))
              .map((f: any) => f.error)
              .join('; ')
            await pgLassoRepository.updateFollowRequestStatusBatch(
              userId, failedIds, 'bluesky', 'failed', errorMsg
            )
          }

        } catch (blueskyError) {
          const err = blueskyError instanceof Error ? blueskyError : new Error(String(blueskyError))
          logger.logError('API', 'POST /api/migrate/send_follow_lasso', err, userId, {
            context: 'Bluesky follow operation'
          })
          results.bluesky = { succeeded: 0, failures: [{ error: err.message }] }
        }
      }

      // Process Mastodon follows
      if (mastodonAccount && session.user.mastodon_instance && mastodonAccounts.length > 0) {
        try {
          // Verify Mastodon token is valid before attempting follows
          const mastodonTokenCheck = await accountService.verifyAndRefreshMastodonToken(userId)
          if (!mastodonTokenCheck.success) {
            logger.logWarning('API', 'POST /api/migrate/send_follow_lasso', 'Mastodon token invalid, requires reauth', userId)
            return NextResponse.json({
              error: 'Mastodon authentication required',
              requiresReauth: true,
              providers: ['mastodon'],
            }, { status: 401 })
          }

          // Create lasso follow requests in DB
          const mastodonRequests = mastodonAccounts.map((acc: ResolvedAccount) => ({
            user_id: userId,
            target_twitter_id: acc.twitter_id,
            platform: 'mastodon' as const,
          }))
          await pgLassoRepository.createFollowRequestsBatch(mastodonRequests)

          const mastodonTargets = mastodonAccounts.map((acc: ResolvedAccount) => ({
            username: acc.mastodon_username!,
            instance: acc.mastodon_instance!,
            id: undefined, // We don't have mastodon_id here
          }))

          results.mastodon = await mastodonService.batchFollow(
            mastodonAccount.access_token,
            session.user.mastodon_instance,
            mastodonTargets
          )

          // Update statuses based on results
          const failedHandles = new Set(results.mastodon.failures.map((f: any) => f.handle))
          
          const successfulIds = mastodonAccounts
            .filter((acc: ResolvedAccount) => {
              const handle = `${acc.mastodon_username}@${acc.mastodon_instance?.replace('https://', '')}`
              return !failedHandles.has(handle)
            })
            .map((acc: ResolvedAccount) => acc.twitter_id)
          
          const failedIds = mastodonAccounts
            .filter((acc: ResolvedAccount) => {
              const handle = `${acc.mastodon_username}@${acc.mastodon_instance?.replace('https://', '')}`
              return failedHandles.has(handle)
            })
            .map((acc: ResolvedAccount) => acc.twitter_id)

          if (successfulIds.length > 0) {
            await pgLassoRepository.updateFollowRequestStatusBatch(
              userId, successfulIds, 'mastodon', 'completed'
            )
          }
          if (failedIds.length > 0) {
            const errorMsg = results.mastodon.failures
              .map((f: any) => f.error)
              .join('; ')
            await pgLassoRepository.updateFollowRequestStatusBatch(
              userId, failedIds, 'mastodon', 'failed', errorMsg
            )
          }

        } catch (mastodonError) {
          const err = mastodonError instanceof Error ? mastodonError : new Error(String(mastodonError))
          logger.logError('API', 'POST /api/migrate/send_follow_lasso', err, userId, {
            context: 'Mastodon follow operation'
          })
          results.mastodon = { succeeded: 0, failures: [{ error: err.message }] }
        }
      }

      // Format response
      const formattedResults = {
        bluesky: results.bluesky ? {
          succeeded: results.bluesky.succeeded || 0,
          failed: results.bluesky.failures?.length || 0,
          failures: results.bluesky.failures?.map((f: any) => ({
            handle: f.handle || 'unknown',
            error: f.error || 'Unknown error'
          })) || []
        } : null,
        mastodon: results.mastodon ? {
          succeeded: results.mastodon.succeeded || 0,
          failed: results.mastodon.failures?.length || 0,
          failures: results.mastodon.failures?.map((f: any) => ({
            handle: f.handle || 'unknown',
            error: f.error || 'Unknown error'
          })) || []
        } : null,
        total: {
          hashesRequested: hashes.length,
          resolved: accounts.length,
          blueskyRequested: blueskyAccounts.length,
          mastodonRequested: mastodonAccounts.length,
        }
      }

      return NextResponse.json(formattedResults)
    } catch (error) {
      const userId = session?.user?.id || 'unknown'
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logError('API', 'POST /api/migrate/send_follow_lasso', err, userId, {
        context: 'Error in lasso-follow route'
      })
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
)

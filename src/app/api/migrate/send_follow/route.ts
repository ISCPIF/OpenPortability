import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { BlueskyService } from '@/lib/services/blueskyServices'
import { MastodonService } from '@/lib/services/mastodonService'
import { AccountService } from '@/lib/services/accountService'
import { BlueskyRepository } from '@/lib/repositories/blueskyRepository'
import { MatchingService } from '@/lib/services/matchingService'
import { supabase } from '@/lib/supabase'
import { MatchingTarget, MatchedFollower } from '@/lib/types/matching'
import { decrypt } from '@/lib/encryption'
import logger, { withLogging } from '@/lib/log_utils'

type AccountToFollow = MatchingTarget | MatchedFollower;

function isMatchedFollower(account: AccountToFollow): account is MatchedFollower {
  return 'source_twitter_id' in account;
}

async function sendFollowHandler(request: Request) {
  try {
    const session = await auth()
    if (!session.user?.id) {
      logger.logWarning('API', 'POST /api/migrate/send_follow', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { accounts } = await request.json()

    if (!Array.isArray(accounts)) {
      logger.logWarning('API', 'POST /api/migrate/send_follow', 'Invalid request body: accounts must be an array', userId);
      return NextResponse.json(
        { error: 'Invalid request body: accounts must be an array' },
        { status: 400 }
      )
    }

    // Validate that accounts match either MatchingTarget or MatchedFollower structure
    if (!accounts.every(acc => 
      (typeof acc.target_twitter_id === 'string' || typeof acc.source_twitter_id === 'string') &&
      (acc.bluesky_handle === null || typeof acc.bluesky_handle === 'string') &&
      (acc.mastodon_username === null || typeof acc.mastodon_username === 'string') &&
      (acc.mastodon_instance === null || typeof acc.mastodon_instance === 'string') &&
      (acc.mastodon_id === null || typeof acc.mastodon_id === 'string') &&
      (typeof acc.has_follow_bluesky === 'boolean' || typeof acc.has_been_followed_on_bluesky === 'boolean') &&
      (typeof acc.has_follow_mastodon === 'boolean' || typeof acc.has_been_followed_on_mastodon === 'boolean')
    )) {
      logger.logWarning('API', 'POST /api/migrate/send_follow', 'Invalid account format', userId);
      return NextResponse.json(
        { error: 'Invalid account format' },
        { status: 400 }
      )
    }

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
      const blueskyAccounts = accounts.filter(acc => {
        if (isMatchedFollower(acc)) {
          return acc.bluesky_handle && !acc.has_been_followed_on_bluesky;
        }
        return acc.bluesky_handle && !acc.has_follow_bluesky;
      });
      
      if (blueskyAccounts.length > 0) {
        try {
          await blueskyService.resumeSession({
            accessJwt: decrypt(blueskyAccount.access_token),
            refreshJwt: decrypt(blueskyAccount.refresh_token),
            handle: blueskyAccount.username,
            did: blueskyAccount.provider_account_id
          });

          const blueskyHandles = blueskyAccounts.map(acc => acc.bluesky_handle!)        
          results.bluesky = await blueskyService.batchFollow(blueskyHandles)

          if (results.bluesky.failures.length > 0) {
            logger.logWarning('API', 'POST /api/migrate/send_follow', 'Some Bluesky follows failed', userId, {
              failureCount: results.bluesky.failures.length,
              errors: results.bluesky.failures.map(f => f.error)
            });
          }

          // Batch update follow status based on account type
          const hasSuccess = results.bluesky.succeeded > 0;
          const errorMessage = results.bluesky.failures.length > 0 
            ? results.bluesky.failures.map(f => f.error).join('; ') 
            : undefined;

          // Group accounts by type
          const matchedFollowers = blueskyAccounts.filter(isMatchedFollower);
          const matchingTargets = blueskyAccounts.filter(acc => !isMatchedFollower(acc));

          // Update sources_followers table for MatchedFollower type
          if (matchedFollowers.length > 0) {
            await matchingService.updateSourcesFollowersStatusBatch(
              session.user.twitter_id!,
              matchedFollowers.map(acc => acc.source_twitter_id),
              'bluesky',
              hasSuccess,
              errorMessage
            );
          }

          // Update sources_targets table for MatchingTarget type
          if (matchingTargets.length > 0) {
            await matchingService.updateFollowStatusBatch(
              userId,
              matchingTargets.map(acc => acc.target_twitter_id),
              'bluesky',
              hasSuccess,
              errorMessage
            );
          }
        } catch (blueskyError) {
          logger.logError('API', 'POST /api/migrate/send_follow', blueskyError, userId, {
            context: 'Bluesky follow operation'
          });
          results.bluesky = { succeeded: 0, failures: [{ error: 'Failed to follow on Bluesky' }] };
        }
      }
    }

    if (mastodonAccount && session.user.mastodon_instance) {
      const mastodonAccounts = accounts.filter(acc => {
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
          const mastodonTargets = mastodonAccounts.map(acc => ({
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
            logger.logWarning('API', 'POST /api/migrate/send_follow', 'Some Mastodon follows failed', userId, {
              failureCount: results.mastodon.failures.length,
              errors: results.mastodon.failures.map(f => f.error)
            });
          }

          // Group accounts by type
          const matchedFollowers = mastodonAccounts.filter(isMatchedFollower);
          const matchingTargets = mastodonAccounts.filter(acc => !isMatchedFollower(acc));

          // Update sources_followers table for MatchedFollower type
          if (matchedFollowers.length > 0) {
            await matchingService.updateSourcesFollowersStatusBatch(
              session.user.twitter_id!,
              matchedFollowers.map(acc => acc.source_twitter_id),
              'mastodon',
              results.mastodon.succeeded > 0,
              results.mastodon.failures.length > 0 
                ? results.mastodon.failures.map(f => f.error).join('; ') 
                : undefined
            );
          }

          // Update sources_targets table for MatchingTarget type
          if (matchingTargets.length > 0) {
            await matchingService.updateFollowStatusBatch(
              userId,
              matchingTargets.map(acc => acc.target_twitter_id),
              'mastodon',
              results.mastodon.succeeded > 0,
              results.mastodon.failures.length > 0 
                ? results.mastodon.failures.map(f => f.error).join('; ') 
                : undefined
            );
          }
        } catch (mastodonError) {
          logger.logError('API', 'POST /api/migrate/send_follow', mastodonError, userId, {
            context: 'Mastodon follow operation'
          });
          results.mastodon = { succeeded: 0, failures: [{ error: 'Failed to follow on Mastodon' }] };
        }
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/migrate/send_follow', error, userId, {
      context: 'Error in send_follow route'
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(sendFollowHandler);
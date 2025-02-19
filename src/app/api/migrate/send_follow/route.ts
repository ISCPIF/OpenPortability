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

type AccountToFollow = MatchingTarget | MatchedFollower;

function isMatchedFollower(account: AccountToFollow): account is MatchedFollower {
  return 'source_twitter_id' in account;
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { accounts } = await request.json()

    console.log('Received accounts:', accounts)

    if (!Array.isArray(accounts)) {
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
      
      console.log('[send_follow] Filtered Bluesky accounts to follow:', {
        totalAccounts: accounts.length,
        blueskyAccountsToFollow: blueskyAccounts.length,
        handles: blueskyAccounts.map(acc => acc.bluesky_handle)
      });
      
      if (blueskyAccounts.length > 0) {
        console.log('[send_follow] Resuming Bluesky session with account:', {
          handle: blueskyAccount.username,
          did: blueskyAccount.provider_account_id
        });

        await blueskyService.resumeSession({
          accessJwt: decrypt(blueskyAccount.access_token),
          refreshJwt: decrypt(blueskyAccount.refresh_token),
          handle: blueskyAccount.username,
          did: blueskyAccount.provider_account_id
        });

        const blueskyHandles = blueskyAccounts.map(acc => acc.bluesky_handle!)
        console.log('[send_follow] Starting Bluesky batch follow for handles:', blueskyHandles);
        
        results.bluesky = await blueskyService.batchFollow(blueskyHandles)
        console.log('[send_follow] Bluesky batch follow results:', results.bluesky);

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
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in send_follow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
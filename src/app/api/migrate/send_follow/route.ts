import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { BlueskyService } from '@/lib/services/blueskyServices'
import { MastodonService } from '@/lib/services/mastodonService'
import { AccountService } from '@/lib/services/accountService'
import { BlueskyRepository } from '@/lib/repositories/blueskyRepository'
import { MatchingService } from '@/lib/services/matchingService'
import { supabase } from '@/lib/supabase'
import { MatchingTarget } from '@/lib/types/matching'

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

    // Validate that accounts match MatchingTarget structure
    if (!accounts.every(acc => 
      typeof acc.target_twitter_id === 'string' &&
      (acc.bluesky_handle === null || typeof acc.bluesky_handle === 'string') &&
      (acc.mastodon_username === null || typeof acc.mastodon_username === 'string') &&
      (acc.mastodon_instance === null || typeof acc.mastodon_instance === 'string') &&
      (acc.mastodon_id === null || typeof acc.mastodon_id === 'string') &&
      typeof acc.has_follow_bluesky === 'boolean' &&
      typeof acc.has_follow_mastodon === 'boolean'
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
      const blueskyAccounts = accounts.filter(acc => acc.bluesky_handle && !acc.has_follow_bluesky)
      
      console.log('[send_follow] Filtered Bluesky accounts to follow:', {
        totalAccounts: accounts.length,
        blueskyAccountsToFollow: blueskyAccounts.length,
        handles: blueskyAccounts.map(acc => acc.bluesky_handle)
      });
      
      if (blueskyAccounts.length > 0) {
        // Reprendre la session Bluesky
        console.log('[send_follow] Resuming Bluesky session with account:', {
          handle: blueskyAccount.username,
          did: blueskyAccount.provider_account_id
        });

        await blueskyService.resumeSession({
          accessJwt: blueskyAccount.access_token,
          refreshJwt: blueskyAccount.refresh_token,
          handle: blueskyAccount.username,
          did: blueskyAccount.provider_account_id
        });

        const blueskyHandles = blueskyAccounts.map(acc => acc.bluesky_handle!)
        console.log('[send_follow] Starting Bluesky batch follow for handles:', blueskyHandles);
        
        results.bluesky = await blueskyService.batchFollow(blueskyHandles)
        console.log('[send_follow] Bluesky batch follow results:', results.bluesky);

        // Batch update follow status for Bluesky accounts
        console.log('[send_follow] Updating follow status for Bluesky accounts:', {
          userId,
          accountsToUpdate: blueskyAccounts.map(acc => acc.target_twitter_id)
        });
        
        // Pour Bluesky, on met à jour uniquement les follows réussis
        const hasSuccess = results.bluesky.succeeded > 0;

        await matchingService.updateFollowStatusBatch(
          userId,
          blueskyAccounts.map(acc => acc.target_twitter_id),
          'bluesky',
          hasSuccess,
          undefined  // On ne stocke pas les erreurs
        )
      }
    }

    if (mastodonAccount && session.user.mastodon_instance) {
      const mastodonAccounts = accounts.filter(acc => 
        acc.mastodon_username && 
        acc.mastodon_instance && 
        !acc.has_follow_mastodon
      )

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

        // Batch update follow status for Mastodon accounts
        await matchingService.updateFollowStatusBatch(
          userId,
          mastodonAccounts.map(acc => acc.target_twitter_id),
          'mastodon',
          results.mastodon.succeeded > 0,  
          results.mastodon.failures.length > 0 
            ? results.mastodon.failures.map(f => f.error).join('; ') 
            : undefined
        )
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
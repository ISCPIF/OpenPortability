import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { supabase, authClient } from '@/lib/supabase'
import { BskyAgent } from '@atproto/api'
import { createClient } from '@supabase/supabase-js'

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function followOnMastodon(accessToken: string, userInstance: string, targetUsername: string, targetInstance: string) {
  // Remove 'https://' and any potential @instance from username
  const cleanUserInstance = userInstance.replace('https://', '')
  const cleanTargetInstance = targetInstance.replace('https://', '')
  const cleanUsername = targetUsername.split('@')[0] // Get only the username part
  
  console.log(' [mastodon_follow] Attempting to follow account:', { 
    userInstance: cleanUserInstance, 
    targetUsername: cleanUsername,
    targetInstance: cleanTargetInstance 
  })
  
  try {
    // First, search for the account on our instance
    const searchResponse = await fetch(
      `https://${cleanUserInstance}/api/v1/accounts/search?q=${cleanUsername}@${cleanTargetInstance}&resolve=true&limit=1`, 
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log(' [mastodon_follow] Search response:', await searchResponse.clone().text())

    if (!searchResponse.ok) {
      console.error(' [mastodon_follow] Failed to search account:', { 
        status: searchResponse.status, 
        statusText: searchResponse.statusText 
      })
      throw new Error('Failed to search account');
    }

    const accounts = await searchResponse.json();
    console.log(' [mastodon_follow] Number of accounts found:', accounts.length);

    // Trouver le compte qui correspond exactement à notre recherche
    const accountToFollow = accounts.find(acc => 
      acc.acct === `${cleanUsername}@${cleanTargetInstance}` || 
      (acc.username === cleanUsername && acc.url.includes(cleanTargetInstance))
    );

    if (!accountToFollow) {
      console.error(' [mastodon_follow] No exact match found for:', {
        targetUsername: cleanUsername,
        targetInstance: cleanTargetInstance,
        accounts: accounts.map(acc => ({ username: acc.username, acct: acc.acct, url: acc.url }))
      })
      throw new Error('No exact match found');
    }


    console.log(' [mastodon_follow] Found account to follow:', {
      id: accountToFollow.id,
      username: accountToFollow.username,
      acct: accountToFollow.acct
    })

    // Now follow using the ID from our instance
    const followResponse = await fetch(
      `https://${cleanUserInstance}/api/v1/accounts/${accountToFollow.id}/follow`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!followResponse.ok) {
      let errorDetails;
      try {
        errorDetails = await followResponse.json();
      } catch {
        errorDetails = 'No error details available';
      }
      
      console.error(' [mastodon_follow] Failed to follow:', { 
        status: followResponse.status, 
        statusText: followResponse.statusText,
        errorDetails
      })
      throw new Error(`Failed to follow on Mastodon: ${followResponse.statusText}`);
    }

    console.log(' [mastodon_follow] Successfully followed account:', { 
      userInstance: cleanUserInstance, 
      targetUsername: cleanUsername,
      targetInstance: cleanTargetInstance 
    })
    return await followResponse.json();
  } catch (error) {
    console.error(' [mastodon_follow] Error following on Mastodon:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  console.log(' [send_follow] Starting request...')
  try {
    const session = await auth()
    if (!session?.user?.id) {
      console.error(' [send_follow] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log(' [send_follow] Session found for user:', session.user.id)

    const { accounts } = await request.json()
    console.log(' [send_follow] Received batch of accounts:', {
      count: accounts?.length || 0,
      accounts: accounts
    })

    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.error(' [send_follow] Invalid accounts data')
      return NextResponse.json({ error: 'Invalid accounts data' }, { status: 400 })
    }

    // Get both Bluesky and Mastodon credentials
    console.log(' [send_follow] Fetching social credentials...')
    const { data: accountsData, error: accountsError } = await authClient
      .from('accounts')
      .select('access_token, refresh_token, provider_account_id, provider')
      .eq('user_id', session.user.id)
      .in('provider', ['bluesky', 'mastodon'])
      .eq('type', 'oauth')

    if (accountsError || !accountsData) {
      console.error(' [send_follow] Credentials error:', accountsError)
      return NextResponse.json({ error: 'Social credentials not found' }, { status: 400 })
    }

    const blueskyAccount = accountsData.find(acc => acc.provider === 'bluesky')
    const mastodonAccount = accountsData.find(acc => acc.provider === 'mastodon')

    // Get user info for Mastodon instance
    const { data: userData, error: userError } = await authClient
      .from('users')
      .select('mastodon_id, mastodon_username, mastodon_instance')
      .eq('id', session.user.id)
      .single()

    if (userError) {
      console.error(' [send_follow] Error fetching user data:', userError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    // Traiter les follows Bluesky
    const blueskyFollows = accounts.filter(acc => acc.bluesky_handle && !acc.has_follow_bluesky)
    console.log(' [send_follow] Bluesky accounts to follow:', blueskyFollows.length)

    let blueskySuccessCount = 0
    let mastodonSuccessCount = 0

    if (blueskyAccount && blueskyFollows.length > 0) {
      const agent = new BskyAgent({ service: 'https://bsky.social' })
      await agent.resumeSession({
        accessJwt: blueskyAccount.access_token,
        refreshJwt: blueskyAccount.refresh_token,
        handle: blueskyAccount.provider_account_id,
        did: blueskyAccount.provider_account_id,
        active: true
      })

      for (const account of blueskyFollows) {
        try {
          const profile = await agent.getProfile({ actor: account.bluesky_handle })
          if (!profile.success) {
            throw new Error(`Failed to resolve profile for ${account.bluesky_handle}`)
          }
          
          await agent.follow(profile.data.did)
          await supabaseServer
            .from('sources_targets')
            .update({ has_follow_bluesky: true })
            .eq('source_id', session.user.id)
            .eq('target_twitter_id', account.twitter_id)

          console.log(` [send_follow] Successfully followed ${account.bluesky_handle} on Bluesky`)
          blueskySuccessCount++
        } catch (error) {
          console.error(` [send_follow] Failed to follow ${account.bluesky_handle} on Bluesky:`, error)
        }
      }
    }

    // Traiter les follows Mastodon
    const mastodonFollows = accounts.filter(acc => 
      acc.mastodon_username && 
      acc.mastodon_instance && 
      !acc.has_follow_mastodon
    )
    console.log(' [send_follow] Mastodon accounts to follow:', mastodonFollows.length)

    if (mastodonAccount && mastodonFollows.length > 0 && userData.mastodon_instance) {
      for (const account of mastodonFollows) {
        try {
          await followOnMastodon(
            mastodonAccount.access_token,
            userData.mastodon_instance,
            account.mastodon_username!,
            account.mastodon_instance!
          )
          await supabaseServer
            .from('sources_targets')
            .update({ has_follow_mastodon: true })
            .eq('source_id', session.user.id)
            .eq('target_twitter_id', account.twitter_id)

          console.log(` [send_follow] Successfully followed ${account.mastodon_username}@${account.mastodon_instance} on Mastodon`)
          mastodonSuccessCount++
        } catch (error) {
          console.error(` [send_follow] Failed to follow ${account.mastodon_username}@${account.mastodon_instance} on Mastodon:`, error)
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      results: {
        bluesky: {
          attempted: blueskyFollows.length,
          succeeded: blueskySuccessCount
        },
        mastodon: {
          attempted: mastodonFollows.length,
          succeeded: mastodonSuccessCount
        }
      }
    })
  } catch (error) {
    console.error(' [send_follow] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
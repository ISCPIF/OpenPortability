import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { supabase, authClient } from '@/lib/supabase'
import { BskyAgent } from '@atproto/api'

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

    // Get user info from next-auth users table
    const { data: userData, error: userError } = await authClient
      .from('users')
      .select('mastodon_id, mastodon_username, mastodon_instance')
      .eq('id', session.user.id)
      .single()

    if (userError) {
      console.error(' [send_follow] Error fetching user data:', userError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    console.log(' [send_follow] User data:', userData)

    const { accounts } = await request.json()
    console.log(' [send_follow] Received accounts:', {
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

    console.log("Accounts data:", accountsData)

    if (accountsError || !accountsData) {
      console.error(' [send_follow] Credentials error:', accountsError)
      return NextResponse.json({ error: 'Social credentials not found' }, { status: 400 })
    }

    const blueskyAccount = accountsData.find(acc => acc.provider === 'bluesky')
    const mastodonAccount = accountsData.find(acc => acc.provider === 'mastodon')

    console.log(' [send_follow] Found credentials:', {
      hasBluesky: !!blueskyAccount,
      hasMastodon: !!mastodonAccount,
      blueskyHandle: blueskyAccount?.provider_account_id,
      mastodonHandle: mastodonAccount?.provider_account_username
    })

    // Get both Bluesky and Mastodon handles for selected accounts
    console.log(' [send_follow] Fetching social handles...')
    const { data: matches, error: matchesError } = await supabase
      .from('migration_bluesky_view')
      .select('twitter_id, bluesky_handle')
      .in('twitter_id', accounts)
      .eq('user_id', session.user.id)
      .eq('has_follow_bluesky', false)
      .not('bluesky_handle', 'is', null)

    if (matchesError) {
      console.error(' [send_follow] Error fetching Bluesky matches:', matchesError)
    } else {
      console.log(' [send_follow] Found Bluesky matches:', {
        count: matches?.length || 0,
        matches: matches
      })
    }

    // Get Mastodon matches
    const { data: mastodonMatches, error: mastodonMatchesError } = await supabase
      .from('twitter_mastodon_users')
      .select('twitter_id, mastodon_username, mastodon_instance, mastodon_id')
      .in('twitter_id', accounts)
      .not('mastodon_username', 'is', null)

    if (mastodonMatchesError) {
      console.error(' [send_follow] Error fetching Mastodon matches:', mastodonMatchesError)
    } else {
      console.log(' [send_follow] Found Mastodon matches:', {
        count: mastodonMatches?.length || 0,
        matches: mastodonMatches
      })
    }

    const results = {
      bluesky: { success: 0, failed: 0 },
      mastodon: { success: 0, failed: 0 }
    }

    // Follow on Bluesky
    if (blueskyAccount?.access_token && matches && matches.length > 0) {
      console.log(' [send_follow] Initializing Bluesky agent...')
      const agent = new BskyAgent({ service: 'https://bsky.social' })
      
      console.log(' [send_follow] Resuming Bluesky session...', {
        handle: blueskyAccount.provider_account_id,
        did: blueskyAccount.provider_account_id
      })
      
      await agent.resumeSession({
        accessJwt: blueskyAccount.access_token,
        refreshJwt: blueskyAccount.refresh_token,
        did: blueskyAccount.provider_account_id,
        handle: blueskyAccount.provider_account_id,
        active: true
      })

      console.log(' [send_follow] Bluesky session resumed')

      for (const match of matches) {
        console.log(' [send_follow] Attempting to follow on Bluesky:', match.bluesky_handle)
        try {
          // First resolve the handle to a DID
          const profile = await agent.getProfile({ actor: match.bluesky_handle })
          if (profile.success && profile.data.did) {
            await agent.follow(profile.data.did)
            console.log(' [send_follow] Successfully followed on Bluesky:', match.bluesky_handle)
            results.bluesky.success++
          } else {
            throw new Error('Could not resolve profile DID')
          }
        } catch (error) {
          console.error(' [send_follow] Failed to follow on Bluesky:', {
            handle: match.bluesky_handle,
            error: error
          })
          results.bluesky.failed++
        }
      }
    } else {
      console.log(' [send_follow] Skipping Bluesky follows:', {
        hasToken: !!blueskyAccount?.access_token,
        hasMatches: !!matches,
        matchCount: matches?.length || 0
      })
    }

    // Follow on Mastodon
    if (mastodonAccount?.access_token && mastodonMatches && mastodonMatches.length > 0 && userData?.mastodon_instance) {
      console.log(' [send_follow] Starting Mastodon follows...', {
        accessToken: mastodonAccount.access_token.substring(0, 10) + '...',
        userMastodonId: userData.mastodon_id,
        userMastodonInstance: userData.mastodon_instance
      })

      for (const match of mastodonMatches) {
        const targetMastodonHandle = `${match.mastodon_username}@${match.mastodon_instance}`
        console.log(' [send_follow] Attempting to follow on Mastodon:', {
          handle: targetMastodonHandle,
          instance: match.mastodon_instance
        })
        try {
          await followOnMastodon(
            mastodonAccount.access_token,
            userData.mastodon_instance,
            targetMastodonHandle,
            match.mastodon_instance
          )
          console.log(' [send_follow] Successfully followed on Mastodon:', match.mastodon_username)
          results.mastodon.success++
        } catch (error) {
          console.error(' [send_follow] Failed to follow on Mastodon:', {
            username: match.mastodon_username,
            error: error
          })
          results.mastodon.failed++
        }
      }
    } else {
      console.log(' [send_follow] Skipping Mastodon follows:', {
        hasToken: !!mastodonAccount?.access_token,
        hasMatches: !!mastodonMatches,
        matchCount: mastodonMatches?.length || 0
      })
    }

    console.log(' [send_follow] Final results:', {
      bluesky: results.bluesky,
      mastodon: results.mastodon
    })

    return NextResponse.json({
      message: 'Follow requests sent',
      results
    })

  } catch (error) {
    console.error(' [send_follow] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
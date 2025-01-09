import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { supabase, authClient } from '@/lib/supabase'
import { BskyAgent } from '@atproto/api'

export async function POST(request: Request) {
  console.log('🚀 [send_follow] Starting request...')
  try {
    const session = await auth()
    if (!session?.user?.id) {
      console.error('❌ [send_follow] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('✅ [send_follow] Session found for user:', session.user.id)

    const { accounts } = await request.json()
    console.log('📥 [send_follow] Received accounts:', accounts?.length || 0)

    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.error('❌ [send_follow] Invalid accounts data')
      return NextResponse.json({ error: 'Invalid accounts data' }, { status: 400 })
    }

    console.log('🔑 [send_follow] Fetching Bluesky credentials...')
    const { data: accountData, error: accountError } = await authClient
      .from('accounts')
      .select('access_token, refresh_token, provider_account_id, provider')
      .eq('user_id', session.user.id)
      .eq('provider', 'bluesky')
      .eq('type', 'oauth')
      .single()

    if (accountError || !accountData) {
      console.error('❌ [send_follow] Bluesky credentials error:', accountError)
      return NextResponse.json({ error: 'Bluesky credentials not found' }, { status: 400 })
    }
    console.log('✅ [send_follow] Bluesky credentials found:', {
      hasAccessToken: !!accountData.access_token,
      hasRefreshToken: !!accountData.refresh_token,
      provider_account_id: accountData.provider_account_id
    })


    // Récupérer les handles Bluesky pour les comptes sélectionnés depuis les deux tables
    console.log('🔄 [send_follow] Fetching Bluesky handles...')
    const { data: followersMatches, error: followersError } = await supabase
      .from('sources_followers')
      .select('follower_id, bluesky_handle')
      .in('follower_id', accounts)
      .eq('source_id', session.user.id)
      .eq('has_follow_bluesky', false)
      .not('bluesky_handle', 'is', null);

    const { data: followingMatches, error: followingError } = await supabase
      .from('sources_targets')
      .select('target_twitter_id, bluesky_handle')
      .in('target_twitter_id', accounts)
      .eq('source_id', session.user.id)
      .eq('has_follow_bluesky', false)
      .not('bluesky_handle', 'is', null);

      console.log('✅ [send_follow] Bluesky credentials found:', {
        hasAccessToken: !!accountData.access_token,
        hasRefreshToken: !!accountData.refresh_token,
        provider_account_id: accountData.provider_account_id
      })

    if (followersError || followingError) {
      console.error('❌ [send_follow] Database errors:', { followersError, followingError })
      return NextResponse.json({ error: 'Failed to fetch Bluesky handles' }, { status: 500 })
    }

    const matches = [
      ...(followersMatches?.map(m => ({
        twitter_id: m.follower_id,
        bluesky_handle: m.bluesky_handle
      })) || []),
      ...(followingMatches?.map(m => ({
        twitter_id: m.target_twitter_id,
        bluesky_handle: m.bluesky_handle
      })) || [])
    ];

    console.log('📊 [send_follow] Matches found:', {
      total: matches.length,
      fromFollowers: followersMatches?.length || 0,
      fromFollowing: followingMatches?.length || 0
    })

    // Se connecter à Bluesky avec le token
    console.log('🔌 [send_follow] Connecting to Bluesky...')
    const agent = new BskyAgent({ service: 'https://bsky.social' })

    
    
    // Créer la session avec toutes les informations requises
 const sessionData = {
      accessJwt: accountData.access_token,
      refreshJwt: accountData.refresh_token,
      handle: accountData.provider_account_id.split('.')[0], // Le DID est la première partie avant le point
      did: accountData.provider_account_id, // Le provider_account_id est déjà le DID complet
      email: session.user.email || '',
      active: true
    }

      console.log('🔌 [send_follow] Attempting to connect with session:', {
        handle: sessionData.handle,
        did: sessionData.did,
        hasAccessJwt: !!sessionData.accessJwt,
        hasRefreshJwt: !!sessionData.refreshJwt
      })
    
    await agent.resumeSession(sessionData)
    console.log('✅ [send_follow] Connected to Bluesky as:', sessionData.handle)

    // Suivre chaque compte et mettre à jour la base de données
    console.log('👥 [send_follow] Starting to follow accounts...')
    const results = await Promise.allSettled(
      matches.map(async (match) => {
        if (!match.bluesky_handle) return null
        try {
          console.log('🔄 [send_follow] Following:', match.bluesky_handle)
          await agent.follow(match.bluesky_handle)
          
          // Mettre à jour les deux tables
          console.log('💾 [send_follow] Updating database for:', match.bluesky_handle)
          await Promise.all([
            // Mettre à jour sources_followers
            supabase
              .from('sources_followers')
              .update({
                has_follow_bluesky: true,
                followed_at_bluesky: new Date().toISOString()
              })
              .eq('source_id', session.user.id)
              .eq('follower_id', match.twitter_id),

            // Mettre à jour sources_targets
            supabase
              .from('sources_targets')
              .update({
                has_follow_bluesky: true,
                followed_at_bluesky: new Date().toISOString()
              })
              .eq('source_id', session.user.id)
              .eq('target_twitter_id', match.twitter_id)
          ])
          
          console.log('✅ [send_follow] Successfully followed:', match.bluesky_handle)
          return match.bluesky_handle
        } catch (error) {
          console.error(`❌ [send_follow] Failed to follow ${match.bluesky_handle}:`, error)
          return null
        }
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log('📈 [send_follow] Final results:', {
      succeeded,
      failed,
      total: matches.length
    })

    return NextResponse.json({
      success: true,
      stats: {
        succeeded,
        failed,
        total: matches.length
      }
    })

  } catch (error) {
    console.error('❌ [send_follow] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
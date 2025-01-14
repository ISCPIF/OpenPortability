import { NextResponse } from "next/server"
import { BskyAgent } from '@atproto/api'
import { auth } from "@/app/auth"
import { supabase } from "@/lib/supabase"

export async function refreshBlueskySession(agent: BskyAgent, credentials: any) {
  try {
    console.log('🔄 [refreshBlueskySession] Starting refresh with credentials:', {
      hasAccessToken: true,
      hasRefreshToken: !!credentials.refresh_token,
      handle: credentials.provider_account_id?.split('.')[0],
      did: credentials.provider_account_id
    })

    console.log('1️⃣ [refreshBlueskySession] First resuming session with current tokens...')
    try {
      // D'abord reprendre la session avec les tokens actuels
      await agent.resumeSession({
        accessJwt: credentials.access_token,
        refreshJwt: credentials.refresh_token,
        handle: credentials.provider_account_id.split('.')[0],
        did: credentials.provider_account_id,
        active: true
      })
      
      console.log('2️⃣ [refreshBlueskySession] Now attempting to refresh session...')
      // Ensuite rafraîchir la session
      const result = await agent.api.com.atproto.server.refreshSession()

      console.log('📦 [refreshBlueskySession] Refresh session response:', {
        success: !!result,
        hasAccessJwt: !!result.data?.accessJwt,
        hasRefreshJwt: !!result.data?.refreshJwt
      })

      if (result.data?.accessJwt) {
        console.log('3️⃣ [refreshBlueskySession] Updating database with new tokens...')
        const dbResult = await supabase
          .from('accounts')
          .update({
            access_token: result.data.accessJwt,
            refresh_token: result.data.refreshJwt,
            token_type: 'bearer',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          })
          .eq('provider_account_id', credentials.provider_account_id)
          .eq('provider', 'bluesky')

        console.log('📝 [refreshBlueskySession] Database update result:', {
          error: dbResult.error,
          status: dbResult.status,
          count: dbResult.count
        })

        // Reprendre la session avec les nouveaux tokens
        await agent.resumeSession({
          accessJwt: result.data.accessJwt,
          refreshJwt: result.data.refreshJwt,
          handle: credentials.provider_account_id.split('.')[0],
          did: credentials.provider_account_id,
          active: true
        })

        return {
          success: true,
          session: {
            accessJwt: result.data.accessJwt,
            refreshJwt: result.data.refreshJwt,
            handle: credentials.provider_account_id.split('.')[0],
            did: credentials.provider_account_id
          }
        }
      }

      console.warn('⚠️ [refreshBlueskySession] Failed to refresh session: No tokens in response')
      return {
        success: false,
        error: 'Failed to refresh session'
      }
    } catch (sessionError: any) {
      console.error('❌ [refreshBlueskySession] Session error:', {
        message: sessionError.message,
        status: sessionError.status,
        success: sessionError.success
      })
      throw sessionError
    }
  } catch (error: any) {
    console.error('💥 [refreshBlueskySession] Fatal error:', {
      message: error.message,
      status: error.status,
      success: error.success
    })
    
    if (error.message?.includes('InvalidToken') || error.message?.includes('ExpiredToken')) {
      console.log('🔑 [refreshBlueskySession] Marking account for reauth...')
      await supabase
        .from('accounts')
        .update({
          requires_reauth: true
        })
        .eq('provider_account_id', credentials.provider_account_id)
        .eq('provider', 'bluesky')
      console.log('✅ [refreshBlueskySession] Account marked for reauth')
    }

    return {
      success: false,
      error: error.message,
      requiresReauth: true
    }
  }
}

export async function refreshMastodonToken(credentials: any) {
  try {
    const response = await fetch(`${credentials.instance_url}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.MASTODON_CLIENT_ID!,
        client_secret: process.env.MASTODON_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    await supabase
      .from('accounts')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      })
      .eq('provider_account_id', credentials.provider_account_id)
      .eq('provider', 'mastodon')

    return {
      success: true,
      session: data
    }
  } catch (error: any) {
    console.error('Error refreshing Mastodon token:', error)

    if (error.message?.includes('invalid_grant')) {
      await supabase
        .from('accounts')
        .update({
          requires_reauth: true
        })
        .eq('provider_account_id', credentials.provider_account_id)
        .eq('provider', 'mastodon')
    }

    return {
      success: false,
      error: error.message,
      requiresReauth: true
    }
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider, credentials } = await request.json()

    if (!provider || !credentials) {
      return NextResponse.json(
        { error: 'Provider and credentials are required' },
        { status: 400 }
      )
    }

    let result

    if (provider === 'bluesky') {
      const agent = new BskyAgent({ service: 'https://bsky.social' })
      result = await refreshBlueskySession(agent, credentials)
    } else if (provider === 'mastodon') {
      result = await refreshMastodonToken(credentials)
    } else {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, requiresReauth: result.requiresReauth },
        { status: 401 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in refresh route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
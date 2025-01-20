import { NextResponse } from "next/server"
import { BskyAgent } from '@atproto/api'
import { auth } from "@/app/auth"
import { authClient } from "@/lib/supabase"

export async function refreshBlueskySession(agent: BskyAgent, credentials: any) {
  try {
    console.log('🔄 [refreshBlueskySession] Checking token validity for:', {
      hasAccessToken: true,
      hasRefreshToken: !!credentials.refresh_token,
      handle: credentials.provider_account_id?.split('.')[0],
      did: credentials.provider_account_id
    })

    try {
      await agent.resumeSession({
        accessJwt: credentials.access_token,
        refreshJwt: credentials.refresh_token,
        handle: credentials.provider_account_id.split('.')[0],
        did: credentials.provider_account_id,
        active: true
      })
      
      console.log('✅ [refreshBlueskySession] Token is valid')
      return { success: true }
    } catch (error) {
      console.error('❌ [refreshBlueskySession] Token is invalid:', error.message)
      return { 
        success: false, 
        error: error.message,
        requiresReauth: true 
      }
    }
  } catch (error: any) {
    console.error('💥 [refreshBlueskySession] Error checking token:', error)
    return {
      success: false,
      error: error.message,
      requiresReauth: true
    }
  }
}

export async function POST(request: Request) {
  console.log('📥 [POST] Received token refresh request')
  try {
    const session = await auth()
    if (!session?.user?.id) {
      console.warn('⚠️ [POST] Unauthorized request - no user id found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer le compte Bluesky
    const { data: account, error } = await authClient
      .from('accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('type', 'oauth')
      .eq('provider', 'bluesky')
      .single()

    if (error || !account) {
      console.warn('⚠️ [POST] No Bluesky account found')
      return NextResponse.json(
        { error: 'No Bluesky account found' },
        { status: 401 }
      )
    }

    // Vérifier le token
    const agent = new BskyAgent({ service: 'https://bsky.social' })
    const result = await refreshBlueskySession(agent, account)

    if (!result.success) {
      console.warn('⚠️ [POST] Invalid token')
      return NextResponse.json(
        { success: false, error: 'invalid_token', providers: ['bluesky'] },
        { status: 402 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('💥 [POST] Error in refresh route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
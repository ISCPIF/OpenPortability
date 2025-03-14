import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { BlueskyService } from "@/lib/services/blueskyServices"
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import logger, { withLogging } from '@/lib/log_utils'

const blueskyRepository = new BlueskyRepository()
const blueskyService = new BlueskyService(blueskyRepository)

async function blueskyPostHandler(req: Request) {
  try {    
    const { identifier, password } = await req.json()
    const session = await auth()
    let userId = session?.user?.id ? session?.user?.id : "anonymous";

    // Authentification Bluesky
    const authResult = await blueskyService.login(identifier, password)
    if (!authResult.success || !authResult.data) {
      logger.logWarning('API', 'POST /api/auth/bluesky', 'Bluesky authentication failed', userId, { error: authResult.error })
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      )
    }
    const profile = await blueskyService.getProfile(authResult.data.handle)

    // Vérification si l'utilisateur existe avec cet ID Bluesky
    const existingUser = await blueskyRepository.getUserByBlueskyId(authResult.data.did)
    userId = existingUser ? existingUser.id : userId
    if (existingUser) {
      // Si le compte Bluesky est déjà lié à un autre utilisateur
      if (userId && existingUser.id !== userId) {
        logger.logWarning('API', 'POST /api/auth/bluesky', 'Bluesky account already linked to another user', undefined, { blueskyId: authResult.data.did, userId, existingUserId: existingUser.id })
        return NextResponse.json(
          { success: false, error: 'This Bluesky account is already linked to another user' },
          { status: 409 }
        )
      }
      // L'utilisateur existe, mise à jour du profil
      userId = existingUser.id
      logger.logInfo('API', 'POST /api/auth/bluesky', 'Updating existing Bluesky profile', userId)
      await blueskyRepository.updateBlueskyProfile(userId, profile)
      await blueskyRepository.linkBlueskyAccount(userId, authResult.data)
    } else if (userId && userId !== "anonymous") {
      // L'utilisateur est connecté mais pas lié à ce compte Bluesky
      logger.logInfo('API', 'POST /api/auth/bluesky', 'Linking Bluesky account to existing user', userId)
      await blueskyRepository.updateBlueskyProfile(userId, profile)
      await blueskyRepository.linkBlueskyAccount(userId, authResult.data)
    } else {
      // Création d'un nouvel utilisateur
      logger.logInfo('API', 'POST /api/auth/bluesky', 'Creating new user from Bluesky account', undefined, { handle: authResult.data.handle })
      const user = await supabaseAdapter.createUser({
        provider: 'bluesky',
        profile: {
          did: authResult.data.did,
          handle: authResult.data.handle,
          displayName: profile.displayName,
          avatar: profile.avatar
        }
      })
      userId = user.id
      await blueskyRepository.linkBlueskyAccount(userId, authResult.data)
    }
    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        bluesky_id: authResult.data.did,
        bluesky_username: authResult.data.handle,
        bluesky_image: profile.avatar,
      }
    })
  } catch (error: any) {
    logger.logError('API', 'POST /api/auth/bluesky', error, undefined, { message: 'Error in Bluesky auth route' })
    
    if (error instanceof Error && error.message === 'Token could not be verified') {
      return NextResponse.json({ error: 'InvalidToken' }, { status: 500 })
    }
  
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}


async function blueskyDeleteHandler(req: Request) {
  try {    
    const session = await auth();

    if (!supabaseAdapter.deleteSession) {
      const error = new Error('Required adapter methods are not implemented');
      logger.logError('API', 'DELETE /api/auth/bluesky', error)
      throw error;
    }
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'DELETE /api/auth/bluesky', 'Logout attempt without authentication')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

  // try {
    // Get CSRF token from request headers
    const csrfToken = req.headers.get('x-csrf-token');
    if (!csrfToken) {
      logger.logWarning('API', 'DELETE /api/auth/bluesky', 'Logout attempt without CSRF token', session.user.id)
      return NextResponse.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }

    // Delete the session from the database
    await supabaseAdapter.deleteSession(session.user.id);

    const cookieStore = cookies();
    
    // Clear session cookies
    cookieStore.delete('next-auth.session-token');
    cookieStore.delete('next-auth.csrf-token');
    cookieStore.delete('next-auth.callback-url');

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Set-Cookie': [
            'next-auth.session-token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'next-auth.csrf-token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'next-auth.callback-url=; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
          ].join(', ')
        }
      }
    );
  } catch (error) {
    logger.logError('API', 'DELETE /api/auth/bluesky', error, undefined, { message: 'Logout failed' })
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}

// Export wrapped handler functions with logging middleware
export const POST = withLogging(blueskyPostHandler)
export const DELETE = withLogging(blueskyDeleteHandler)
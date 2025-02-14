import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { BlueskyService } from "@/lib/services/blueskyServices"
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository"
import { supabaseAdapter } from "@/lib/supabase-adapter"

const blueskyRepository = new BlueskyRepository()
const blueskyService = new BlueskyService(blueskyRepository)

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json()
    const session = await auth()
    let userId = session?.user?.id

    // Authentification Bluesky
    const authResult = await blueskyService.login(identifier, password)
    if (!authResult.success || !authResult.data) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      )
    }

    

    const profile = await blueskyService.getProfile(authResult.data.handle)

    // Vérification si l'utilisateur existe avec cet ID Bluesky
    const existingUser = await blueskyRepository.getUserByBlueskyId(authResult.data.did)
    
    if (existingUser) {
      // Si le compte Bluesky est déjà lié à un autre utilisateur
      if (userId && existingUser.id !== userId) {
        return NextResponse.json(
          { success: false, error: 'This Bluesky account is already linked to another user' },
          { status: 409 }
        )
      }
      // L'utilisateur existe, mise à jour du profil
      userId = existingUser.id
      await blueskyRepository.updateBlueskyProfile(userId, profile)
      await blueskyRepository.linkBlueskyAccount(userId, authResult.data)
    } else if (userId) {
      // L'utilisateur est connecté mais pas lié à ce compte Bluesky
      await blueskyRepository.updateBlueskyProfile(userId, profile)
      await blueskyRepository.linkBlueskyAccount(userId, authResult.data)
    } else {
      // Création d'un nouvel utilisateur
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
    console.error('Error in Bluesky auth route:', error)
    
    if (error instanceof Error && error.message === 'Token could not be verified') {
      return NextResponse.json({ error: 'InvalidToken' }, { status: 500 })
    }
  
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}


export async function DELETE(req: Request) {
  const session = await auth();

  if (!supabaseAdapter.deleteSession) {
    throw new Error('Required adapter methods are not implemented');
  }
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    // Get CSRF token from request headers
    const csrfToken = req.headers.get('x-csrf-token');
    if (!csrfToken) {
      return NextResponse.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }

    // Delete the session from the database
    await supabaseAdapter.deleteSession(session.user.id);

    const cookieStore = await cookies();
    
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
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
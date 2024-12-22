import { NextResponse } from "next/server"
import { BskyAgent } from '@atproto/api'
import { auth, signIn } from "@/app/auth"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();
    const session = await auth();

    // Bluesky Authentication
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    const bskySession = await agent.login({ identifier, password });
    const profile = await agent.getProfile({ actor: bskySession.data.handle });

    let userId = session?.user?.id;
    let user;

    // Check if user exists with this Bluesky ID
    const existingUser = await supabaseAdapter.getUserByAccount({
      provider: 'bluesky',
      providerAccountId: bskySession.data.did
    });

    if (existingUser) {
      // User exists, update their profile
      userId = existingUser.id;
      user = await supabaseAdapter.updateUser(userId, {
        provider: 'bluesky',
        profile: {
          did: bskySession.data.did,
          handle: bskySession.data.handle,
          displayName: profile.data.displayName,
          avatar: profile.data.avatar
        }
      });
    } else if (userId) {
      // User is logged in but not linked to this Bluesky account
      user = await supabaseAdapter.updateUser(userId, {
        provider: 'bluesky',
        profile: {
          did: bskySession.data.did,
          handle: bskySession.data.handle,
          displayName: profile.data.displayName,
          avatar: profile.data.avatar
        }
      });
    } else {
      // Create new user
      console.log('Creating new user with Bluesky data');
      user = await supabaseAdapter.createUser({
        provider: 'bluesky',
        profile: {
          did: bskySession.data.did,
          handle: bskySession.data.handle,
          displayName: profile.data.displayName,
          avatar: profile.data.avatar
        }
      });
      userId = user.id;

      // Link account for new user
      await supabaseAdapter.linkAccount({
        provider: 'bluesky',
        type: 'oauth',
        providerAccountId: bskySession.data.did,
        access_token: bskySession.data.accessJwt,
        refresh_token: bskySession.data.refreshJwt,
        userId: userId,
        expires_at: undefined,
        token_type: 'bearer',
        scope: undefined,
      });
    }

    // Create session using Next-Auth's signIn
    const signInResult = await signIn('credentials', {
      redirect: false,
      id: userId,
      bluesky_id: bskySession.data.did,
      bluesky_username: bskySession.data.handle,
      bluesky_image: profile.data.avatar,
      name: profile.data.displayName || bskySession.data.handle,
      callbackUrl: '/dashboard'
    });

    if (signInResult?.error) {
      throw new Error(signInResult.error);
    }

    return NextResponse.json({ 
      success: true,
      redirect: signInResult?.url || '/dashboard',
      user: {
        id: user.id,
        bluesky_username: bskySession.data.handle
      }
    });

  } catch (error) {
    console.error('Error in Bluesky authentication:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    // Supprimer la session
    await supabaseAdapter.deleteSession(session.user.id);

    // Effacer les cookies de session
    const cookieStore = cookies();
    await cookieStore.delete('next-auth.session-token');
    await cookieStore.delete('next-auth.csrf-token');
    await cookieStore.delete('next-auth.callback-url');

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Set-Cookie': [
            'next-auth.session-token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'next-auth.csrf-token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'next-auth.callback-url=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
          ]
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
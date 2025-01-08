import { NextResponse } from "next/server"
import { BskyAgent } from '@atproto/api'
import { auth, signIn } from "@/app/auth"
import { supabaseAdapter, BlueskyProfile } from "@/lib/supabase-adapter"
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

    if (!supabaseAdapter.getUserByAccount || !supabaseAdapter.updateUser || !supabaseAdapter.createUser || !supabaseAdapter.linkAccount) {
      throw new Error('Required adapter methods are not implemented');
    }
    // Check if user exists with this Bluesky ID
    const existingUser = await supabaseAdapter.getUserByAccount({
      provider: 'bluesky',
      providerAccountId: bskySession.data.did
    });

    if (existingUser) {
      // If the Bluesky account is already linked to another user
      if (userId && existingUser.id !== userId) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'This Bluesky account is already linked to another user'
          },
          { status: 409 }
        );
      }
      // User exists, update their profile
      userId = existingUser.id;
      const blueskyProfile: BlueskyProfile = {
        did: bskySession.data.did,
        handle: bskySession.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar
      };
      user = await supabaseAdapter.updateUser(userId, {
        provider: 'bluesky',
        profile: blueskyProfile
      });
    } else if (userId) {
      console.log(`User ${userId} is logged in but not linked to this Bluesky account`);
      // User is logged in but not linked to this Bluesky account
      const blueskyProfile: BlueskyProfile = {
        did: bskySession.data.did,
        handle: bskySession.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar
      };
      user = await supabaseAdapter.updateUser(userId, {
        provider: 'bluesky',
        profile: blueskyProfile
      });
    } else {
      // Create new user
      console.log('Creating new user with Bluesky data');
      const blueskyProfile: BlueskyProfile = {
        did: bskySession.data.did,
        handle: bskySession.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar
      };
      user = await supabaseAdapter.createUser({
        provider: 'bluesky',
        profile: blueskyProfile
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

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        bluesky_id: bskySession.data.did,
        bluesky_username: bskySession.data.handle,
        bluesky_image: profile.data.avatar,
        name: profile.data.displayName || bskySession.data.handle
      }
    });

  } catch (error) {
    console.error('Error in Bluesky authentication:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
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
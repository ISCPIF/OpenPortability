import { NextResponse } from "next/server"
import { BskyAgent } from '@atproto/api'
import { auth } from "@/app/auth"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    // Authentification Bluesky
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    const session = await agent.login({ identifier, password });
    const profile = await agent.getProfile({ actor: session.data.handle });

    // Créer ou mettre à jour l'utilisateur avec le format attendu par l'adaptateur
    const user = await supabaseAdapter.createUser({
      provider: 'bluesky',
      profile: {
        did: session.data.did,
        handle: session.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar
      }
    });

    // Vérifier si le compte existe déjà
    const existingAccount = await supabaseAdapter.getAccountsByUserId(user.id);
    const blueskyAccount = existingAccount?.find(acc => acc.provider === 'bluesky');

    if (!blueskyAccount) {
      // Lier le compte seulement s'il n'existe pas déjà
      await supabaseAdapter.linkAccount({
        provider: 'bluesky',
        type: 'oauth',
        providerAccountId: session.data.did,
        access_token: session.data.accessJwt,
        refresh_token: session.data.refreshJwt,
        userId: user.id,
        expires_at: undefined,
        token_type: 'bearer',
        scope: undefined,
      });
    }

    // Créer une session
    await supabaseAdapter.createSession({
      session_token: crypto.randomUUID(),
      user_id: user.id,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });

    return NextResponse.json({ 
      ok: true,
      user: {
        id: user.id,
        name: profile.data.displayName || profile.data.handle,
        bluesky_handle: session.data.handle
      }
    });

  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
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
    cookieStore.delete('next-auth.session-token');
    cookieStore.delete('next-auth.csrf-token');
    cookieStore.delete('next-auth.callback-url');

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
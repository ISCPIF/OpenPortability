import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";
import { auth } from "@/app/auth"
import { authConfig } from "@/app/auth.config";
import { BskyAgent } from '@atproto/api';

// Create a single Supabase client for the API route
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: "next-auth"
    }
  }
)

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();
    console.log('BlueSky auth attempt for identifier:', identifier);

    if (!identifier || !password) {
      console.log('Missing credentials');
      return NextResponse.json(
        { error: 'Missing identifier or password' },
        { status: 400 }
      );
    }

    // Connexion à Bluesky
    console.log('Attempting BlueSky login...');
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    let session;
    try {
      session = await agent.login({ identifier, password });
      console.log('BlueSky login successful for handle:', session.data.handle);
    } catch (error: any) {
      console.error('Bluesky login error:', error);
      return NextResponse.json(
        { error: 'Invalid Bluesky credentials' },
        { status: 401 }
      );
    }

    // Récupérer les informations du profil
    console.log('Fetching BlueSky profile...');
    const profile = await agent.getProfile({ actor: session.data.handle });
    console.log('Profile fetched:', {
      profile
    });

    // Chercher si l'utilisateur existe déjà
    console.log('Checking for existing user with BlueSky ID:', session.data.did);
    const existingUser = await supabase
      .from('users')
      .select('*')
      .eq('bluesky_id', session.data.did)
      .single();

    let userId;
    
    if (existingUser.data) {
      console.log('Existing user found, updating...', existingUser.data);
      // Mettre à jour l'utilisateur existant
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: profile.data.displayName || profile.data.handle,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.data.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user' },
          { status: 500 }
        );
      }

      userId = existingUser.data.id;

      // Mettre à jour les tokens dans la table accounts
      const { error: accountUpdateError } = await supabase
        .from('accounts')
        .update({
          access_token: session.data.accessJwt,
          refresh_token: session.data.refreshJwt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        // .eq('provider', 'bluesky');

      if (accountUpdateError) {
        console.error('Error updating account:', accountUpdateError);
        return NextResponse.json(
          { error: 'Failed to update account' },
          { status: 500 }
        );
      }
    } else {
      console.log('Creating new user...');
      // Créer un nouvel utilisateur
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          name: profile.data.displayName || profile.data.handle,
          bluesky_id: session.data.did,
          bluesky_username: session.data.handle,
          bluesky_image: profile.data.avatar,
          // twitter_id: null,
          // twitter_username: null,
          // twitter_image: null,
          // mastodon_id: null,
          // mastodon_username: null,
          // mastodon_image: null,
          // mastodon_instance: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      userId = newUser.id;

      // Créer l'entrée dans la table accounts
      const { error: accountError } = await supabase
        .from('accounts')
        .insert({
          user_id: userId,
          type: 'oauth',
          provider: 'bluesky',
          provider_account_id: session.data.did,
          access_token: session.data.accessJwt,
          refresh_token: session.data.refreshJwt,
          token_type: 'bearer',
          expires_at: null,
          id_token: null,
          scope: null,
          session_state: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (accountError) {
        console.error('Error creating account:', accountError);
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        );
      }
    }

    // Créer une session NextAuth
    console.log('Creating NextAuth session for user ID:', userId);
    const sessionToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

    await supabase.from('sessions').insert({
      session_token: sessionToken,
      user_id: userId,
      expires: expires.toISOString(),
    });

    console.log('Session created successfully, returning response with cookie');
    // Retourner la réponse avec le cookie de session
    return NextResponse.json(
      { 
        ok: true,
        user: {
          id: userId,
          name: profile.data.displayName || profile.data.handle,
          bluesky_handle: session.data.handle
        }
      },
      {
        headers: {
          'Set-Cookie': `next-auth.session-token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`
        }
      }
    );

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
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Supprimer la session de la base de données
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', session.user.id);

    // Retourner une réponse avec un cookie expiré
    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Set-Cookie': `next-auth.session-token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      }
    );
  } catch (error) {
    console.error('Error signing out:', error);
    return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
  }
}
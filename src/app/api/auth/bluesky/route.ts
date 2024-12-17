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
    console.log('Profile fetched:', { profile });

    // Vérifier si le BlueSky ID est déjà utilisé
    console.log('Checking if BlueSky ID exists:', session.data.did);
    const existingBlueSkyId = await supabase
      .from('users')
      .select('id')
      .eq('bluesky_id', session.data.did)
      .single();

    if (existingBlueSkyId.data) {
      console.log('BlueSky ID already in use');
      return NextResponse.json(
        { error: 'Ce compte BlueSky est déjà lié à un autre utilisateur' },
        { status: 400 }
      );
    }

    // Vérifier si c'est une première connexion ou un ajout de compte
    const currentSession = await auth();
    console.log('Current session:', currentSession);

    let userId;

    if (currentSession?.user?.id) {
      // Cas de linking account : utilisateur déjà connecté
      console.log('Linking BlueSky account to existing user:', currentSession.user.id);
      
      // Mettre à jour l'utilisateur existant avec les infos BlueSky
      const { error: updateError } = await supabase
        .from('users')
        .update({
          bluesky_id: session.data.did,
          bluesky_username: session.data.handle,
          bluesky_image: profile.data.avatar,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSession.user.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user' },
          { status: 500 }
        );
      }

      userId = currentSession.user.id;
    } else {
      // Cas de création : nouvel utilisateur
      console.log('Creating new user with BlueSky account');
      console.log(supabase)
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          name: profile.data.displayName || profile.data.handle,
          bluesky_id: session.data.did,
          bluesky_username: session.data.handle,
          bluesky_image: profile.data.avatar,
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
    }

    // Créer ou mettre à jour l'entrée dans la table accounts
    console.log('Creating/updating BlueSky account entry');
    const { error: accountError } = await supabase
      .from('accounts')
      .upsert({
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
      console.error('Error with account entry:', accountError);
      return NextResponse.json(
        { error: 'Failed to create/update account entry' },
        { status: 500 }
      );
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
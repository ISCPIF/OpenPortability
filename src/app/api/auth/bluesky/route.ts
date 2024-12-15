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
    // Récupérer la session actuelle
    const session = await auth();
    console.log("SESSION FROM BLUESKY ROUTE:", session)
    const { identifier, password } = await req.json();

    // Authenticate with BlueSky using the SDK
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({ identifier, password });

    // Get session data
    const blueskyData = {
      did: agent.session?.did!,
      handle: agent.session?.handle!,
      accessJwt: agent.session?.accessJwt!,
      refreshJwt: agent.session?.refreshJwt!,
    };

    // Get profile data using the SDK
    const profileResponse = await agent.getProfile({ actor: blueskyData.handle });
    const profileData = {
      displayName: profileResponse.data.displayName || blueskyData.handle,
      avatar: profileResponse.data.avatar || null
    };

    // Si nous avons une session, mettre à jour l'utilisateur existant
    if (session?.user?.id) {
      console.log("Updating existing user with ID:", session.user.id);
      console.log("BlueSky data to update:", {
        did: blueskyData.did,
        handle: blueskyData.handle,
        displayName: profileData.displayName,
        avatar: profileData.avatar
      });

      // D'abord, vérifier si un autre utilisateur a déjà ces identifiants BlueSky
      const { data: existingBlueSkyUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('bluesky_id', blueskyData.did)
        .neq('id', session.user.id)
        .single();

      if (existingBlueSkyUser) {
        throw new Error('This BlueSky account is already linked to another user');
      }

      // Mettre à jour l'utilisateur avec les informations BlueSky
      const { data: updatedUser, error: userError } = await supabase
        .from('users')
        .update({
          bluesky_id: blueskyData.did,
          bluesky_username: blueskyData.handle,
          bluesky_image: profileData.avatar,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id)
        .select()
        .single();

      console.log("Update response - User:", updatedUser);
      console.log("Update response - Error:", userError);

      if (userError) {
        console.error('Error updating user:', userError);
        throw new Error('Failed to update user with BlueSky data');
      }

      // Vérifier si un compte BlueSky existe déjà pour cet utilisateur
      console.log("Checking for existing BlueSky account...");
      const { data: existingAccount, error: accountQueryError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('provider', 'bluesky')
        .single();

      console.log("Existing account check - Account:", existingAccount);
      console.log("Existing account check - Error:", accountQueryError);

      if (existingAccount) {
        console.log("Updating existing BlueSky account...");
        // Mettre à jour le compte existant
        const { error: accountError } = await supabase
          .from('accounts')
          .update({
            access_token: blueskyData.accessJwt,
            refresh_token: blueskyData.refreshJwt,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAccount.id);

        console.log("Account update error:", accountError);

        if (accountError) {
          console.error('Error updating account:', accountError);
          throw new Error('Failed to update BlueSky account');
        }
      } else {
        console.log("Creating new BlueSky account...");
        // Créer un nouveau compte BlueSky
        const accountData = {
          user_id: session.user.id,
          type: 'oauth',
          provider: 'bluesky',
          provider_account_id: blueskyData.did,
          access_token: blueskyData.accessJwt,
          refresh_token: blueskyData.refreshJwt,
          expires_at: null,
          id_token: null,
          scope: null,
          session_state: null,
          token_type: 'bearer'
        };

        console.log("New account data:", accountData);

        const { error: accountError } = await supabase
          .from('accounts')
          .insert(accountData);

        console.log("Account creation error:", accountError);

        if (accountError) {
          console.error('Error creating account:', accountError);
          throw new Error('Failed to create BlueSky account association');
        }
      }
    } else {
      // Première connexion avec BlueSky
      console.log("Creating new user with BlueSky credentials");

      // Vérifier si un utilisateur existe déjà avec ce compte BlueSky
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('bluesky_id', blueskyData.did)
        .single();

      if (existingUser) {
        throw new Error('This BlueSky account is already linked to an existing user');
      }

      // Créer un nouvel utilisateur
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          name: profileData.displayName || blueskyData.handle,
          email: `${blueskyData.did}@bsky.social`,
          email_verified: new Date().toISOString(),
          bluesky_id: blueskyData.did,
          bluesky_username: blueskyData.handle,
          bluesky_image: profileData.avatar,
          has_onboarded: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        console.error('Error creating user:', userError);
        throw new Error('Failed to create new user');
      }

      // Créer l'entrée dans la table accounts
      const accountData = {
        user_id: newUser.id,
        type: 'oauth',
        provider: 'bluesky',
        provider_account_id: blueskyData.did,
        access_token: blueskyData.accessJwt,
        refresh_token: blueskyData.refreshJwt,
        expires_at: null,
        id_token: null,
        scope: null,
        session_state: null,
        token_type: 'bearer'
      };

      const { error: accountError } = await supabase
        .from('accounts')
        .insert(accountData);

      if (accountError) {
        console.error('Error creating account:', accountError);
        throw new Error('Failed to create BlueSky account');
      }

      // Create session after user creation/update
      const sessionToken = crypto.randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 30); // 30 days from now

      await supabase
        .from('sessions')
        .insert({
          user_id: newUser.id,
          expires: expires.toISOString(),
          session_token: sessionToken,
        });

      console.log("Successfully created new user and account for BlueSky");
      
      return NextResponse.json({
        success: true,
        user: newUser,
        session: {
          user: {
            id: newUser.id,
            name: newUser.name,
            bluesky_id: newUser.bluesky_id,
            bluesky_username: newUser.bluesky_username,
            bluesky_image: newUser.bluesky_image,
            has_onboarded: newUser.has_onboarded,
          },
          expires: expires.toISOString()
        }
      }, {
        headers: {
          'Set-Cookie': `next-auth.session-token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`
        }
      });
    }

    // Return the BlueSky authentication data
    return NextResponse.json({
      did: blueskyData.did,
      handle: blueskyData.handle,
      accessJwt: blueskyData.accessJwt,
      refreshJwt: blueskyData.refreshJwt,
      profile: {
        displayName: profileData.displayName,
        avatar: profileData.avatar
      }
    });

  } catch (error) {
    console.error('Error in BlueSky authentication:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
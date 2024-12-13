import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";
import { auth } from "@/app/auth"
import { authConfig } from "@/app/auth.config";

// Create a single Supabase client for the API route
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: Request) {
  try {
    const session = await auth();
    // console.log('Session:', session);
    const { identifier, password } = await req.json();

    // console.log('Received request:', {
    //   hasIdentifier: !!identifier,
    //   hasPassword: !!password,
    //   hasSession: !!session
    // });

    if (!session?.user?.id) {
      console.log('Session validation failed:', { session });
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!session?.user?.twitter_id) {
      console.log('No Twitter ID in session:', { session });
      return NextResponse.json(
        { error: "Twitter ID not found" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const twitterId = session.user.twitter_id;
    // console.log('Using user ID:', userId);
    // console.log('Using Twitter ID:', twitterId);

    // Authenticate with BlueSky
    try {
      const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'BlueSky authentication failed');
      }

      const blueskyData = await response.json();
      // console.log('BlueSky authentication successful:', {
      //   did: blueskyData.did,
      //   hasAccessJwt: !!blueskyData.accessJwt,
      //   hasRefreshJwt: !!blueskyData.refreshJwt
      // });
      // console.log('BlueSky authentication data:', blueskyData);

      // Récupérer les informations détaillées du profil BlueSky
      const profileResponse = await fetch(`https://bsky.social/xrpc/app.bsky.actor.getProfile?actor=${blueskyData.handle}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${blueskyData.accessJwt}`,
        },
      });

      if (!profileResponse.ok) {
        console.error('Failed to fetch BlueSky profile:', await profileResponse.text());
        throw new Error('Failed to fetch BlueSky profile');
      }

      const profileData = await profileResponse.json();
      console.log('BlueSky detailed profile data:', profileData);

      // Mettre à jour les informations BlueSky dans la table users avec plus de détails
      const { error: userUpdateError } = await supabase
        .schema('next-auth')
        .from('users')
        .update({
          bluesky_id: blueskyData.did,
          bluesky_username: blueskyData.handle,
          bluesky_image: profileData.avatar,
          // bluesky_display_name: profileData.displayName,
          // bluesky_description: profileData.description,
          // bluesky_followers_count: profileData.followersCount,
          // bluesky_follows_count: profileData.followsCount,
          // bluesky_posts_count: profileData.postsCount
        })
        .eq('id', userId);

      if (userUpdateError) {
        console.error('Error updating user BlueSky info:', userUpdateError);
        throw new Error(`Failed to update user BlueSky info: ${userUpdateError.message}`);
      }

      // Mettre à jour la table sources avec le bluesky_id
      const { error: sourcesUpdateError } = await supabase
        .from('sources')
        .update({
          bluesky_id: blueskyData.did,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (sourcesUpdateError) {
        console.error('Error updating sources BlueSky info:', sourcesUpdateError);
        throw new Error(`Failed to update sources BlueSky info: ${sourcesUpdateError.message}`);
      }

      // Check if user already has a BlueSky account
      const { data: existingAccount, error: fetchError } = await supabase
        .schema('next-auth')
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'bluesky')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching existing account:', fetchError);
        throw new Error(`Failed to fetch existing account: ${fetchError.message}`);
      }

      // If an account exists, verify it's the same BlueSky account
      if (existingAccount) {
        if (existingAccount.provider_account_id !== blueskyData.did) {
          console.error('Account mismatch:', {
            existing: existingAccount.provider_account_id,
            new: blueskyData.did
          });
          return NextResponse.json({
            error: "This Twitter account is already linked to a different BlueSky account. Please use the same BlueSky account you used during your first connection."
          }, { status: 400 });
        }

        // Update existing account
        const { error: updateError } = await supabase
          .schema('next-auth')
          .from('accounts')
          .update({
            access_token: blueskyData.accessJwt,
            refresh_token: blueskyData.refreshJwt,
            token_type: 'bearer',
            scope: 'atproto',
            expires_at: null,
            id_token: null,
            session_state: null
          })
          .eq('id', existingAccount.id);

        if (updateError) {
          console.error('Error updating account:', updateError);
          throw new Error(`Failed to update account: ${updateError.message}`);
        }
      } else {
        // Create new account
        const { error: insertError } = await supabase
          .schema('next-auth')
          .from('accounts')
          .insert({
            user_id: userId,
            type: 'oauth',
            provider: 'bluesky',
            provider_account_id: blueskyData.did,
            access_token: blueskyData.accessJwt,
            refresh_token: blueskyData.refreshJwt,
            token_type: 'bearer',
            scope: 'atproto',
            expires_at: null,
            id_token: null,
            session_state: null
          });

        if (insertError) {
          console.error('Error creating account:', insertError);
          throw new Error(`Failed to create account: ${insertError.message}`);
        }
        console.log('Account saved successfully');
      }
      return NextResponse.json({ 
        success: true,
        did: blueskyData.did
      });
    } catch (error) {
      console.error('BlueSky auth error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Authentication failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from "@/app/auth";
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { supabaseAdapter } from "@/lib/supabase-adapter";

// Initialize Supabase client
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


const supabaseAuth = createClient(
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
);


interface TwitterData {
  following?: {
    accountId: string;
    userLink: string;
    name?: string;
    username?: string;
  };
  follower?: {
    accountId: string;
    userLink: string;
    name?: string;
    username?: string;
  };
}

interface UploadData {
  userId: string;
  followers: Array<{ follower: { accountId: string; userLink: string } }>;
  following: Array<{ following: { accountId: string; userLink: string } }>;
}

// Traiter les fichiers en parallèle
const processFiles = async (files: FormDataEntryValue[]) => {
  return Promise.all(
    files.map(async (file) => {
      if (!(file instanceof File)) return null;
      
      const content = await file.text();
      const isFollowing = file.name.toLowerCase().includes('following');
      const prefix = isFollowing
        ? 'window.YTD.following.part0 = '
        : 'window.YTD.follower.part0 = ';

      if (!content.startsWith(prefix)) {
        throw new Error(`Invalid file format: ${file.name}`);
      }

      try {
        const jsonStr = content.substring(prefix.length);
        const data = JSON.parse(jsonStr) as TwitterData[];
        return { type: isFollowing ? 'following' : 'followers', data };
      } catch (error) {
        throw new Error(`Invalid JSON in file: ${file.name}`);
      }
    })
  );
};

export async function POST(request: Request) {
  try {
    // Vérifier la session et le twitter_id
    const session = await auth();

    if (!session?.user?.id) {
      console.log('Session validation failed:', { session });
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!session?.user?.twitter_id && !session?.user?.bluesky_id) {
      console.log('No Twitter ID and No Bluesky ID in session:', { session });
      return NextResponse.json(
        { error: "Twitter ID and Bluesky ID not found" },
        { status: 400 }
      );
    }

    const { error: sourceError } = await supabase
      .from('sources')
      .upsert({
        id: session.user.id,
        twitter_id: session.user.twitter_id || null,
        bluesky_id: session.user.bluesky_id || null,
        username: session.user.name,
        full_name: session.user.name,
        avatar_url: session.user.image,
        updated_at: new Date().toISOString()
      });

    if (sourceError) {
      console.error('[Upload Route] Error creating source:', sourceError);
      return NextResponse.json(
        { error: 'Failed to create source' },
        { status: 500 }
      );
    }

    // Récupérer les données JSON du corps de la requête
    const data = await request.json() as UploadData;
    const { followers, following } = data;

    if (!Array.isArray(followers) || !Array.isArray(following)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    console.log('[Upload Route] Processing data...');

    // D'abord insérer les targets (nécessaire pour la contrainte de clé étrangère)
    if (following.length > 0) {
      const targets = following.map(f => ({
        twitter_id: f.following.accountId,
        username: f.following.accountId, // Utiliser accountId comme username par défaut
        created_at: new Date().toISOString()
      }));

      const { error: targetsError } = await supabase
        .from('targets')
        .upsert(targets);

      if (targetsError) {
        console.error('[Upload Route] Error creating targets:', targetsError);
        return NextResponse.json(
          { error: 'Failed to create targets' },
          { status: 500 }
        );
      }
    }

    // Insérer les followers
    if (followers.length > 0) {
      const followersData = followers.map(f => ({
        twitter_id: f.follower.accountId,
        created_at: new Date().toISOString()
      }));

      const { error: followersError } = await supabase
        .from('followers')
        .upsert(followersData);

      if (followersError) {
        console.error('[Upload Route] Error creating followers:', followersError);
        return NextResponse.json(
          { error: 'Failed to create followers' },
          { status: 500 }
        );
      }
    }

    // Créer les relations sources_targets
    if (following.length > 0) {
      const { error: followingError } = await supabase
        .from('sources_targets')
        .upsert(
          following
            .map(f => f.following)
            .filter(Boolean)
            .map(following => ({
              source_id: session.user.id,
              source_twitter_id: session.user.twitter_id,
              target_twitter_id: following!.accountId,
              created_at: new Date().toISOString()
            }))
        );

      if (followingError) {
        console.error('[Upload Route] Error creating following relationships:', followingError);
        return NextResponse.json(
          { error: 'Failed to create following relationships' },
          { status: 500 }
        );
      }
    }

    // Créer les relations sources_followers
    if (followers.length > 0) {
      const { error: followersRelError } = await supabase
        .from('sources_followers')
        .upsert(
          followers
            .map(f => f.follower)
            .filter(Boolean)
            .map(follower => ({
              source_id: session.user.id,
              follower_id: follower!.accountId,
              created_at: new Date().toISOString()
            }))
        );

      if (followersRelError) {
        console.error('[Upload Route] Error creating follower relationships:', followersRelError);
        return NextResponse.json(
          { error: 'Failed to create follower relationships' },
          { status: 500 }
        );
      }
    }

    // Mettre à jour le statut onboarding de l'utilisateur
    const { error: userUpdateError } = await supabaseAuth
      .from('users')
      .update({ has_onboarded: true })
      .eq('id', session.user.id);

    if (userUpdateError) {
      console.error('Failed to update onboarding status:', userUpdateError);
    }

    console.log('✅ Twitter data saved successfully');

    return NextResponse.json({
      message: 'Upload successful',
      stats: {
        following: following.length,
        followers: followers.length
      }
    });
  } catch (error) {
    console.error('[Upload Route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
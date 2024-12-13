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
    // console.log('Session:', session);

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

    const formData = await request.formData();
    const files = formData.getAll('file');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Process files in parallel
    const processedFiles = await processFiles(files);
    const followings = processedFiles.flatMap((f) => f?.data || []);
    
    console.log('[Upload Route] Processing files...');
    // console.log('Session -->', session);
    // console.log('following -->', followings);

    // D'abord insérer les targets (nécessaire pour la contrainte de clé étrangère)
    if (followings.length > 0) {
      const targets = followings
        .map(f => f.following)
        .filter(Boolean)
        .map(following => ({
          twitter_id: following!.accountId,
          username: following!.username || following!.accountId,
          name: following!.name,
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

    // Ensuite créer les relations sources_targets
    if (followings.length > 0) {
      const { error: followingError } = await supabase
        .from('sources_targets')
        .upsert(
          followings
            .map(f => f.following)
            .filter(Boolean)
            .map(following => ({
              source_id: session.user.id,
              source_twitter_id: session.user.twitter_id || null,
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

    console.log('✅ Twitter data saved successfully');

    // Mise à jour du statut has_onboarded via l'adaptateur
    try {
      await supabaseAdapter.updateUser({
        id: session.user.id,
        has_onboarded: true
      });
      console.log('✅ Onboarding status updated successfully');
    } catch (error) {
      console.error('Failed to update onboarding status:', error);
      return NextResponse.json(
        { 
          error: 'Failed to update onboarding status',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Files processed successfully',
      stats: {
        following: followings.length
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
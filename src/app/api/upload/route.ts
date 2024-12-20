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

// Initialize Supabase client for auth
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

// Nouveau seuil pour le traitement direct
const DIRECT_PROCESSING_THRESHOLD = 1500;
const BATCH_SIZE = 1000;

async function createJobWithBatches(
  userId: string,
  followers: any[],
  following: any[]
) {
  console.log('📋 [Upload Route] Creating main job for user:', userId);
  
  try {
    // Créer d'abord le job principal
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        user_id: userId,
        status: 'pending',
        total_items: followers.length + following.length,
        current_batch: 0
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ [Upload Route] Error creating main job:', jobError);
      throw jobError;
    }

    console.log('✅ [Upload Route] Main job created:', job.id);

    // Créer les lots pour les followers
    console.log(`📦 [Upload Route] Creating ${Math.ceil(followers.length / BATCH_SIZE)} follower batches`);
    for (let i = 0; i < followers.length; i += BATCH_SIZE) {
      const batch = followers.slice(i, i + BATCH_SIZE);
      console.log(`  → Creating follower batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(followers.length / BATCH_SIZE)}`);
      
      const { error } = await supabase
        .from('import_job_batches')
        .insert({
          job_id: job.id,
          batch_number: Math.floor(i / BATCH_SIZE),
          batch_type: 'followers',
          data: batch
        });

      if (error) {
        console.error('❌ [Upload Route] Error creating follower batch:', error);
        // En cas d'erreur, nettoyer le job et ses lots
        await supabase.from('import_jobs').delete().eq('id', job.id);
        throw error;
      }
    }

    // Créer les lots pour les following
    console.log(`📦 [Upload Route] Creating ${Math.ceil(following.length / BATCH_SIZE)} following batches`);
    for (let i = 0; i < following.length; i += BATCH_SIZE) {
      const batch = following.slice(i, i + BATCH_SIZE);
      console.log(`  → Creating following batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(following.length / BATCH_SIZE)}`);
      
      const { error } = await supabase
        .from('import_job_batches')
        .insert({
          job_id: job.id,
          batch_number: Math.floor((followers.length / BATCH_SIZE) + i / BATCH_SIZE),
          batch_type: 'following',
          data: batch
        });

      if (error) {
        console.error('❌ [Upload Route] Error creating following batch:', error);
        // En cas d'erreur, nettoyer le job et ses lots
        await supabase.from('import_jobs').delete().eq('id', job.id);
        throw error;
      }
    }

    console.log('✅ [Upload Route] All batches created successfully');
    return job;

  } catch (error) {
    console.error('❌ [Upload Route] Error in createJobWithBatches:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  console.log('🚀 [Upload Route] Starting upload process');
  
  try {
    // Vérifier la session et le twitter_id
    const session = await auth();
    console.log('👤 [Upload Route] Session check:', { 
      userId: session?.user?.id,
      twitterId: session?.user?.twitter_id,
      blueskyId: session?.user?.bluesky_id 
    });

    if (!session?.user?.id) {
      console.log('❌ [Upload Route] Authentication failed:', { session });
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!session?.user?.twitter_id && !session?.user?.bluesky_id) {
      console.log('❌ [Upload Route] No social IDs found:', { 
        twitterId: session?.user?.twitter_id,
        blueskyId: session?.user?.bluesky_id 
      });
      return NextResponse.json(
        { error: "Twitter ID and Bluesky ID not found" },
        { status: 400 }
      );
    }

    console.log('📝 [Upload Route] Creating/updating source record');
    // Créer la source dans tous les cas
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
      console.error('❌ [Upload Route] Source creation failed:', sourceError);
      return NextResponse.json(
        { error: 'Failed to create source' },
        { status: 500 }
      );
    }

    // Récupérer les données JSON du corps de la requête
    const data = await request.json() as UploadData;
    const { followers, following } = data;
    
    console.log('📊 [Upload Route] Data overview:', {
      followersCount: followers.length,
      followingCount: following.length,
      totalItems: followers.length + following.length
    });

    if (!Array.isArray(followers) || !Array.isArray(following)) {
      console.error('❌ [Upload Route] Invalid data format:', { 
        followersIsArray: Array.isArray(followers),
        followingIsArray: Array.isArray(following)
      });
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const totalItems = followers.length + following.length;
    console.log(`📈 [Upload Route] Total items: ${totalItems}, Threshold: ${DIRECT_PROCESSING_THRESHOLD}`);

    if (totalItems <= DIRECT_PROCESSING_THRESHOLD) {
      console.log('⚡ [Upload Route] Using direct processing');
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

      // Mettre à jour le statut has_onboarded uniquement pour le traitement direct
      const { error: userUpdateError } = await supabaseAuth
        .from('users')
        .update({ has_onboarded: true })
        .eq('id', session.user.id);

      if (userUpdateError) {
        console.error('[Upload Route] Error updating user onboarding status:', userUpdateError);
        return NextResponse.json(
          { error: 'Failed to update user status' },
          { status: 500 }
        );
      }

      console.log('✅ [Upload Route] Direct processing completed successfully');
      return NextResponse.json({
        message: 'Upload successful',
        stats: {
          following: following.length,
          followers: followers.length
        }
      });
    }

    // Pour les gros fichiers, créer un job avec des lots
    console.log('🔄 [Upload Route] Creating job with batches');
    const job = await createJobWithBatches(
      session.user.id,
      followers,
      following
    );

    console.log('✅ [Upload Route] Import job created successfully:', { 
      jobId: job.id,
      totalItems,
      totalBatches: Math.ceil(totalItems / BATCH_SIZE)
    });
    
    return NextResponse.json({
      jobId: job.id,
      message: 'Large import job created successfully',
      totalItems,
      totalBatches: Math.ceil(totalItems / BATCH_SIZE)
    });

  } catch (error) {
    console.error('💥 [Upload Route] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process upload' },
      { status: 500 }
    );
  }
}
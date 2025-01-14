import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Récupérer le total des followers et following
    console.log('Fetching followers and following counts...');
    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from('sources_followers')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('sources_targets')
        .select('*', { count: 'exact', head: true })
    ]);

    console.log('Followers result:', {
      error: followersResult.error,
      count: followersResult.count,
      status: followersResult.status
    });

    console.log('Following result:', {
      error: followingResult.error,
      count: followingResult.count,
      status: followingResult.status
    });

    if (followersResult.error) {
      console.error('Erreur comptage followers:', {
        error: followersResult.error,
        details: followersResult.error.details,
        message: followersResult.error.message,
        hint: followersResult.error.hint
      });
      return NextResponse.json({ error: 'Failed to count followers' }, { status: 500 });
    }

    if (followingResult.error) {
      console.error('Erreur comptage following:', {
        error: followingResult.error,
        details: followingResult.error.details,
        message: followingResult.error.message,
        hint: followingResult.error.hint
      });
      return NextResponse.json({ error: 'Failed to count following' }, { status: 500 });
    }

    // 2. Récupérer le nombre de mappings Bluesky
    console.log('Fetching Bluesky mappings count...');
    const blueSkyMappingsResult = await supabase
      .from('bluesky_mappings')
      .select('*', { count: 'exact', head: true });

    console.log('Bluesky mappings result:', {
      error: blueSkyMappingsResult.error,
      count: blueSkyMappingsResult.count,
      status: blueSkyMappingsResult.status
    });

    if (blueSkyMappingsResult.error) {
      console.error('Erreur comptage bluesky mappings:', {
        error: blueSkyMappingsResult.error,
        details: blueSkyMappingsResult.error.details,
        message: blueSkyMappingsResult.error.message,
        hint: blueSkyMappingsResult.error.hint
      });
      return NextResponse.json({ error: 'Failed to count bluesky mappings' }, { status: 500 });
    }

    // 3. Récupérer le nombre total de sources
    console.log('Fetching sources count...');
    const sourcesResult = await supabase
      .from('sources')
      .select('*', { count: 'exact', head: true });

    console.log('Sources result:', {
      error: sourcesResult.error,
      count: sourcesResult.count,
      status: sourcesResult.status
    });

    if (sourcesResult.error) {
      console.error('Erreur comptage sources:', {
        error: sourcesResult.error,
        details: sourcesResult.error.details,
        message: sourcesResult.error.message,
        hint: sourcesResult.error.hint
      });
      return NextResponse.json({ error: 'Failed to count sources' }, { status: 500 });
    }

    const response = {
      connections: (followersResult.count || 0) + (followingResult.count || 0),
      blueskyMappings: blueSkyMappingsResult.count || 0,
      sources: sourcesResult.count || 0
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erreur générale dans /api/stats/reconnections:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
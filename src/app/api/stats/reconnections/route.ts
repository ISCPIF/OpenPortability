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
    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from('sources_followers')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('sources_targets')
        .select('*', { count: 'exact', head: true })
    ]);

    if (followersResult.error) {
      console.error('Erreur comptage followers:', followersResult.error);
      return NextResponse.json({ error: 'Failed to count followers' }, { status: 500 });
    }

    if (followingResult.error) {
      console.error('Erreur comptage following:', followingResult.error);
      return NextResponse.json({ error: 'Failed to count following' }, { status: 500 });
    }

    // 2. Récupérer le nombre de mappings Bluesky
    const blueSkyMappingsResult = await supabase
      .from('bluesky_mappings')
      .select('*', { count: 'exact', head: true });

    if (blueSkyMappingsResult.error) {
      console.error('Erreur comptage bluesky mappings:', blueSkyMappingsResult.error);
      return NextResponse.json({ error: 'Failed to count bluesky mappings' }, { status: 500 });
    }

    // 3. Récupérer le nombre total de sources
    const sourcesResult = await supabase
      .from('sources')
      .select('*', { count: 'exact', head: true });

    if (sourcesResult.error) {
      console.error('Erreur comptage sources:', sourcesResult.error);
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
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
    const [followersResult, followingResult, targetsWithHandleResult, uniqueSourcesResult] = await Promise.all([
      supabase.rpc('count_followers'),
      supabase.rpc('count_targets'),
      supabase.rpc('count_targets_with_handle'),
      supabase.rpc('count_unique_sources_with_handle')
    ]);

    console.log('Followers result:', followersResult);
    console.log('Following result:', followingResult);
    console.log('Targets with handle result:', targetsWithHandleResult);
    console.log('Unique sources result:', uniqueSourcesResult);

    if (followersResult.error) {
      console.error('Erreur comptage followers:', followersResult.error);
      return NextResponse.json({ error: 'Failed to count followers' }, { status: 501 });
    }

    if (followingResult.error) {
      console.error('Erreur comptage following:', followingResult.error);
      return NextResponse.json({ error: 'Failed to count following' }, { status: 502 });
    }

    // Extraire les comptages des résultats
    const followersCount = followersResult.data?.[0]?.count || 0;
    const followingCount = followingResult.data?.[0]?.count || 0;
    const targetsWithHandleCount = targetsWithHandleResult.data?.[0]?.count || 0;
    const uniqueSourcesCount = uniqueSourcesResult.data?.[0]?.count || 0;

    const response = {
      connections: Number(followersCount) + Number(followingCount),  // Total followers + following
      blueskyMappings: Number(targetsWithHandleCount),  // Nombre de targets avec handle
      sources: Number(uniqueSourcesCount)  // Nombre de sources uniques avec handle
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erreur générale dans /api/stats/reconnections:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
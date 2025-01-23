import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('Début de la requête GET /api/stats/total');
    
    const session = await auth();
    console.log('Session:', session ? 'Authentifié' : 'Non authentifié');
    
    if (!session) {
      console.log('Requête non autorisée - pas de session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer le nombre total de followers
    // console.log('Comptage des followers...');
    const followersResult = await supabase
      .from('sources_followers')
      .select('*', { count: 'exact', head: true });
    
    // console.log('Résultat followers:', {
    //   count: followersResult.count,
    //   error: followersResult.error,
    //   status: followersResult.status
    // });

    if (followersResult.error) {
      console.error('Erreur comptage followers:', followersResult.error);
      return NextResponse.json({ error: 'Failed to count followers' }, { status: 500 });
    }

    // Récupérer le nombre total de following
    // console.log('Comptage des following...');
    const followingResult = await supabase
      .from('sources_targets')
      .select('*', { count: 'exact', head: true });
    
    // console.log('Résultat following:', {
    //   count: followingResult.count,
    //   error: followingResult.error,
    //   status: followingResult.status
    // });

    if (followingResult.error) {
      console.error('Erreur comptage following:', followingResult.error);
      return NextResponse.json({ error: 'Failed to count following' }, { status: 500 });
    }

    // Récupérer le nombre total de sources
    // console.log('Comptage des sources...');
    const sourcesResult = await supabase
      .from('sources')
      .select('*', { count: 'exact', head: true });
    
    // console.log('Résultat sources:', {
    //   count: sourcesResult.count,
    //   error: sourcesResult.error,
    //   status: sourcesResult.status
    // });

    if (sourcesResult.error) {
      console.error('Erreur comptage sources:', sourcesResult.error);
      return NextResponse.json({ error: 'Failed to count sources' }, { status: 500 });
    }

    const response = {
      total_followers: followersResult.count || 0,
      total_following: followingResult.count || 0,
      total_sources: sourcesResult.count || 0
    };

    // console.log('Réponse finale:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Erreur générale dans /api/stats/total:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
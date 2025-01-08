import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from "@/app/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!session?.user?.has_onboarded) {
      return NextResponse.json({
        matchedCount: 0,
        totalUsers: 0,
        following: 0,
        followers: 0
      });
    }

    // Récupérer le nombre total d'utilisateurs connectés
    const { count: totalUsers, error: usersError } = await supabase
      .schema('public')
      .from('sources')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('Erreur lors de la récupération du nombre total d\'utilisateurs:', usersError);
      throw usersError;
    }

    // Récupérer le nombre de following avec count
    const { count: followingCount, error: followingError } = await supabase
      .schema('public')
      .from('sources_targets')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', session.user.id);

    if (followingError) {
      throw followingError;
    }

    // Récupérer le nombre de followers avec count
    const { count: followerCount, error: followerError } = await supabase
      .schema('public')
      .from('sources_followers')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', session.user.id);

    if (followerError) {
      throw followerError;
    }

    return NextResponse.json({
      matchedCount: 0, // Cette valeur n'était pas utilisée dans la logique originale
      totalUsers: totalUsers || 0,
      following: followingCount || 0,
      followers: followerCount || 0
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
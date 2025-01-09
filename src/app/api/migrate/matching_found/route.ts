import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer les correspondances depuis la vue
    const { data: matches, error } = await supabase
      .from('migration_bluesky_view')
      .select('*')
      .eq('user_id', session.user.id)
      .order('relationship_type')

    if (error) {
      console.error('Error fetching matches:', error)
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
    }

    // Grouper les résultats par type de relation
    const grouped = {
      followers: matches.filter(m => m.relationship_type === 'follower'),
      following: matches.filter(m => m.relationship_type === 'following')
    }

    // Calculer les statistiques
    const stats = {
      total_followers: grouped.followers.length,
      matched_followers: grouped.followers.filter(m => m.bluesky_handle).length,
      total_following: grouped.following.length,
      matched_following: grouped.following.filter(m => m.bluesky_handle).length
    }

    return NextResponse.json({
      matches: grouped,
      stats
    })

  } catch (error) {
    console.error('Error in matching_found route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
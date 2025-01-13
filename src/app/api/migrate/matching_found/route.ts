import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch Bluesky matches
    const { data: blueskyMatches, error: blueskyError } = await supabase
      .from('migration_bluesky_view')
      .select('*')
      .eq('user_id', session.user.id)
      .order('relationship_type')

    if (blueskyError) {
      console.error('Error fetching Bluesky matches:', blueskyError)
      return NextResponse.json({ error: 'Failed to fetch Bluesky matches' }, { status: 500 })
    }

    // Fetch Mastodon matches
    const { data: mastodonMatches, error: mastodonError } = await supabase
      .from('twitter_mastodon_users')
      .select('twitter_id, mastodon_username, mastodon_instance')
      .not('mastodon_username', 'is', null)

    if (mastodonError) {
      console.error('Error fetching Mastodon matches:', mastodonError)
      return NextResponse.json({ error: 'Failed to fetch Mastodon matches' }, { status: 500 })
    }

    // Create a map of Mastodon users by twitter_id for easy lookup
    const mastodonMap = new Map(
      mastodonMatches.map(m => [
        m.twitter_id, 
        `${m.mastodon_username}@${m.mastodon_instance}`
      ])
    )

    // Combine Bluesky and Mastodon data
    const combinedMatches = blueskyMatches.map(match => ({
      ...match,
      mastodon_handle: mastodonMap.get(match.twitter_id) || null
    }))

    // Group the results by type of relation
    const grouped = {
      followers: combinedMatches.filter(m => m.relationship_type === 'follower'),
      following: combinedMatches.filter(m => m.relationship_type === 'following')
    }

    // Calculate statistics
    const stats = {
      total_followers: grouped.followers.length,
      matched_followers: grouped.followers.filter(m => m.bluesky_handle || m.mastodon_handle).length,
      total_following: grouped.following.length,
      matched_following: grouped.following.filter(m => m.bluesky_handle || m.mastodon_handle).length,
      bluesky_matches: combinedMatches.filter(m => m.bluesky_handle).length,
      mastodon_matches: combinedMatches.filter(m => m.mastodon_handle).length
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
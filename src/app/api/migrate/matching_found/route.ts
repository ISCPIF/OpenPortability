import { NextResponse } from 'next/server'
import { auth } from '@/app/auth'
import { createClient } from '@supabase/supabase-js'

// import { supabase } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all matches from sources_targets with pagination
    const PAGE_SIZE = 1000
    let allMatches: any[] = []
    let hasMore = true
    let page = 0

    while (hasMore) {
      // console.log(`Fetching page ${page + 1}...`)
      const { data: matches, error: matchesError } = await supabase
        .from('sources_targets')
        .select(`
          target_twitter_id,
          bluesky_handle,
          mastodon_id,
          mastodon_username,
          mastodon_instance,
          has_follow_bluesky,
          has_follow_mastodon
        `)
        .eq('source_id', session.user.id)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (matchesError) {
        console.error('Error fetching matches:', matchesError)
        return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
      }

      // console.log(`Page ${page + 1}: Found ${matches.length} matches`)
      
      if (matches.length < PAGE_SIZE) {
        hasMore = false
        // console.log('No more pages to fetch')
      }

      allMatches = [...allMatches, ...matches]
      // console.log(`Total matches so far: ${allMatches.length}`)
      page++
    }

    // Filter matches with bluesky_handle or mastodon_id
    const filteredMatches = allMatches.filter(match => 
      match.bluesky_handle || match.mastodon_id
    )

    // Map the filtered data
    const combinedMatches = filteredMatches.map(match => ({
      twitter_id: match.target_twitter_id,
      bluesky_handle: match.bluesky_handle,
      mastodon_handle: match.mastodon_id,
      mastodon_username: match.mastodon_username,
      mastodon_instance: match.mastodon_instance,
      has_follow_bluesky: match.has_follow_bluesky || false,
      has_follow_mastodon: match.has_follow_mastodon || false
    }))
// 
    // console.log('Combined matches:', combinedMatches)

    // Calculate statistics
    const stats = {
      total_following: allMatches.length,
      matched_following: filteredMatches.length,
      bluesky_matches: filteredMatches.filter(m => m.bluesky_handle).length,
      mastodon_matches: filteredMatches.filter(m => m.mastodon_id).length
    }

    console.log('Stats:', stats)

    return NextResponse.json({
      matches: {
        following: combinedMatches
      },
      stats
    })

  } catch (error) {
    console.error('Error in matching_found route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
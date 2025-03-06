import { NextResponse } from "next/server"
import { supabase } from '@/lib/supabase'
import logger, { withLogging } from '@/lib/log_utils'

async function mastodonHandler() {
  try {    
    const { data, error } = await supabase
      .from('mastodon_instances')
      .select('instance')
      .order('instance')

    if (error) {
      logger.logError('API', 'GET /api/auth/mastodon', error, undefined, { message: 'Failed to fetch Mastodon instances' })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch Mastodon instances' },
        { status: 500 }
      )
    }

    // Transformation des données pour n'avoir que la liste des instances
    const instances = data.map(item => item.instance)
    return NextResponse.json({
      success: true,
      instances: instances
    })

  } catch (error) {
    logger.logError('API', 'GET /api/auth/mastodon', error, undefined, { message: 'An unexpected error occurred' })
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// Exporter la fonction GET enveloppée par le middleware de logging
export const GET = withLogging(mastodonHandler)
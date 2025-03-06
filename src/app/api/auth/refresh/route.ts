import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { AccountService } from "@/lib/services/accountService"
import { unlinkAccount } from "@/lib/supabase-adapter"
import logger, { withLogging } from '@/lib/log_utils'

async function refreshHandler(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/auth/refresh', 'Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountService = new AccountService()
    const results: { bluesky?: any; mastodon?: any } = {}
    const invalidProviders: string[] = []
    
    // Vérifier Bluesky si l'utilisateur a un compte
    if (session.user.bluesky_username) {
      results.bluesky = await accountService.verifyAndRefreshBlueskyToken(session.user.id)
      if (results.bluesky.requiresReauth) {
        invalidProviders.push('bluesky')
      }
    }

    // Vérifier Mastodon si l'utilisateur a un compte
    if (session.user.mastodon_username) {
      results.mastodon = await accountService.verifyAndRefreshMastodonToken(session.user.id)
      if (results.mastodon.requiresReauth) {
        invalidProviders.push('mastodon')
      }
    }

    // Si aucun compte n'est configuré
    if (!session.user.bluesky_username && !session.user.mastodon_username) {
      return NextResponse.json({ 
        success: false,
        error: 'No social accounts configured'
      })
    }

    // Si des providers nécessitent une réauthentification
    if (invalidProviders.length > 0) {
      logger.logWarning('API', 'POST /api/auth/refresh', 'Reauth required for providers', session.user.id, { providers: invalidProviders })
      return NextResponse.json(
        { 
          success: false,
          error: 'Token refresh failed',
          providers: invalidProviders,
          // ...results
        }, 
        // { status: 401 }
      )
    }

    return NextResponse.json({ 
      success: true,
      ...results 
    })
  } catch (error) {
    logger.logError('API', 'POST /api/auth/refresh', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(refreshHandler)
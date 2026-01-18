import { NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { AccountService } from "@/lib/services/accountService"
import logger from '@/lib/log_utils'
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Schéma vide car cet endpoint n'a pas besoin de données d'entrée
const EmptySchema = z.object({}).strict()

async function refreshHandler(_request: Request, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
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
    let mastodonErrorCode: string | undefined;
    if (session.user.mastodon_username) {
      results.mastodon = await accountService.verifyAndRefreshMastodonToken(session.user.id)
      if (results.mastodon.requiresReauth) {
        invalidProviders.push('mastodon')
        mastodonErrorCode = results.mastodon.errorCode
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
      logger.logWarning('API', 'POST /api/auth/refresh', 'Reauth required for providers', session.user.id, { 
        providers: invalidProviders,
        mastodonErrorCode 
      })
      return NextResponse.json(
        { 
          success: false,
          error: 'Token refresh failed',
          requiresReauth: true,
          providers: invalidProviders,
          errorCode: mastodonErrorCode  // Pass specific error code to frontend
        },
        { status: 401 }
      )
    }

    // Tout s'est bien passé
    console.log("RESULTSSSS")
    console.log(results);
    logger.logInfo('API', 'POST /api/auth/refresh', 'Tokens refreshed successfully', session.user.id)
    return NextResponse.json({ 
      success: true,
      results
    })
  } catch (error) {
    const userId = session?.user?.id || 'unknown'
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'POST /api/auth/refresh', err, userId)
    
    return NextResponse.json(
      { error: 'Failed to refresh tokens' },
      { status: 500 }
    )
  }
}

// Configuration du middleware de validation
export const POST = withValidation(
  EmptySchema,
  refreshHandler,
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider
    skipRateLimit: false
  }
)
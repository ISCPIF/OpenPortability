import { NextRequest, NextResponse } from 'next/server'
import { StatsService } from '@/lib/services/statsServices'
import { pgStatsRepository } from '@/lib/repositories/public/pg-stats-repository'
import logger from '@/lib/log_utils'
import { withValidation } from '@/lib/validation/middleware'
import { z } from 'zod'
import { StatsQueryParamsSchema } from '@/lib/validation/schemas'

// Endpoint GET refactorisé avec le middleware de validation
export const GET = withValidation(
  // Schéma vide car pas de données à valider pour GET
  z.object({}),
  async (request: NextRequest, data: {}, session) => {
    try {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Cas des utilisateurs non-onboarded:
      // - si pas de twitter_id: renvoyer des zéros
      // - si un twitter_id existe: déléguer au StatsService (le repository gère le cache Redis et l'RPC sources)
      if (!session?.user?.has_onboarded) {
        if (!session?.user?.twitter_id) {
          return NextResponse.json({
            connections: {
              followers: 0,
              following: 0,
              totalEffectiveFollowers: 0,
            },
            matches: {
              bluesky: { total: 0, hasFollowed: 0, notFollowed: 0 },
              mastodon: { total: 0, hasFollowed: 0, notFollowed: 0 },
            },
            updated_at: new Date().toISOString(),
          })
        }
      }

      const statsService = new StatsService(pgStatsRepository)

      const stats = await statsService.getUserStats(session.user.id, session.user.has_onboarded)

      console.log("stats from api stats ->", stats)
      return NextResponse.json(stats)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logError('API', 'GET /api/stats', err, session?.user?.id || 'anonymous', {
        context: 'Failed to retrieve user stats',
      })

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider pour GET
    skipRateLimit: true,
    validateQueryParams: true, // Activer explicitement la validation des paramètres d'URL
    queryParamsSchema: StatsQueryParamsSchema, // Utiliser le schéma de validation pour les paramètres d'URL
  }
)
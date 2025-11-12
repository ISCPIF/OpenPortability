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
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const statsService = new StatsService(pgStatsRepository)

      const stats = await statsService.getGlobalStats()

      logger.logInfo('API', 'GET /api/stats/total', 'Retrieved global stats', session.user?.id || 'anonymous', {
        context: 'Global stats retrieved',
      })

      return NextResponse.json(stats)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      logger.logError('API', 'GET /api/stats/total', err, session?.user?.id || 'anonymous', {
        context: 'Failed to retrieve global stats',
      })

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider pour GET
    skipRateLimit: true,
    validateQueryParams: true, // Activer explicitement la validation des paramètres d'URL
    queryParamsSchema: StatsQueryParamsSchema,
  }
);
import { NextRequest, NextResponse } from 'next/server'
import { StatsService } from '@/lib/services/statsServices'
import { pgStatsRepository } from '@/lib/repositories/public/pg-stats-repository'
import logger from '@/lib/log_utils'
import { withPublicValidation } from '@/lib/validation/middleware'
import { z } from 'zod'

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

/**
 * Public endpoint for global stats - no authentication required.
 * Returns aggregated platform statistics for the discover page.
 */
export const GET = withPublicValidation(
  z.object({}),
  async (request: NextRequest) => {
    try {
      const statsService = new StatsService(pgStatsRepository)
      const stats = await statsService.getGlobalStats()

      logger.logInfo('API', 'GET /api/stats/public', 'Retrieved public global stats', 'anonymous', {
        context: 'Public global stats retrieved',
      })

      return NextResponse.json({
        success: true,
        stats: {
          users: stats.users,
          connections: stats.connections,
          updated_at: stats.updated_at,
        }
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      logger.logError('API', 'GET /api/stats/public', err, 'anonymous', {
        context: 'Failed to retrieve public global stats',
      })

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
  {
    applySecurityChecks: false,
    skipRateLimit: false, // Keep rate limiting for public endpoint
  }
);

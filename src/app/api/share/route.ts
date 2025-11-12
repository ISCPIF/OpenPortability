import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/services/userServices'
import { pgShareEventsRepository } from '@/lib/repositories/public/pg-share-events-repository'
import { withValidation } from '@/lib/validation/middleware'
import { ShareEventSchema, type ShareEvent } from '@/lib/validation/schemas'
import logger from '@/lib/log_utils'
import { z } from 'zod'

// Endpoint POST refactorisé avec le middleware de validation
export const POST = withValidation(
  ShareEventSchema,
  async (request: NextRequest, data: ShareEvent, session) => {
    try {
      // Le middleware withValidation a déjà vérifié l'authentification
      // Pas besoin de revérifier session?.user?.id ici

      const shareService = new UserService()
      await shareService.recordShareEvent(session.user.id, data.platform, data.success)

      return NextResponse.json({ success: true })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logError('API', 'POST /api/share', err, session?.user?.id || 'anonymous', {
        context: 'Failed to record share event',
        platform: data.platform,
      })

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: true,
    skipRateLimit: false,
  }
)

// Endpoint GET refactorisé avec le middleware de validation
export const GET = withValidation(
  // Schéma vide car pas de données à valider pour GET
  z.object({}),
  async (request: NextRequest, data: {}, session) => {
    try {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const hasShares = await pgShareEventsRepository.hasShareEvents(session.user.id)

      return NextResponse.json({ hasShares })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.logError('API', 'GET /api/share', err, session?.user?.id || 'anonymous', {
        context: 'Failed to check share status',
      })

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider pour GET
    skipRateLimit: false,
  }
)
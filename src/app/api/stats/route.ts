import { NextRequest, NextResponse } from 'next/server';
import { StatsService } from '@/lib/services/statsServices';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import logger from '@/lib/log_utils';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';

// Endpoint GET refactorisé avec le middleware de validation
export const GET = withValidation(
  // Schéma vide car pas de données à valider pour GET
  z.object({}),
  async (request: NextRequest, data: {}, session) => {
    try {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!session?.user?.has_onboarded) {
        if (!session?.user?.twitter_id) {
          return NextResponse.json({
            connections: {
              followers: 0,
              following: 0
            },
            matches: {
              bluesky: { total: 0, hasFollowed: 0, notFollowed: 0 },
              mastodon: { total: 0, hasFollowed: 0, notFollowed: 0 }
            }
          });
        }
      }

      const repository = new StatsRepository();
      const statsService = new StatsService(repository);
      
      const stats = await statsService.getUserStats(session.user.id, session.user.has_onboarded);
      
      logger.logInfo('API', 'GET /api/stats', `Retrieved stats for user ${session.user.id}`, session.user.id, {
        context: 'User stats retrieved'
      });
      
      return NextResponse.json(stats);
    } catch (error) {
      logger.logError('API', 'GET /api/stats', error, session?.user?.id || 'anonymous', {
        context: 'Failed to retrieve user stats'
      });
      
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider pour GET
    skipRateLimit: false,
    validateQueryParams: true // Activer explicitement la validation des paramètres d'URL
  }
);
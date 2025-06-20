import { NextRequest, NextResponse } from 'next/server';
import { StatsService } from '@/lib/services/statsServices';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import logger from '@/lib/log_utils';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import { StatsQueryParamsSchema } from '@/lib/validation/schemas';

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

      // Récupérer les paramètres d'URL validés
      const url = new URL(request.url);
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;
      
      const repository = new StatsRepository();
      const statsService = new StatsService(repository);
      
      const stats = await statsService.getUserStats(session.user.id, session.user.has_onboarded, limit);
      
      console.log('API', 'GET /api/stats', `Retrieved stats for user ${session.user.id}`, session.user.id, {
        context: 'User stats retrieved',
        limit
      });
      
      return NextResponse.json(stats);
    } catch (error) {
      console.log('API', 'GET /api/stats', error, session?.user?.id || 'anonymous', {
        context: 'Failed to retrieve user stats'
      });
      
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider pour GET
    skipRateLimit: true,
    validateQueryParams: true, // Activer explicitement la validation des paramètres d'URL
    queryParamsSchema: StatsQueryParamsSchema // Utiliser le schéma de validation pour les paramètres d'URL
  }
);
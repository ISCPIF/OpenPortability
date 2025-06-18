import { NextResponse } from 'next/server';
import { MatchingService } from '@/lib/services/matchingService';
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Schéma vide car cet endpoint n'a pas besoin de données d'entrée
const EmptySchema = z.object({}).strict()

async function matchingFoundHandler(_request: Request, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
    if (!session?.user?.id) {
      console.log('API', 'GET /api/migrate/matching_found', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const matchingService = new MatchingService();
    let result;

    if (!session.user?.has_onboarded) {
      if (!session?.user?.twitter_id) {
        console.log('API', 'GET /api/migrate/matching_found', 'Twitter ID not found in session', session.user.id);
        return NextResponse.json(
          { error: 'Twitter ID not found in session' },
          { status: 400 }
        );
      }
      result = await matchingService.getSourcesFromFollower(session.user.twitter_id);
    } else {
      result = await matchingService.getFollowableTargets(session.user.id);
    }
    
    console.log('API', 'GET /api/migrate/matching_found', 'Matches retrieved successfully', session.user.id, {
      matchCount: result?.length || 0
    });
    
    return NextResponse.json({ matches: result });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    console.log('API', 'GET /api/migrate/matching_found', error, userId, {
      context: 'Error in matching_found route'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
export const GET = withValidation(
  EmptySchema,
  matchingFoundHandler,
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider
    skipRateLimit: false
  }
)
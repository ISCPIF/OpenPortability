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
      logger.logError('API', 'GET /api/migrate/matching_found', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const matchingService = new MatchingService();
    let result;

    if (!session.user?.has_onboarded) {
      if (!session?.user?.twitter_id) {
        logger.logError('API', 'GET /api/migrate/matching_found', 'Twitter ID not found in session', session.user.id);
        return NextResponse.json(
          { error: 'Twitter ID not found in session' },
          { status: 400 }
        );
      }
      // CORRIGÉ: Convertir en string pour éviter la perte de précision JavaScript
      const twitterIdString = session.user.twitter_id.toString();
      result = await matchingService.getSourcesFromFollower(twitterIdString);
    } else {
      result = await matchingService.getFollowableTargets(session.user.id);
    }
    
    // Adapter le format de réponse selon le type de résultat
    const responseData = (result && (result as any).following) ? {
      // Si result a une propriété 'following', on retourne la structure complète
      matches: result
    } : {
      // Si result est un tableau direct, on l'encapsule dans un objet avec 'following'
      matches: {
        following: Array.isArray(result) ? result : [],
        stats: {
          total_following: Array.isArray(result) ? result.length : 0,
          matched_following: Array.isArray(result) ? result.length : 0,
          bluesky_matches: 0,
          mastodon_matches: 0
        }
      }
    };
    
    return NextResponse.json(responseData);

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'GET /api/migrate/matching_found', err, userId, {
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
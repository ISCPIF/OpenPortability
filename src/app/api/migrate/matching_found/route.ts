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
      
      // Normaliser le format MatchedFollower[] vers MatchingTarget[]
      // pour que FloatingAccountsPanel puisse afficher les comptes
      if (result?.following) {
        result.following = result.following.map((item: any) => ({
          // Normaliser node_id (peut être source_twitter_id pour non-onboarded)
          node_id: item.node_id || item.source_twitter_id?.toString() || '',
          bluesky_handle: item.bluesky_handle || null,
          mastodon_handle: item.mastodon_handle || null,
          mastodon_username: item.mastodon_username || null,
          mastodon_instance: item.mastodon_instance || null,
          mastodon_id: item.mastodon_id || null,
          // Normaliser les flags de follow (différents noms selon le type)
          has_follow_bluesky: item.has_follow_bluesky ?? item.has_been_followed_on_bluesky ?? false,
          has_follow_mastodon: item.has_follow_mastodon ?? item.has_been_followed_on_mastodon ?? false,
          // Include followed_at timestamps to distinguish "never tried" from "tried and failed"
          followed_at_bluesky: item.followed_at_bluesky || null,
          followed_at_mastodon: item.followed_at_mastodon || null,
          dismissed: item.dismissed ?? false,
        }));
      }
    } else {
      result = await matchingService.getFollowableTargets(session.user.id);
      console.log("Matching found: ",result.following.length);
    }
    
    // Retourner le résultat normalisé
    const responseData = {
      matches: result || {
        following: [],
        stats: {
          total_following: 0,
          matched_following: 0,
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
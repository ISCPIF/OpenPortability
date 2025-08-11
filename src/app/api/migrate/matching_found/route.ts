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
      // CORRIGÉ: Convertir en string pour éviter la perte de précision JavaScript
      const twitterIdString = session.user.twitter_id.toString();
      // console.log(`[API] Converting Twitter ID: ${session.user.twitter_id} (${typeof session.user.twitter_id}) → "${twitterIdString}" (${typeof twitterIdString})`);
      result = await matchingService.getSourcesFromFollower(twitterIdString);
    } else {
      result = await matchingService.getFollowableTargets(session.user.id);
    }
    
    // console.log("********")
    // console.log(result)
    // console.log('API', 'GET /api/migrate/matching_found', 'Matches retrieved successfully', session.user.id, {
    //   matchCount: result?.following?.length || result?.length || 0
    // });
    
    // Adapter le format de réponse selon le type de résultat
    const responseData = result?.following ? {
      // Si result a une propriété 'following', on retourne la structure complète
      matches: result
    } : {
      // Si result est un tableau direct, on l'encapsule dans un objet avec 'following'
      matches: {
        following: result || [],
        stats: {
          total_following: result?.length || 0,
          matched_following: result?.length || 0,
          bluesky_matches: 0,
          mastodon_matches: 0
        }
      }
    };
    

    // console.log("===== DEBUG API RESPONSE =====")
    // console.log("Original result:", JSON.stringify(result, null, 2))
    // console.log("result?.following exists:", !!result?.following)
    // console.log("result?.following length:", result?.following?.length || 'N/A')
    // console.log("Final responseData:", JSON.stringify(responseData, null, 2))
    // console.log("responseData.matches.following length:", responseData?.matches?.following?.length || 'N/A')
    // console.log("===============================")
    
    return NextResponse.json(responseData);

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
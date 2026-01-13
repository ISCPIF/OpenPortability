import { NextResponse } from 'next/server';
import { pgGraphNodesRepository } from '@/lib/repositories/public/pg-graph-nodes-repository';
import { pgMatchingRepository } from '@/lib/repositories/public/pg-matching-repository';
import { redisMatchingRepository } from '@/lib/repositories/redis-matching-repository';
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Schéma vide car cet endpoint n'a pas besoin de données d'entrée
const EmptySchema = z.object({}).strict()

/**
 * GET /api/graph/followings-hashes
 * 
 * Retourne les hashes (coordonnées) des nœuds du réseau personnel de l'utilisateur
 * qui sont présents dans le graphe. Utilisé pour le highlighting côté client
 * sans exposer les twitter_ids (RGPD-friendly).
 * 
 * Response:
 * {
 *   success: true,
 *   followingHashes: string[],  // Hashes des followings dans le graphe
 *   userNode: { x, y, label, community, tier, degree } | null,  // User's node if in graph
 *   stats: {
 *     followingsInGraph: number,
 *   }
 * }
 */
async function personalHashesHandler(_request: Request, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
    if (!session?.user?.id) {
      logger.logError('API', 'GET /api/graph/followings-hashes', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const hasOnboarded = session.user?.has_onboarded ?? false;
    const twitterId = session.user?.twitter_id?.toString();

    console.log(
      '📊 [personal-hashes] Fetching for user',
      userId,
      { hasOnboarded, hasTwitterId: !!twitterId }
    );

    let followingHashes: { coord_hash: string; has_follow_bluesky: boolean; has_follow_mastodon: boolean; has_matching: boolean }[] = [];
    let userNode: { x: number; y: number; label: string | null; community: number | null; tier: string | null; degree: number } | null = null;

    // Get user's own node from graph if they have a twitter_id
    if (twitterId) {
      const node = await pgGraphNodesRepository.getNodeByTwitterId(twitterId);
      if (node) {
        userNode = {
          x: node.x,
          y: node.y,
          label: node.label,
          community: node.community,
          tier: node.tier,
          degree: node.degree,
        };
        console.log('📊 [personal-hashes] Found user node at', node.x, node.y);
      }
    }

    // Get following hashes directly using optimized single DB calls
    if (hasOnboarded) {
      // Onboarded user: single query with JOIN (optimized) - includes follow status and node_id
      const { data: hashes } = await pgMatchingRepository.getFollowingHashesForOnboardedUser(userId);
      
      if (hashes && hashes.length > 0) {
        // Get all node_ids to check for matching in Redis
        const nodeIds = hashes.map(h => h.node_id);
        const matchingMap = await redisMatchingRepository.getHandlesFromTwitterIds(nodeIds);
        
        // Enrich with matching status
        followingHashes = hashes.map(h => ({
          coord_hash: h.coord_hash,
          has_follow_bluesky: h.has_follow_bluesky,
          has_follow_mastodon: h.has_follow_mastodon,
          has_matching: matchingMap.has(h.node_id) && (
            !!matchingMap.get(h.node_id)?.bluesky || 
            !!matchingMap.get(h.node_id)?.mastodon
          ),
        }));
        
        const matchingCount = followingHashes.filter(h => h.has_matching).length;
        console.log('📊 [personal-hashes] Enriched with matching status:', matchingCount, '/', hashes.length, 'have matching');
      }
    } else if (twitterId) {
      // Non-onboarded user: use RPC function for single DB call
      // These users don't have sources_targets entries yet, so no follow status
      const { data: hashes } = await pgMatchingRepository.getFollowingHashesForFollower(twitterId);
      // Convert string[] to objects with default false for follow status
      // For non-onboarded users, we don't have node_ids so we can't check matching
      followingHashes = (hashes || []).map(coord_hash => ({
        coord_hash,
        has_follow_bluesky: false,
        has_follow_mastodon: false,
        has_matching: false, // Unknown for non-onboarded users
      }));
    }

    console.log(
      '📊 [personal-hashes] Returning',
      followingHashes.length,
      'following hashes for user',
      userId,
      userNode ? '(with user node)' : '(no user node)'
    );

    const response = {
      success: true,
      followingHashes,
      userNode,
      timestamp: Date.now(), // Server timestamp for cache validation
      stats: {
        followingsInGraph: followingHashes.length,
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'GET /api/graph/followings-hashes', err, userId, {
      context: 'Error in personal-hashes route'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
export const GET = withValidation(
  EmptySchema,
  personalHashesHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false
  }
)

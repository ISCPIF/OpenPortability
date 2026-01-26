import { NextResponse } from 'next/server';
import { pgGraphNodesRepository } from '@/lib/repositories/public/pg-graph-nodes-repository';
import { pgMatchingRepository } from '@/lib/repositories/public/pg-matching-repository';
import { redisMatchingRepository } from '@/lib/repositories/redis-matching-repository';
import { queryPublic } from '@/lib/database';
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Schéma vide car cet endpoint n'a pas besoin de données d'entrée
const EmptySchema = z.object({}).strict()

// Limit for floating labels (too many causes performance issues)
const MAX_FOLLOWINGS_FLOATING_LABELS = 3000;

// Helper to create coordinate hash (same format as used elsewhere)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

interface FollowingLabelData {
  coord_hash: string;
  x: number;
  y: number;
  source_twitter_id: string;
  source_twitter_username: string | null;
  has_follow_bluesky?: boolean;
  has_follow_mastodon?: boolean;
}

/**
 * GET /api/graph/followings-labels
 * 
 * Retourne les labels flottants pour le mode Followings (réseau personnel).
 * Fallback: twitter_username → bluesky_username → mastodon_username
 * 
 * Response (RGPD-friendly - no twitter_id exposed):
 * {
 *   success: true,
 *   labelMap: Record<coord_hash, string>,
 *   floatingLabels: Array<{ coord_hash, x, y, text, priority, level }>,
 *   count: number,
 *   source: { onboarded: boolean }
 * }
 */
async function followingsLabelsHandler(_request: Request, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
    if (!session?.user?.id) {
      logger.logError('API', 'GET /api/graph/followings-labels', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const hasOnboarded = session.user?.has_onboarded ?? false;
    const twitterId = session.user?.twitter_id?.toString();

    console.log(
      '🏷️ [followings-labels] Fetching for user',
      userId,
      { hasOnboarded, hasTwitterId: !!twitterId }
    );

    let followingsData: FollowingLabelData[] = [];

    if (hasOnboarded) {
      // Onboarded user: use sources_targets + graph_nodes
      const { data: hashes } = await pgMatchingRepository.getFollowingHashesForOnboardedUser(userId);
      
      if (hashes && hashes.length > 0) {
        // Get node coordinates from graph_nodes for each node_id
        const nodeIds = hashes.map(h => h.node_id);
        const nodesArray = await pgGraphNodesRepository.getNodesByTwitterIds(nodeIds);

        const nodeIdsBigInt = nodeIds
          .filter((id) => /^\d+$/.test(id))
          .map((id) => BigInt(id));

        const displayLabelMap = new Map<string, string>();
        if (nodeIdsBigInt.length > 0) {
          const labelResult = await queryPublic(
            `SELECT
               gn.id::text as twitter_id,
               COALESCE(
                 uwnc.name,
                 CASE WHEN uwnc.twitter_username IS NOT NULL THEN '@' || uwnc.twitter_username ELSE NULL END,
                 CASE WHEN pa.twitter_username IS NOT NULL THEN '@' || pa.twitter_username ELSE NULL END,
                 pa.name
               ) as display_label
             FROM public.graph_nodes_03_11_25 gn
             LEFT JOIN public.users_with_name_consent uwnc
               ON uwnc.twitter_id = gn.id
              AND uwnc.consent_level = 'all_consent'
             LEFT JOIN public.public_accounts pa
               ON pa.twitter_id = gn.id
             WHERE gn.id = ANY($1::bigint[])`,
            [nodeIdsBigInt]
          );
          for (const row of labelResult.rows as any[]) {
            if (row?.twitter_id && row?.display_label) {
              displayLabelMap.set(String(row.twitter_id), String(row.display_label));
            }
          }
        }
        
        // Convert array to Map for O(1) lookup
        const nodesMap = new Map<string, { x: number; y: number; label: string | null }>();
        for (const node of nodesArray) {
          nodesMap.set(node.id, { x: node.x, y: node.y, label: node.label });
        }
        
        // Build followingsData with coordinates
        for (const h of hashes) {
          const nodeInfo = nodesMap.get(h.node_id);
          if (nodeInfo) {
            const resolvedLabel = displayLabelMap.get(h.node_id) || null;
            followingsData.push({
              coord_hash: h.coord_hash,
              x: nodeInfo.x,
              y: nodeInfo.y,
              source_twitter_id: h.node_id,
              source_twitter_username: resolvedLabel,
              has_follow_bluesky: h.has_follow_bluesky,
              has_follow_mastodon: h.has_follow_mastodon,
            });
          }
        }
      }
    } else if (twitterId) {
      // Non-onboarded user: use new RPC get_followed_sources_for_follower
      const { data: sources } = await pgMatchingRepository.getFollowedSourcesForFollower(twitterId);
      
      if (sources && sources.length > 0) {
        followingsData = sources.map((s: { coord_hash: string; x: number; y: number; source_twitter_id: string; source_twitter_username: string | null }) => ({
          coord_hash: s.coord_hash,
          x: s.x,
          y: s.y,
          source_twitter_id: s.source_twitter_id,
          source_twitter_username: s.source_twitter_username,
          has_follow_bluesky: false,
          has_follow_mastodon: false,
        }));
      }
    }

    console.log('🏷️ [followings-labels] Found', followingsData.length, 'followings with coordinates');

    if (followingsData.length === 0) {
      return NextResponse.json({
        success: true,
        labelMap: {},
        floatingLabels: [],
        count: 0,
        source: { onboarded: hasOnboarded }
      }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    // Get handles from Redis for fallback labels
    const twitterIds = followingsData.map(f => f.source_twitter_id);
    const matchingMap = await redisMatchingRepository.getHandlesFromTwitterIds(twitterIds);

    // Build labels with fallback logic: twitter_username → bluesky → mastodon
    const labelMap: Record<string, string> = {};
    const floatingLabels: { coord_hash: string; x: number; y: number; text: string; priority: number; level: number }[] = [];

    for (const f of followingsData) {
      let label: string | null = null;
      let priority = 50; // Default priority

      // Priority 1: twitter_username from graph_nodes
      if (f.source_twitter_username) {
        const raw = f.source_twitter_username.trim();
        label = raw.startsWith('@') || raw.includes(' ') ? raw : `@${raw}`;
        priority = 80;
      }

      // Priority 2: bluesky_username from Redis matching
      if (!label) {
        const handles = matchingMap.get(f.source_twitter_id);
        if (handles?.bluesky?.username) {
          label = handles.bluesky.username.startsWith('@') 
            ? handles.bluesky.username 
            : `@${handles.bluesky.username}`;
          priority = 70;
        } else if (handles?.mastodon?.username) {
          // Priority 3: mastodon_username from Redis matching
          const mastoHandle = `@${handles.mastodon.username}@${handles.mastodon.instance}`;
          label = mastoHandle;
          priority = 60;
        }
      }

      // Skip if no label found
      if (!label) continue;

      // Boost priority if already followed
      if (f.has_follow_bluesky || f.has_follow_mastodon) {
        priority += 10;
      }

      labelMap[f.coord_hash] = label;
      floatingLabels.push({
        coord_hash: f.coord_hash,
        x: f.x,
        y: f.y,
        text: label,
        priority,
        level: 0,
      });
    }

    // Sort by priority (descending) and limit
    floatingLabels.sort((a, b) => b.priority - a.priority);
    const limitedLabels = floatingLabels.slice(0, MAX_FOLLOWINGS_FLOATING_LABELS);

    // Rebuild labelMap with only limited labels
    const limitedLabelMap: Record<string, string> = {};
    for (const l of limitedLabels) {
      limitedLabelMap[l.coord_hash] = l.text;
    }

    console.log(
      '🏷️ [followings-labels] Returning',
      limitedLabels.length,
      'labels for user',
      userId,
      `(${floatingLabels.length} total before limit)`
    );

    return NextResponse.json({
      success: true,
      labelMap: limitedLabelMap,
      floatingLabels: limitedLabels,
      count: limitedLabels.length,
      source: { onboarded: hasOnboarded }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'GET /api/graph/followings-labels', err, userId, {
      context: 'Error in followings-labels route'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
export const GET = withValidation(
  EmptySchema,
  followingsLabelsHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false
  }
)

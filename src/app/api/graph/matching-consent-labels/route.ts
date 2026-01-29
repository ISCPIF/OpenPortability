import { NextResponse } from 'next/server';
import { queryPublic } from '@/lib/database';
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

// Schéma vide car cet endpoint n'a pas besoin de données d'entrée
const EmptySchema = z.object({}).strict()

// Limit for floating labels (too many causes performance issues)
const MAX_MATCHING_CONSENT_LABELS = 3000;

// Helper to create coordinate hash (same format as used elsewhere)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

/**
 * GET /api/graph/matching-consent-labels
 * 
 * Retourne les labels flottants pour le mode Followings (réseau personnel).
 * UNIQUEMENT pour les comptes qui:
 * 1. Sont dans sources_targets (matchings de l'utilisateur)
 * 2. ET ont un twitter_id dans users_with_name_consent (consentement donné)
 * 
 * Fallback label: name → twitter_username → bluesky_username → mastodon_username
 * 
 * Response (RGPD-friendly - no twitter_id exposed):
 * {
 *   success: true,
 *   labelMap: Record<coord_hash, string>,
 *   floatingLabels: Array<{ coord_hash, x, y, text, priority, level }>,
 *   count: number
 * }
 */
async function matchingConsentLabelsHandler(_request: Request, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
    if (!session?.user?.id) {
      logger.logError('API', 'GET /api/graph/matching-consent-labels', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    console.log('🏷️ [matching-consent-labels] Fetching for user', userId);

    // Single query: join sources_targets + users_with_name_consent + graph_nodes
    // Only returns matchings that have consent
    const result = await queryPublic(
      `SELECT 
         st.node_id::text as node_id,
         COALESCE(
           uwc.name,
           CASE WHEN uwc.twitter_username IS NOT NULL THEN '@' || uwc.twitter_username ELSE NULL END,
           CASE WHEN uwc.bluesky_username IS NOT NULL THEN '@' || uwc.bluesky_username ELSE NULL END,
           CASE WHEN uwc.mastodon_username IS NOT NULL THEN '@' || uwc.mastodon_username || '@' || uwc.mastodon_instance ELSE NULL END
         ) as display_label,
         gn.x,
         gn.y,
         gn.degree,
         COALESCE(st.has_follow_bluesky, false) as has_follow_bluesky,
         COALESCE(st.has_follow_mastodon, false) as has_follow_mastodon
       FROM public.sources_targets st
       INNER JOIN public.users_with_name_consent uwc ON st.node_id = uwc.twitter_id
       INNER JOIN public.graph_nodes_03_11_25 gn ON st.node_id = gn.id
       WHERE st.source_id = $1
       ORDER BY gn.degree DESC NULLS LAST
       LIMIT $2`,
      [userId, MAX_MATCHING_CONSENT_LABELS]
    );

    const rows = result.rows as Array<{
      node_id: string;
      display_label: string | null;
      x: number;
      y: number;
      degree: number | null;
      has_follow_bluesky: boolean;
      has_follow_mastodon: boolean;
    }>;

    console.log('🏷️ [matching-consent-labels] Found', rows.length, 'matchings with consent');

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        labelMap: {},
        floatingLabels: [],
        count: 0
      }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    // Build labels
    const labelMap: Record<string, string> = {};
    const floatingLabels: { coord_hash: string; x: number; y: number; text: string; priority: number; level: number }[] = [];

    for (const row of rows) {
      // Skip if no label
      if (!row.display_label) continue;

      const hash = coordHash(row.x, row.y);
      
      // Priority based on degree and follow status
      let priority = 50;
      if (row.degree && row.degree > 100) priority = 80;
      else if (row.degree && row.degree > 50) priority = 70;
      else if (row.degree && row.degree > 20) priority = 60;
      
      // Boost priority if already followed
      if (row.has_follow_bluesky || row.has_follow_mastodon) {
        priority += 10;
      }

      labelMap[hash] = row.display_label;
      floatingLabels.push({
        coord_hash: hash,
        x: row.x,
        y: row.y,
        text: row.display_label,
        priority,
        level: 0,
      });
    }

    // Sort by priority (descending)
    floatingLabels.sort((a, b) => b.priority - a.priority);

    console.log(
      '🏷️ [matching-consent-labels] Returning',
      floatingLabels.length,
      'labels for user',
      userId
    );

    return NextResponse.json({
      success: true,
      labelMap,
      floatingLabels,
      count: floatingLabels.length
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'GET /api/graph/matching-consent-labels', err, userId, {
      context: 'Error in matching-consent-labels route'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation
export const GET = withValidation(
  EmptySchema,
  matchingConsentLabelsHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false
  }
)

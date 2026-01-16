import { NextResponse } from 'next/server';
import { pgGraphNodesRepository } from '@/lib/repositories/public/pg-graph-nodes-repository';
import logger from '@/lib/log_utils';
import { withValidation, withPublicValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import { auth } from '@/app/auth';
import { redis } from '@/lib/redis';
import { publishLabelsUpdate, publishNodeTypeChanges } from '@/lib/sse-publisher';

// Redis keys for node_type changes sync
const NODE_TYPE_CHANGES_KEY = 'graph:node-type-changes';
const NODE_TYPE_VERSION_KEY = 'graph:node-type-version';
const NODE_TYPE_CHANGES_TTL = 3600; // 1 hour

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 1 minute (shorter than names_labels since it's user-specific)

// Helper to create coordinate hash (same format as used elsewhere)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

// Limit for floating labels (too many causes performance issues)
const MAX_FLOATING_LABELS = 5000;

// Empty schema for GET request
const EmptySchema = z.object({}).strict();

/**
 * GET /api/graph/consent_labels
 * 
 * Returns labels based on user consent levels:
 * - For authenticated users: all_consent labels + followers_of_followers labels (if user is in their network)
 * - For non-authenticated users: only all_consent labels
 * 
 * Response format matches /api/graph/names_labels for easy switching
 */
async function getConsentLabelsHandler() {
  try {
    // Check if user is authenticated
    const session = await auth();
    const userId = session?.user?.id;
    const twitterId = session?.user?.twitter_id;

    let rows: {
      node_id: string;
      display_label: string;
      x: number;
      y: number;
      consent_level?: string;
      visibility_reason?: string;
      follower_level?: number;
    }[];

    if (userId) {
      // Authenticated user: get personalized visible labels from RPC function
      console.log(`[consent_labels] Fetching for user ${userId} (twitter_id: ${twitterId})`);
      
      rows = await pgGraphNodesRepository.getVisibleLabelsForUser(userId, twitterId);
      
      console.log(`[consent_labels] Repository returned ${rows.length} rows for authenticated user`);
      if (rows.length > 0) {
        console.log(`[consent_labels] First row:`, JSON.stringify(rows[0]));
      }
    } else {
      // Non-authenticated user: get only public (all_consent) labels
      console.log(`[consent_labels] Fetching public consent labels (no auth)`);
      
      rows = await pgGraphNodesRepository.getPublicConsentLabels();
      
      console.log(`[consent_labels] Repository returned ${rows.length} rows for public user`);
      if (rows.length > 0) {
        console.log(`[consent_labels] First row:`, JSON.stringify(rows[0]));
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        labelMap: {},
        floatingLabels: [],
        count: 0,
        authenticated: !!userId
      });
    }

    // Build a mapping object: coord_hash -> display_label (no twitter_id for RGPD)
    const labelMap: Record<string, string> = {};
    for (const row of rows) {
      const hash = coordHash(row.x, row.y);
      labelMap[hash] = row.display_label;
    }
    
    // For floating labels, use follower_level as priority (lower = more important)
    // Take top N labels
    const sortedRows = [...rows].slice(0, MAX_FLOATING_LABELS);
    
    // Build floating labels array (with coord_hash instead of node_id for RGPD)
    const floatingLabels = sortedRows.map(row => ({
      coord_hash: coordHash(row.x, row.y),
      x: row.x,
      y: row.y,
      text: row.display_label,
      priority: row.follower_level === 1 ? 80 : 50, // Direct followers have higher priority
      level: 0,
    }));

    logger.logDebug(
      'API',
      'GET /api/graph/consent_labels',
      `Returning ${rows.length} consent labels mapping + ${floatingLabels.length} floating labels (auth: ${!!userId})`,
      'system'
    );

    return NextResponse.json({
      success: true,
      labelMap,
      floatingLabels,
      count: rows.length,
      authenticated: !!userId
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError('API', 'GET /api/graph/consent_labels', err, 'system', {
      context: 'Error fetching consent labels'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configuration du middleware de validation (public endpoint but with optional auth)
export const GET = withPublicValidation(
  EmptySchema,
  getConsentLabelsHandler,
  {
    applySecurityChecks: false,
    skipRateLimit: false
  }
);

// Schema for POST request to update consent
const UpdateConsentSchema = z.object({
  consent_level: z.enum(['no_consent', 'only_to_followers_of_followers', 'all_consent'])
});

/**
 * POST /api/graph/consent_labels
 * 
 * Updates the user's label consent preference
 * Requires authentication
 */
async function updateConsentLabelsHandler(
  request: Request,
  validatedData: z.infer<typeof UpdateConsentSchema>,
  session: any
) {
  try {
    const userId = session?.user?.id;
    const twitterId = session?.user?.twitter_id;

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get metadata for audit
    const ip_address = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const user_agent = request.headers.get('user-agent') || undefined;

    logger.logInfo(
      'API',
      'POST /api/graph/consent_labels',
      `Updating consent to ${validatedData.consent_level}`,
      userId
    );

    const result = await pgGraphNodesRepository.updateNameConsent(
      userId,
      validatedData.consent_level,
      { ip_address, user_agent }
    );

    // Record node_type change for cross-client sync
    // Get user's coord_hash from graph_nodes to broadcast the change
    if (twitterId) {
      try {
        const nodeInfo = await pgGraphNodesRepository.getNodeCoordHashByTwitterId(twitterId);
        if (nodeInfo?.coord_hash) {
          const newNodeType = validatedData.consent_level === 'no_consent' ? 'generic' : 'member';
          const now = Date.now();
          
          const change = JSON.stringify({
            coord_hash: nodeInfo.coord_hash,
            node_type: newNodeType,
            timestamp: now,
          });
          
          // Record change in Redis for other clients to pick up
          await Promise.all([
            redis.lpush(NODE_TYPE_CHANGES_KEY, change),
            redis.set(NODE_TYPE_VERSION_KEY, now.toString()),
            redis.expire(NODE_TYPE_CHANGES_KEY, NODE_TYPE_CHANGES_TTL),
          ]);
          
          // Publish SSE event for real-time updates to all connected clients
          await publishNodeTypeChanges([{
            coord_hash: nodeInfo.coord_hash,
            node_type: newNodeType,
          }]);
          
          logger.logInfo(
            'API',
            'POST /api/graph/consent_labels',
            `Recorded node_type change: ${nodeInfo.coord_hash} → ${newNodeType}`,
            userId
          );
        }
      } catch (nodeError) {
        // Don't fail the request if we can't record the change
        logger.logWarning(
          'API',
          'POST /api/graph/consent_labels',
          `Failed to record node_type change: ${nodeError instanceof Error ? nodeError.message : String(nodeError)}`,
          userId
        );
      }
    }

    return NextResponse.json({
      success: true,
      consent_level: result.consent_level,
      message: `Consent updated to ${result.consent_level}`
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError('API', 'POST /api/graph/consent_labels', err, 'system', {
      context: 'Error updating consent labels'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST requires authentication
export const POST = withValidation(
  UpdateConsentSchema,
  updateConsentLabelsHandler,
  {
    requireAuth: true,
    applySecurityChecks: true,
    skipRateLimit: false
  }
);

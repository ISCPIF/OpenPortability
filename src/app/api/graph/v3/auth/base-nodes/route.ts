import { NextRequest, NextResponse } from 'next/server';
import { withValidation } from '@/lib/validation/middleware';
import { pgMatchingRepository } from '@/lib/repositories/public/pg-matching-repository';
import { pgGraphNodesRepository } from '@/lib/repositories/public/pg-graph-nodes-repository';
import logger from '@/lib/log_utils';
import { z } from 'zod';

const MOSAIC_BASE_URL =
  process.env.DUCKDB_MOSAIC_BASE_URL ?? 'http://duckdb-server:8765';
const DUCKDB_API_KEY = process.env.DUCKDB_API_KEY ?? '';

// Current graph version - update when deploying new graph data
const GRAPH_VERSION = '03_11_25';

// Limits for auth users (higher than public)
const DEFAULT_LIMIT = 150_000;
const MAX_LIMIT = 150_000;

// Schema for query params (empty - limit is optional via searchParams)
const EmptySchema = z.object({}).strict();

/**
 * GET /api/graph/v3/auth/base-nodes
 * 
 * Returns prioritized base nodes for authenticated users (up to 150k):
 * 1. Consent/label nodes (users who opted in for display)
 * 2. User's personal network (followings + effectiveFollowers + userNode)
 * 3. Top nodes by degree to fill up to limit
 * 
 * Query params:
 * - limit (optional): number of nodes to return (default: 150000, max: 150000)
 * 
 * Response: Arrow IPC stream
 * 
 * Cache: no-store (user-specific prioritization)
 */
async function authBaseNodesHandler(
  request: NextRequest,
  _data: z.infer<typeof EmptySchema>,
  session: any
) {
  const searchParams = request.nextUrl.searchParams;
  const userId = session?.user?.id;
  const twitterId = session?.user?.twitter_id?.toString();
  const hasOnboarded = session?.user?.has_onboarded ?? false;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate limit
  const limitParam = searchParams.get('limit');
  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  try {
    const startTime = performance.now();

    // Step 1: Collect personal network coord_hashes
    const networkHashes = new Set<string>();

    // Get user's own node coord_hash if they have a twitter_id
    if (twitterId) {
      const userNode = await pgGraphNodesRepository.getNodeByTwitterId(twitterId);
      if (userNode) {
        const userHash = `${userNode.x.toFixed(6)}_${userNode.y.toFixed(6)}`;
        networkHashes.add(userHash);
      }
    }

    // Get followings hashes
    if (hasOnboarded) {
      const { data: followingsData } = await pgMatchingRepository.getFollowingHashesForOnboardedUser(userId);
      if (followingsData) {
        for (const h of followingsData) {
          networkHashes.add(h.coord_hash);
        }
      }
    } else if (twitterId) {
      const { data: followingsData } = await pgMatchingRepository.getFollowingHashesForFollower(twitterId);
      if (followingsData) {
        for (const hash of followingsData) {
          networkHashes.add(hash);
        }
      }
    }

    // Get effective followers hashes (followers who followed via OP)
    if (twitterId) {
      const { data: effectiveFollowersData } = await pgMatchingRepository.getEffectiveFollowerHashesForSource(twitterId);
      if (effectiveFollowersData) {
        for (const hash of effectiveFollowersData) {
          networkHashes.add(hash);
        }
      }
    }

    console.log(`📊 [auth/base-nodes] Collected ${networkHashes.size} personal network hashes for user ${userId}`);

    // Step 2: Build SQL query with prioritization
    // Priority 0: consent nodes (users_with_name_consent)
    // Priority 1: personal network nodes (followings + effectiveFollowers + userNode)
    // Priority 2: top degree nodes (fill remaining)
    
    // Convert hashes to SQL array for the IN clause
    // Limit network hashes to avoid huge IN clause (max ~10k)
    const MAX_NETWORK_HASHES = 10_000;
    const networkHashesArray = Array.from(networkHashes).slice(0, MAX_NETWORK_HASHES);
    const hasNetworkHashes = networkHashesArray.length > 0;

    // Build the network hashes SQL literal (escaped)
    const networkHashesSql = hasNetworkHashes
      ? networkHashesArray.map(h => `'${h.replace(/'/g, "''")}'`).join(',')
      : "'__none__'"; // Placeholder that won't match anything

    const coordHashSql = `printf('%.6f_%.6f', round(g.x, 6), round(g.y, 6))`;

    // DuckDB side: graph_nodes.id is numeric (twitter_id). Twitter IDs exceed JS safe integer range,
    // so NEVER Number() them (precision loss). Instead, inject a digits-only numeric literal.
    const twitterIdSql = twitterId && /^\d+$/.test(twitterId)
      ? twitterId
      : 'NULL';

    const sql = `
      WITH consent_nodes AS (
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               pa.raw_description AS description,
               0 as priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        INNER JOIN postgres_db.public.users_with_name_consent u ON g.id = u.twitter_id
        LEFT JOIN postgres_db.public.public_accounts pa
          ON pa.twitter_id = u.twitter_id AND u.is_public_account = true
        WHERE g.community != 8
      ),
      user_node AS (
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               NULL AS description,
               1 as priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        WHERE ${twitterId ? `g.id = ${twitterIdSql}` : 'FALSE'}
          AND g.community != 8
          AND NOT EXISTS (
            SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
          )
      ),
      network_nodes AS (
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               NULL AS description,
               1 as priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        WHERE g.community != 8
          AND ${coordHashSql} IN (${networkHashesSql})
          AND ${twitterId ? `g.id != ${twitterIdSql}` : 'TRUE'}
          AND NOT EXISTS (
            SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
          )
      ),
      other_nodes AS (
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               NULL AS description,
               2 as priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        WHERE g.community != 8
          AND NOT EXISTS (
            SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
          )
          AND ${coordHashSql} NOT IN (${networkHashesSql})
          AND ${twitterId ? `g.id != ${twitterIdSql}` : 'TRUE'}
      ),
      combined AS (
        SELECT * FROM consent_nodes
        UNION ALL
        SELECT * FROM user_node
        UNION ALL
        SELECT * FROM network_nodes
        UNION ALL
        SELECT * FROM other_nodes
      )
      SELECT label, x, y, community, degree, tier, node_type, description, priority
      FROM combined
      ORDER BY priority ASC, degree DESC
      LIMIT ${limit}
    `;

    // Forward to DuckDB
    const forwardUrl = new URL('/query', MOSAIC_BASE_URL);
    forwardUrl.searchParams.set('sql', sql);

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.apache.arrow.stream',
    };
    if (DUCKDB_API_KEY) {
      headers['X-API-Key'] = DUCKDB_API_KEY;
    }

    const upstreamResponse = await fetch(forwardUrl, {
      method: 'POST',
      headers,
      cache: 'no-store',
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      logger.logError('API', 'GET /api/graph/v3/auth/base-nodes', `DuckDB error: ${errorText}`, userId);
      return NextResponse.json(
        { error: 'Query execution failed', details: errorText },
        { status: upstreamResponse.status }
      );
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    const loadTime = performance.now() - startTime;

    console.log(`📊 [auth/base-nodes] Loaded ${arrayBuffer.byteLength} bytes in ${loadTime.toFixed(0)}ms for user ${userId} (network: ${networkHashes.size} hashes)`);

    // Return Arrow stream with NO cache (user-specific)
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apache.arrow.stream',
        'Content-Length': String(arrayBuffer.byteLength),
        // NO cache - user-specific prioritization
        'Cache-Control': 'no-store',
        'X-Graph-Version': GRAPH_VERSION,
        'X-Network-Hashes-Count': String(networkHashes.size),
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError('API', 'GET /api/graph/v3/auth/base-nodes', err, userId);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

// Auth required endpoint
export const GET = withValidation(
  EmptySchema,
  authBaseNodesHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    skipRateLimit: false,
  }
);

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

    // Step 1: Build SQL query with prioritization
    // Priority 0: consent nodes (users_with_name_consent)
    // Priority 1: personal network nodes (followings + effectiveFollowers + userNode)
    // Priority 2: top degree nodes (fill remaining)

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
      followings_nodes AS (
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               NULL AS description,
               1 as priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        ${hasOnboarded
          ? `INNER JOIN postgres_db.public.sources_targets st
               ON st.node_id = g.id
              AND st.source_id = '${userId.replace(/'/g, "''")}'::uuid`
          : (twitterId
            ? `INNER JOIN postgres_db.public.get_following_hashes_for_follower(${twitterIdSql}::bigint) fh
                 ON ${coordHashSql} = fh.coord_hash`
            : `INNER JOIN (SELECT '__none__' AS coord_hash) fh ON ${coordHashSql} = fh.coord_hash`)
        }
        WHERE g.community != 8
          AND ${twitterId ? `g.id != ${twitterIdSql}` : 'TRUE'}
          AND NOT EXISTS (
            SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
          )
      ),
      effective_followers_nodes AS (
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               NULL AS description,
               1 as priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        ${twitterId
          ? `INNER JOIN postgres_db."next-auth".users u
               ON u.twitter_id = g.id
             INNER JOIN postgres_db.public.sources_targets st
               ON st.source_id = u.id
              AND st.node_id = ${twitterIdSql}::bigint
              AND (st.has_follow_bluesky = TRUE OR st.has_follow_mastodon = TRUE)`
          : `INNER JOIN (SELECT NULL::bigint AS id) u ON FALSE
             INNER JOIN postgres_db.public.sources_targets st ON FALSE`
        }
        WHERE g.community != 8
          AND ${twitterId ? `g.id != ${twitterIdSql}` : 'TRUE'}
          AND NOT EXISTS (
            SELECT 1 FROM postgres_db.public.users_with_name_consent u2 WHERE u2.twitter_id = g.id
          )
      ),
      network_nodes AS (
        SELECT * FROM followings_nodes
        UNION
        SELECT * FROM effective_followers_nodes
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

    console.log(`📊 [auth/base-nodes] Loaded ${arrayBuffer.byteLength} bytes in ${loadTime.toFixed(0)}ms for user ${userId}`);

    // Return Arrow stream with NO cache (user-specific)
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apache.arrow.stream',
        'Content-Length': String(arrayBuffer.byteLength),
        // NO cache - user-specific prioritization
        'Cache-Control': 'no-store',
        'X-Graph-Version': GRAPH_VERSION,
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

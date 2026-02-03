import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/log_utils';

const MOSAIC_BASE_URL =
  process.env.DUCKDB_MOSAIC_BASE_URL ?? 'http://duckdb-server:8765';
const DUCKDB_API_KEY = process.env.DUCKDB_API_KEY ?? '';

// Current graph version - update when deploying new graph data
const GRAPH_VERSION = '03_11_25';

// Limits
const DEFAULT_LIMIT = 100_000;
const MAX_LIMIT = 100_000;

/**
 * GET /api/graph/v3/base-nodes
 * 
 * Returns the initial ~100k nodes for the public graph (consent-first, then by degree).
 * This endpoint is designed to be cache-friendly (GET + deterministic response).
 * 
 * Query params:
 * - limit (optional): number of nodes to return (default: 100000, max: 100000)
 * 
 * Response: Arrow IPC stream
 * 
 * Cache headers: public, long TTL (data changes ~weekly via new graph version)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Parse and validate limit
  const limitParam = searchParams.get('limit');
  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (isNaN(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: 'Invalid limit parameter' },
        { status: 400 }
      );
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  try {
    // Build SQL query - consent nodes first, then by degree
    // This is the same query as in PublicGraphDataContextV3.tsx but server-controlled
    const sql = `
      WITH degree_ceiling_all AS (
        SELECT MIN(degree) AS detail_degree_ceiling
        FROM (
          SELECT degree
          FROM postgres_db.public.graph_nodes_${GRAPH_VERSION}
          WHERE community != 8
          ORDER BY degree DESC
          LIMIT ${limit}
        ) t
      ),
      consent_nodes AS (
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               c.detail_degree_ceiling AS detail_degree_ceiling,
               0 AS priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        INNER JOIN postgres_db.public.users_with_name_consent u ON g.id = u.twitter_id
        CROSS JOIN degree_ceiling_all c
        WHERE g.community != 8
      ),
      combined AS (
        SELECT * FROM consent_nodes
        UNION ALL
        SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
               c.detail_degree_ceiling AS detail_degree_ceiling,
               1 AS priority
        FROM postgres_db.public.graph_nodes_${GRAPH_VERSION} g
        CROSS JOIN degree_ceiling_all c
        WHERE g.community != 8
          AND NOT EXISTS (
            SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
          )
      )
      SELECT label, x, y, community, degree, tier, node_type, detail_degree_ceiling
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
      logger.logError('API', 'GET /api/graph/v3/base-nodes', `DuckDB error: ${errorText}`, 'system');
      return NextResponse.json(
        { error: 'Query execution failed', details: errorText },
        { status: upstreamResponse.status }
      );
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();

    // Return Arrow stream with cache headers
    // Since graph version is baked in, this response is immutable for this deployment
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apache.arrow.stream',
        'Content-Length': String(arrayBuffer.byteLength),
        // Cache for 1 hour client-side, 7 days on shared caches (nginx/CDN)
        // Graph data changes ~weekly, and we redeploy with new GRAPH_VERSION
        'Cache-Control': 'public, max-age=3600, s-maxage=604800',
        'X-Graph-Version': GRAPH_VERSION,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError('API', 'GET /api/graph/v3/base-nodes', err, 'system');
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

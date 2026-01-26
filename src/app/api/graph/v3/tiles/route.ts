import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/log_utils';

const MOSAIC_BASE_URL =
  process.env.DUCKDB_MOSAIC_BASE_URL ?? 'http://duckdb-server:8765';
const DUCKDB_API_KEY = process.env.DUCKDB_API_KEY ?? '';

// Current graph version - update when deploying new graph data
const GRAPH_VERSION = '03_11_25';

// Limits and bounds
const MAX_LIMIT = 20_000;
const DEFAULT_LIMIT = 5_000;
const MAX_ZOOM_LEVEL = 4;
const MAX_GRID_INDEX = 100; // Reasonable upper bound for grid indices

// Band widths by zoom level index (must match client-side DETAIL_DEGREE_BAND_WIDTH_BY_ZOOM_INDEX)
// This allows using a simple integer `band` param instead of float degreeFloor/degreeCeiling
const BAND_WIDTHS_BY_ZOOM = [0.00, 0.50, 1.00, 2.50, 10.0];

// Grid sizes by zoom level (must match client-side ZOOM_LEVELS)
const GRID_SIZES_BY_ZOOM = [1.0, 0.5, 0.25, 0.1, 0.05];

/**
 * GET /api/graph/v3/tiles
 * 
 * Returns nodes for a specific tile (spatial region + degree band).
 * This endpoint is designed to be cache-friendly (GET + deterministic response).
 * 
 * Query params:
 * - z: zoom level index (0-4) - REQUIRED
 * - gx: grid x index - REQUIRED
 * - gy: grid y index - REQUIRED
 * - band: band index (same as z, used to derive degree range) - REQUIRED
 * - ceiling: detail degree ceiling (from initial nodes) - REQUIRED
 * - limit (optional): max nodes to return (default: 5000, max: 20000)
 * 
 * Note: gridSize is derived from z, degreeFloor/degreeCeiling are derived from band + ceiling.
 * This reduces URL variability and improves cache hit ratio.
 * 
 * Response: Arrow IPC stream
 * 
 * Cache headers: public, long TTL (data changes ~weekly via new graph version)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse and validate required params
  const zParam = searchParams.get('z');
  const gxParam = searchParams.get('gx');
  const gyParam = searchParams.get('gy');
  const bandParam = searchParams.get('band');
  const ceilingParam = searchParams.get('ceiling');
  const limitParam = searchParams.get('limit');

  // Validate presence
  if (!zParam || !gxParam || !gyParam || !bandParam || !ceilingParam) {
    return NextResponse.json(
      { error: 'Missing required parameters: z, gx, gy, band, ceiling' },
      { status: 400 }
    );
  }

  // Parse numeric values
  const z = parseInt(zParam, 10);
  const gx = parseInt(gxParam, 10);
  const gy = parseInt(gyParam, 10);
  const band = parseInt(bandParam, 10);
  const ceiling = parseFloat(ceilingParam);
  let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;

  // Validate ranges
  if (isNaN(z) || z < 0 || z > MAX_ZOOM_LEVEL) {
    return NextResponse.json({ error: `Invalid z: must be 0-${MAX_ZOOM_LEVEL}` }, { status: 400 });
  }
  if (isNaN(gx) || gx < 0 || gx > MAX_GRID_INDEX) {
    return NextResponse.json({ error: `Invalid gx: must be 0-${MAX_GRID_INDEX}` }, { status: 400 });
  }
  if (isNaN(gy) || gy < 0 || gy > MAX_GRID_INDEX) {
    return NextResponse.json({ error: `Invalid gy: must be 0-${MAX_GRID_INDEX}` }, { status: 400 });
  }
  if (isNaN(band) || band < 0 || band > MAX_ZOOM_LEVEL) {
    return NextResponse.json({ error: `Invalid band: must be 0-${MAX_ZOOM_LEVEL}` }, { status: 400 });
  }
  if (isNaN(ceiling) || ceiling <= 0) {
    return NextResponse.json({ error: 'Invalid ceiling: must be > 0' }, { status: 400 });
  }
  if (isNaN(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  }
  limit = Math.min(limit, MAX_LIMIT);

  // Derive gridSize from zoom level
  const gridSize = GRID_SIZES_BY_ZOOM[Math.min(z, GRID_SIZES_BY_ZOOM.length - 1)];

  // Derive degree range from band index + ceiling
  // Round ceiling to 4 decimals for cache key stability
  const roundedCeiling = Math.round(ceiling * 10000) / 10000;
  const bandWidth = BAND_WIDTHS_BY_ZOOM[Math.min(band, BAND_WIDTHS_BY_ZOOM.length - 1)];
  const degreeFloor = Math.max(0, roundedCeiling - bandWidth);
  const degreeCeiling = roundedCeiling;

  // Calculate tile bounds (clamped to [0, 1])
  const minX = Math.max(0, Math.min(1, gx * gridSize));
  const maxX = Math.max(0, Math.min(1, (gx + 1) * gridSize));
  const minY = Math.max(0, Math.min(1, gy * gridSize));
  const maxY = Math.max(0, Math.min(1, (gy + 1) * gridSize));

  if (minX >= maxX || minY >= maxY) {
    // Empty tile - return empty response
    return new NextResponse(new ArrayBuffer(0), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apache.arrow.stream',
        'Content-Length': '0',
        'Cache-Control': 'public, max-age=3600, s-maxage=604800',
        'X-Graph-Version': GRAPH_VERSION,
        'X-Tile-Empty': 'true',
      },
    });
  }

  try {
    // Build SQL query for this tile
    // Small epsilon to avoid including nodes exactly at the ceiling (which are in initial nodes)
    const EPSILON = 1e-9;
    const sql = `
      SELECT label, x, y, community, degree, tier, node_type
      FROM postgres_db.public.graph_nodes_${GRAPH_VERSION}
      WHERE community != 8
        AND degree < ${degreeCeiling - EPSILON}
        AND degree >= ${degreeFloor}
        AND x BETWEEN ${minX} AND ${maxX}
        AND y BETWEEN ${minY} AND ${maxY}
      ORDER BY degree DESC
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
      logger.logError('API', 'GET /api/graph/v3/tiles', `DuckDB error: ${errorText}`, 'system');
      return NextResponse.json(
        { error: 'Query execution failed', details: errorText },
        { status: upstreamResponse.status }
      );
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();

    // Return Arrow stream with cache headers
    // Tile content is deterministic for given params + graph version
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apache.arrow.stream',
        'Content-Length': String(arrayBuffer.byteLength),
        // Cache for 1 hour client-side, 7 days on shared caches (nginx/CDN)
        'Cache-Control': 'public, max-age=3600, s-maxage=604800',
        'X-Graph-Version': GRAPH_VERSION,
        'X-Tile-Key': `${z}_${gx}_${gy}_b${band}`,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError('API', 'GET /api/graph/v3/tiles', err, 'system');
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

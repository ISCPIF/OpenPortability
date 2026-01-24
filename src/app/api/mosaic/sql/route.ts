import { NextRequest, NextResponse } from 'next/server';
import { withPublicValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import logger from '@/lib/log_utils';

const MOSAIC_BASE_URL =
  process.env.DUCKDB_MOSAIC_BASE_URL ?? 'http://duckdb-server:8765';

// API key for DuckDB server authentication
const DUCKDB_API_KEY = process.env.DUCKDB_API_KEY ?? '';

// Whitelist of allowed SQL patterns for security
// Only allow SELECT queries on specific tables
const ALLOWED_SQL_PATTERNS = [
  /^SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}(\s+WHERE\s+.+)?$/i,
  // Allow simple SELECT with ORDER BY and LIMIT (for public initial load)
  /^SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+WHERE\s+[\s\S]+?\s+ORDER\s+BY\s+[\w.]+\s+(ASC|DESC)\s+LIMIT\s+\d+\s*$/i,
  /^SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.users_with_name_consent(\s+WHERE\s+.+)?$/i,
  /^SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.public_accounts(\s+WHERE\s+.+)?$/i,
  // Allow LEFT JOIN patterns for label tooltips (consented labels + optional public description)
  /^\s*SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+\w+\s+LEFT\s+JOIN\s+postgres_db\.public\.users_with_name_consent\s+\w+\s+ON\s+[\w.=\s]+(\s+WHERE\s+.+)?$/i,
  /^\s*SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+\w+\s+LEFT\s+JOIN\s+postgres_db\.public\.users_with_name_consent\s+\w+\s+ON\s+[\s\S]+?\s+LEFT\s+JOIN\s+postgres_db\.public\.public_accounts\s+\w+\s+ON\s+[\s\S]+?(\s+WHERE\s+[\s\S]+)?$/i,
  // Allow double LEFT JOIN with ORDER BY and LIMIT (for initial load with top N nodes by degree)
  /^\s*SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+\w+\s+LEFT\s+JOIN\s+postgres_db\.public\.users_with_name_consent\s+\w+\s+ON\s+[\s\S]+?\s+LEFT\s+JOIN\s+postgres_db\.public\.public_accounts\s+\w+\s+ON\s+[\s\S]+?\s+WHERE\s+[\s\S]+?\s+ORDER\s+BY\s+[\w.]+\s+(ASC|DESC)\s+LIMIT\s+\d+\s*$/i,
  // Allow tile-based queries with bounding box (x BETWEEN ... AND y BETWEEN ...)
  // Pattern: SELECT ... FROM graph_nodes WHERE x BETWEEN ... AND ... AND y BETWEEN ... AND ... ORDER BY ... LIMIT ...
  /^\s*SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+\w+\s+WHERE\s+[\s\S]*\w+\.x\s+BETWEEN\s+[-\d.]+\s+AND\s+[-\d.]+[\s\S]*\w+\.y\s+BETWEEN\s+[-\d.]+\s+AND\s+[-\d.]+[\s\S]*$/i,
  // Allow detail nodes query (no bounding box, just degree filter)
  // Pattern: SELECT ... FROM graph_nodes g WHERE g.community != 8 AND g.degree < X ORDER BY ... LIMIT ...
  /^\s*SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+\w+\s+WHERE\s+\w+\.community\s*!=\s*\d+\s+AND\s+\w+\.degree\s*<\s*[-\d.]+\s+ORDER\s+BY\s+[\w.]+\s+(ASC|DESC)\s+LIMIT\s+\d+\s*$/i,
  // Allow detail nodes query with spatial filter (degree + bbox)
  // Pattern: SELECT ... FROM graph_nodes g WHERE g.community != 8 AND g.degree < X AND g.x BETWEEN ... AND g.y BETWEEN ... ORDER BY ... LIMIT ...
  /^\s*SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+\w+\s+WHERE\s+\w+\.community\s*!=\s*\d+\s+AND\s+\w+\.degree\s*<\s*[-\d.]+\s+AND\s+\w+\.x\s+BETWEEN\s+[-\d.]+\s+AND\s+[-\d.]+\s+AND\s+\w+\.y\s+BETWEEN\s+[-\d.]+\s+AND\s+[-\d.]+\s+ORDER\s+BY\s+[\w.]+\s+(ASC|DESC)\s+LIMIT\s+\d+\s*$/i,
  // Allow detail nodes query with spatial filter (degree >= X for zoom-based loading)
  // Pattern: SELECT ... FROM graph_nodes g WHERE g.community != 8 AND g.degree >= X AND g.x BETWEEN ... AND g.y BETWEEN ... ORDER BY ... LIMIT ...
  /^\s*SELECT\s+[\w\s,.*]+\s+FROM\s+postgres_db\.public\.graph_nodes_\d{2}_\d{2}_\d{2}\s+\w+\s+WHERE\s+\w+\.community\s*!=\s*\d+\s+AND\s+\w+\.degree\s*>=\s*[-\d.]+\s+AND\s+\w+\.x\s+BETWEEN\s+[-\d.]+\s+AND\s+[-\d.]+\s+AND\s+\w+\.y\s+BETWEEN\s+[-\d.]+\s+AND\s+[-\d.]+\s+ORDER\s+BY\s+[\w.]+\s+(ASC|DESC)\s+LIMIT\s+\d+\s*$/i,
  // Allow CTE (WITH ... AS) queries for prioritized loading (consent nodes first, then by degree)
  // Pattern: WITH consent_nodes AS (...), other_nodes AS (...), combined AS (...) SELECT ... ORDER BY ... LIMIT ...
  /^\s*WITH\s+\w+\s+AS\s*\([\s\S]+?\)\s*,\s*\w+\s+AS\s*\([\s\S]+?\)\s*,\s*\w+\s+AS\s*\([\s\S]+?\)\s*SELECT\s+[\w\s,.*]+\s+FROM\s+\w+\s+ORDER\s+BY\s+[\w\s,]+\s+(ASC|DESC)\s*,?\s*[\w\s]*(ASC|DESC)?\s*LIMIT\s+\d+\s*$/i,
];

// Dangerous SQL patterns to block
const BLOCKED_SQL_PATTERNS = [
  /;\s*--/i,           // SQL comment injection
  /;\s*\/\*/i,         // Block comment injection
  /DROP\s+/i,          // DROP statements
  /DELETE\s+/i,        // DELETE statements
  /UPDATE\s+/i,        // UPDATE statements
  /INSERT\s+/i,        // INSERT statements
  /ALTER\s+/i,         // ALTER statements
  /CREATE\s+/i,        // CREATE statements
  /TRUNCATE\s+/i,      // TRUNCATE statements
  /EXEC(UTE)?\s*\(/i,  // EXECUTE statements
  /xp_/i,              // SQL Server extended procedures
  /sp_/i,              // SQL Server stored procedures
  /UNION\s+SELECT/i,   // UNION injection
  /INTO\s+OUTFILE/i,   // File write
  /LOAD_FILE/i,        // File read
];

function isQueryAllowed(sql: string): { allowed: boolean; reason?: string } {
  // Check for blocked patterns first
  for (const pattern of BLOCKED_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      return { allowed: false, reason: 'Blocked SQL pattern detected' };
    }
  }

  // Check if query matches allowed patterns
  const isAllowed = ALLOWED_SQL_PATTERNS.some(pattern => pattern.test(sql.trim()));
  if (!isAllowed) {
    return { allowed: false, reason: 'Query does not match allowed patterns' };
  }

  return { allowed: true };
}

// Schema for the request body
const MosaicSqlSchema = z.object({
  sql: z.string().min(1).max(5000),
  type: z.enum(['arrow', 'exec', 'json']).default('json'),
});

async function mosaicSqlHandler(
  request: NextRequest,
  data: z.infer<typeof MosaicSqlSchema>
) {
  if (!MOSAIC_BASE_URL) {
    logger.logError('API', 'POST /api/mosaic/sql', 'DUCKDB_MOSAIC_BASE_URL is not configured', 'system');
    return NextResponse.json({ error: 'DuckDB server is not configured' }, { status: 500 });
  }

  try {
    const { sql, type } = data;

    // Validate SQL query against whitelist
    const validation = isQueryAllowed(sql);
    if (!validation.allowed) {
      logger.logError('Security', 'POST /api/mosaic/sql', `SQL query blocked: ${validation.reason}`, 'system', {
        sql: sql.substring(0, 200), // Log only first 200 chars
      });
      return NextResponse.json(
        { error: 'Query not allowed', details: validation.reason },
        { status: 403 }
      );
    }

    // Forward SQL query to DuckDB server
    const forwardUrl = new URL('/query', MOSAIC_BASE_URL);
    forwardUrl.searchParams.set('sql', sql);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    // Add API key if configured
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
      logger.logError('API', 'POST /api/mosaic/sql', `DuckDB error: ${errorText}`, 'system');
      return NextResponse.json(
        { error: 'Query execution failed', details: errorText },
        { status: upstreamResponse.status }
      );
    }

    // Return based on requested type
    if (type === 'arrow' || type === 'exec') {
      const arrayBuffer = await upstreamResponse.arrayBuffer();
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apache.arrow.stream',
          'Content-Length': String(arrayBuffer.byteLength),
        },
      });
    }

    // Default: return JSON
    const responseData = await upstreamResponse.json();
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError('API', 'POST /api/mosaic/sql', err, 'system');
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}

// Public endpoint with rate limiting and security checks
export const POST = withPublicValidation(
  MosaicSqlSchema,
  mosaicSqlHandler,
  {
    applySecurityChecks: true,  // Enable SQL injection checks on body
    skipRateLimit: false,
    excludeFromSecurityChecks: ['sql'], // SQL field has its own whitelist validation
  }
);

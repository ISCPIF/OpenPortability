import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';

// Redis keys
const CHANGES_KEY = 'graph:node-type-changes';
const VERSION_KEY = 'graph:node-type-version';

// Keep changes for 1 hour (clients poll every 5 min, so 1h is plenty)
const CHANGES_TTL_SECONDS = 3600;

interface NodeTypeChange {
  coord_hash: string;
  node_type: 'member' | 'generic';
  timestamp: number;
}

/**
 * GET /api/graph/node-type-changes
 * 
 * Returns recent node_type changes since a given timestamp.
 * Clients poll this to sync node_type changes without refetching all nodes.
 * 
 * Query params:
 * - since: timestamp (ms) to get changes after (optional, defaults to 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const since = parseInt(searchParams.get('since') || '0', 10);
    
    // Get current version
    const versionStr = await redis.get(VERSION_KEY);
    const version = versionStr ? parseInt(versionStr, 10) : 0;
    
    // If client is up to date, return empty changes
    if (since >= version) {
      return NextResponse.json({
        success: true,
        version,
        changes: [],
      });
    }
    
    // Get all changes from Redis list
    const changesJson = await redis.lrange(CHANGES_KEY, 0, -1);
    const allChanges: NodeTypeChange[] = changesJson.map(json => JSON.parse(json));
    
    // Filter changes newer than 'since'
    const recentChanges = allChanges.filter(change => change.timestamp > since);
    
    return NextResponse.json({
      success: true,
      version,
      changes: recentChanges,
    });
    
  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError(
      'API',
      'GET /api/graph/node-type-changes',
      errorString,
      'system'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/graph/node-type-changes
 * 
 * Records a node_type change. Called internally when consent changes.
 * 
 * Body:
 * - coord_hash: string
 * - node_type: 'member' | 'generic'
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { coord_hash, node_type } = body;
    
    if (!coord_hash || !node_type) {
      return NextResponse.json(
        { error: 'Missing coord_hash or node_type' },
        { status: 400 }
      );
    }
    
    const now = Date.now();
    
    const change: NodeTypeChange = {
      coord_hash,
      node_type,
      timestamp: now,
    };
    
    // Add to Redis list and update version
    await Promise.all([
      redis.lpush(CHANGES_KEY, JSON.stringify(change)),
      redis.set(VERSION_KEY, now.toString()),
      redis.expire(CHANGES_KEY, CHANGES_TTL_SECONDS),
    ]);
    
    logger.logInfo(
      'API',
      'POST /api/graph/node-type-changes',
      `Recorded node_type change: ${coord_hash} → ${node_type}`
    );
    
    return NextResponse.json({
      success: true,
      version: now,
    });
    
  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError(
      'API',
      'POST /api/graph/node-type-changes',
      errorString,
      'system'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

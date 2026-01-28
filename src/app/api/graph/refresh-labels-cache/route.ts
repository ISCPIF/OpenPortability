import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { auth } from '@/app/auth';

// Redis cache keys
const CACHE_KEY = 'graph:labels:public';
const VERSION_KEY = 'graph:labels:version';

/**
 * GET /api/graph/refresh-labels-cache
 * 
 * Returns the current labels version timestamp.
 * Clients poll this endpoint to detect when labels have changed.
 * No authentication required (public data).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const version = await redis.get(VERSION_KEY);
    
    return NextResponse.json({
      success: true,
      version: version ? parseInt(version, 10) : 0,
    });
  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError(
      'API',
      'GET /api/graph/refresh-labels-cache',
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
 * POST /api/graph/refresh-labels-cache
 * 
 * Public endpoint for clients to trigger cache invalidation after consent changes.
 * Requires authentication to prevent abuse.
 * 
 * This is called by the frontend after receiving 200 from POST /api/graph/consent_labels
 * to refresh the Redis cache asynchronously.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require authentication to prevent abuse
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = Date.now();
    
    // Invalidate the cache and update version timestamp
    await Promise.all([
      redis.del(CACHE_KEY),
      redis.set(VERSION_KEY, now.toString()),
    ]);
    
    logger.logInfo(
      'API',
      'POST /api/graph/refresh-labels-cache',
      `Labels cache invalidated by client, version: ${now}`,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      message: 'Labels cache refreshed',
      version: now,
      invalidated_at: new Date(now).toISOString(),
    });

  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError(
      'API',
      'POST /api/graph/refresh-labels-cache',
      errorString,
      'system'
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

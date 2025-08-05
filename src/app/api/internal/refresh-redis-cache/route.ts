import { NextRequest, NextResponse } from 'next/server';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';

export async function POST(request: NextRequest) {
  try {
    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-redis-cache', 'Starting Redis cache refresh', 'system', {
      context: 'Redis cache refresh triggered by PostgreSQL webhook'
    });

    // Lire les stats depuis global_stats_cache
    const repository = new StatsRepository();
    const stats = await repository.getGlobalStatsFromCache();

    if (!stats) {
      logger.logWarning('WEBHOOK', 'POST /api/internal/refresh-redis-cache', 'No stats found in global_stats_cache', 'system', {
        context: 'Cache refresh failed - no data'
      });
      return NextResponse.json({ error: 'No stats found in cache' }, { status: 404 });
    }

    // Mettre à jour Redis avec TTL de 65 minutes (sécurité)
    await redis.set('stats:global', JSON.stringify(stats), 3900);

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-redis-cache', 'Redis cache updated successfully', 'system', {
      context: 'Global stats cached in Redis',
      ttl: 3900,
      statsKeys: Object.keys(stats)
    });

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ttl: 3900 
    });

  } catch (error) {
    logger.logError('WEBHOOK', 'POST /api/internal/refresh-redis-cache', error, 'system', {
      context: 'Failed to update Redis cache from webhook'
    });

    return NextResponse.json({ 
      error: 'Failed to update Redis cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

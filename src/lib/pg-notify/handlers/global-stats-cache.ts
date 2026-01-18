import logger from '../../log_utils';
import { redis } from '../../redis';
import { publishSSEEvent } from '../../sse-publisher';
import type { GlobalStatsCacheInvalidationPayload } from '../types';
import type { GlobalStats } from '../../types/stats';

export async function handleGlobalStatsCacheInvalidation(payload: GlobalStatsCacheInvalidationPayload): Promise<void> {
  try {
    const { stats } = payload;

    if (!stats) {
      logger.logError('PgNotify', 'Invalid global stats payload', JSON.stringify(payload).substring(0, 200), 'system');
      return;
    }

    // Keep behavior identical to /api/internal/refresh-redis-cache
    await redis.set('stats:global', JSON.stringify(stats), 86400);

    // Additionally notify connected clients via SSE with FULL stats
    try {
      // Send the complete stats object to SSE clients
      const fullStats = stats as GlobalStats;
      
      if (fullStats.users && fullStats.connections && fullStats.updated_at) {
        await publishSSEEvent('stats:global', fullStats);
        logger.logInfo('PgNotify', 'SSE event published (full stats)', 
          `users.total=${fullStats.users.total}, connections.withHandle=${fullStats.connections.withHandle}`, 'system');
      } else {
        logger.logWarning('PgNotify', 'Skipping SSE publish - incomplete stats structure', 
          JSON.stringify(stats).substring(0, 100), 'system');
      }
    } catch (sseError) {
      logger.logWarning('PgNotify', 'Failed to publish SSE event', 'stats:global', 'system', {
        error: sseError instanceof Error ? sseError.message : String(sseError),
      });
    }

    logger.logInfo('PgNotify', 'Global stats cache refreshed', `ttl=86400`, 'system');
  } catch (error) {
    logger.logError(
      'PgNotify',
      'Failed to refresh global stats cache',
      error instanceof Error ? error.message : String(error),
      'system'
    );
  }
}

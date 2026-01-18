import logger from '../../log_utils';
import { redis } from '../../redis';
import { publishGlobalStatsUpdate } from '../../sse-publisher';
import type { GlobalStatsCacheInvalidationPayload } from '../types';

export async function handleGlobalStatsCacheInvalidation(payload: GlobalStatsCacheInvalidationPayload): Promise<void> {
  try {
    const { stats } = payload;

    if (!stats) {
      logger.logError('PgNotify', 'Invalid global stats payload', JSON.stringify(payload).substring(0, 200), 'system');
      return;
    }

    // Keep behavior identical to /api/internal/refresh-redis-cache
    await redis.set('stats:global', JSON.stringify(stats), 86400);

    // Additionally notify connected clients.
    try {
      const updated_at = (stats as any).updated_at;
      if (typeof (stats as any).users === 'number' && typeof (stats as any).connections === 'number' && typeof updated_at === 'string') {
        await publishGlobalStatsUpdate({
          users: (stats as any).users,
          connections: (stats as any).connections,
          updated_at,
        });
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

import logger from '../../log_utils';
import { redis } from '../../redis';
import { publishUserStatsUpdate } from '../../sse-publisher';
import type { UserStatsCacheInvalidationPayload } from '../types';

export async function handleUserStatsCacheInvalidation(payload: UserStatsCacheInvalidationPayload): Promise<void> {
  try {
    const { user_id, stats } = payload;

    if (!user_id || !stats) {
      logger.logError('PgNotify', 'Invalid user stats payload', JSON.stringify(payload).substring(0, 200), 'system');
      return;
    }

    const cacheKey = `user:stats:${user_id}`;

    // Keep behavior identical to the old webhook route.
    await redis.del(cacheKey);
    await redis.set(cacheKey, JSON.stringify(stats), 86400);

    try {
      const sseStats = {
        connections: stats.connections || { followers: 0, following: 0, totalEffectiveFollowers: 0 },
        matches: stats.matches || {
          bluesky: { total: 0, hasFollowed: 0, notFollowed: 0 },
          mastodon: { total: 0, hasFollowed: 0, notFollowed: 0 },
        },
      };

      await publishUserStatsUpdate(user_id, sseStats);
    } catch (sseError) {
      logger.logWarning('PgNotify', 'Failed to publish SSE event', 'stats:user', 'system', {
        user_id,
        error: sseError instanceof Error ? sseError.message : String(sseError),
      });
    }

    logger.logInfo('PgNotify', 'User stats cache refreshed', `user_id=${user_id}`, 'system');
  } catch (error) {
    logger.logError(
      'PgNotify',
      'Failed to refresh user stats cache',
      error instanceof Error ? error.message : String(error),
      'system'
    );
  }
}

import logger from '../../log_utils';
import { redis } from '../../redis';
import type { SyncRedisMappingPayload } from '../types';

export async function handleSyncRedisMapping(payload: SyncRedisMappingPayload): Promise<void> {
  try {
    const { action, platform, twitter_id } = payload;

    if (!action || !platform || !twitter_id) {
      logger.logError('PgNotify', 'Invalid sync redis mapping payload', JSON.stringify(payload).substring(0, 200), 'system');
      return;
    }

    const redisKey = `twitter_to_${platform}:${twitter_id}`;

    if (action === 'delete') {
      await redis.del(redisKey);
      return;
    }

    // action === 'upsert'
    if (platform === 'bluesky') {
      const bluesky_username = payload.bluesky_username || payload.data?.bluesky_username;
      if (!bluesky_username) {
        logger.logError('PgNotify', 'Missing bluesky_username for sync', JSON.stringify(payload).substring(0, 200), 'system');
        return;
      }
      await redis.set(redisKey, bluesky_username);
      return;
    }

    // mastodon
    const mastodon_id = payload.mastodon_id || payload.data?.mastodon_id;
    const mastodon_username = payload.mastodon_username || payload.data?.mastodon_username;
    const mastodon_instance = payload.mastodon_instance || payload.data?.mastodon_instance;

    if (!mastodon_id || !mastodon_username || !mastodon_instance) {
      logger.logError('PgNotify', 'Missing mastodon fields for sync', JSON.stringify(payload).substring(0, 200), 'system');
      return;
    }

    const value = JSON.stringify({
      id: mastodon_id,
      username: mastodon_username,
      instance: mastodon_instance,
    });

    await redis.set(redisKey, value);
  } catch (error) {
    logger.logError(
      'PgNotify',
      'Failed to sync redis mapping',
      error instanceof Error ? error.message : String(error),
      'system'
    );
  }
}

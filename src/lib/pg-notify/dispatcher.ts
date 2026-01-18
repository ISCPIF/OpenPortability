import logger from '../log_utils';
import { PG_NOTIFY_CHANNELS, type PgNotifyChannel } from './channels';
import type {
  CacheInvalidationPayload,
  ConsentChangePayload,
  MastodonCacheInvalidationPayload,
  GlobalStatsCacheInvalidationPayload,
  SyncRedisMappingPayload,
  UserStatsCacheInvalidationPayload,
} from './types';
import { handleCacheInvalidation, handleConsentChange } from './handlers/cache-invalidation';
import { handleNodeTypeChange } from './handlers/node-type';
import { handleMastodonCacheInvalidation } from './handlers/mastodon-cache';
import { handleUserStatsCacheInvalidation } from './handlers/user-stats-cache';
import { handleGlobalStatsCacheInvalidation } from './handlers/global-stats-cache';
import { handleSyncRedisMapping } from './handlers/sync-redis-mapping';

export async function dispatchPgNotification(channel: string, payload: string): Promise<void> {
  try {
    const parsed = JSON.parse(payload);

    logger.logInfo('PgNotify', `Received ${channel}`, JSON.stringify(parsed).substring(0, 200), 'system');

    switch (channel as PgNotifyChannel) {
      case PG_NOTIFY_CHANNELS.CACHE_INVALIDATION:
        await handleCacheInvalidation(parsed as CacheInvalidationPayload);
        break;

      case PG_NOTIFY_CHANNELS.CONSENT_CHANGE:
        await handleConsentChange(parsed as ConsentChangePayload);
        break;

      case PG_NOTIFY_CHANNELS.NODE_TYPE_CHANGE:
        await handleNodeTypeChange(parsed);
        break;

      case PG_NOTIFY_CHANNELS.MASTODON_CACHE_INVALIDATION:
        await handleMastodonCacheInvalidation(parsed as MastodonCacheInvalidationPayload);
        break;

      case PG_NOTIFY_CHANNELS.USER_STATS_CACHE_INVALIDATION:
        await handleUserStatsCacheInvalidation(parsed as UserStatsCacheInvalidationPayload);
        break;

      case PG_NOTIFY_CHANNELS.GLOBAL_STATS_CACHE_INVALIDATION:
        await handleGlobalStatsCacheInvalidation(parsed as GlobalStatsCacheInvalidationPayload);
        break;

      case PG_NOTIFY_CHANNELS.SYNC_REDIS_MAPPING:
        await handleSyncRedisMapping(parsed as SyncRedisMappingPayload);
        break;

      default:
        logger.logInfo('PgNotify', `Unknown channel: ${channel}`, payload, 'system');
    }
  } catch (error) {
    logger.logError(
      'PgNotify',
      'Failed to handle notification',
      error instanceof Error ? error.message : String(error),
      'system'
    );
  }
}

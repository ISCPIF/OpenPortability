// Channel names for PostgreSQL NOTIFY
export const PG_NOTIFY_CHANNELS = {
  CACHE_INVALIDATION: 'cache_invalidation',
  CONSENT_CHANGE: 'consent_change',
  NODE_TYPE_CHANGE: 'node_type_change',
  MASTODON_CACHE_INVALIDATION: 'mastodon_cache_invalidation',
  USER_STATS_CACHE_INVALIDATION: 'user_stats_cache_invalidation',
  GLOBAL_STATS_CACHE_INVALIDATION: 'global_stats_cache_invalidation',
  SYNC_REDIS_MAPPING: 'sync_redis_mapping',
} as const;

export type PgNotifyChannel = (typeof PG_NOTIFY_CHANNELS)[keyof typeof PG_NOTIFY_CHANNELS];

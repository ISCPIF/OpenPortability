import logger from '../../log_utils';
import { redis } from '../../redis';
import { SSE_GRAPH_CHANNEL } from '../../sse/constants';
import type { CacheInvalidationPayload, ConsentChangePayload } from '../types';
import { queueLabelsInvalidation } from '../../sse-publisher';

export async function handleCacheInvalidation(payload: CacheInvalidationPayload): Promise<void> {
  const { operation, twitter_id, consent_level, user_id, timestamp } = payload;

  // Labels changes are batched to avoid frequent UI flicker.
  // PgNotify only queues an invalidation; clients will refetch labels on the next flush window.
  await queueLabelsInvalidation('pg_notify:cache_invalidation', {
    operation,
    twitter_id,
    consent_level,
    user_id,
    timestamp,
  });

  await redis.publish(SSE_GRAPH_CHANNEL, {
    type: 'nodeTypes',
    data: {
      changes: [
        {
          twitter_id,
          node_type: operation === 'DELETE' ? 'generic' : 'member',
        },
      ],
    },
    userId: null,
    timestamp: timestamp || Date.now(),
  });

  logger.logInfo('PgNotify', 'Published SSE events', `operation=${operation} twitter_id=${twitter_id}`, user_id);
}

export async function handleConsentChange(payload: ConsentChangePayload): Promise<void> {
  await handleCacheInvalidation({
    operation: payload.operation,
    twitter_id: payload.twitter_id,
    consent_level: payload.new_consent_level || null,
    user_id: payload.user_id,
    timestamp: payload.timestamp,
  });
}

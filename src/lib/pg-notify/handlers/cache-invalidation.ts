import logger from '../../log_utils';
import { redis } from '../../redis';
import { SSE_GRAPH_CHANNEL } from '../../sse/constants';
import type { CacheInvalidationPayload, ConsentChangePayload } from '../types';

export async function handleCacheInvalidation(payload: CacheInvalidationPayload): Promise<void> {
  const { operation, twitter_id, consent_level, user_id, timestamp } = payload;

  if (operation === 'DELETE' || consent_level === null) {
    await redis.publish(SSE_GRAPH_CHANNEL, {
      type: 'labels',
      data: {
        incremental: true,
        change: {
          twitter_id,
          action: 'remove',
        },
      },
      userId: null,
      timestamp: timestamp || Date.now(),
    });
  } else {
    await redis.publish(SSE_GRAPH_CHANNEL, {
      type: 'labels',
      data: {
        incremental: true,
        change: {
          twitter_id,
          action: 'add',
          consent_level,
        },
      },
      userId: null,
      timestamp: timestamp || Date.now(),
    });
  }

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

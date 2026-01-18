import logger from '../../log_utils';
import { redis } from '../../redis';
import { pgMastodonInstanceRepository } from '../../repositories/auth/pg-mastodon-instance-repository';
import type { MastodonCacheInvalidationPayload } from '../types';

export async function handleMastodonCacheInvalidation(payload: MastodonCacheInvalidationPayload): Promise<void> {
  try {
    const instances = await pgMastodonInstanceRepository.getAllInstances();
    const instancesList = instances.map((row) => row.instance);

    await redis.set('mastodon:instances', JSON.stringify(instancesList));

    logger.logInfo(
      'PgNotify',
      'Mastodon cache refreshed',
      `operation=${payload?.operation || 'unknown'} count=${instancesList.length}`,
      'system'
    );
  } catch (error) {
    logger.logError(
      'PgNotify',
      'Failed to refresh Mastodon cache',
      error instanceof Error ? error.message : String(error),
      'system'
    );
  }
}

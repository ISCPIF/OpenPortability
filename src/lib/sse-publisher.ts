import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';

// SSE Channel for graph updates
const SSE_CHANNEL = 'sse:graph:updates';

// Batched labels SSE - accumulate changes and flush periodically
const LABELS_BATCH_KEY = 'sse:labels:pending_changes';
const LABELS_LAST_FLUSH_KEY = 'sse:labels:last_flush';

function getLabelsFlushIntervalMs(): number {
  const fromEnv = process.env.LABELS_SSE_FLUSH_INTERVAL_MS;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 2 * 60 * 1000;
}

declare global {
  // eslint-disable-next-line no-var
  var __labelsFlushSchedulerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __labelsFlushSchedulerHandle: ReturnType<typeof setInterval> | undefined;
}

/**
 * SSE Event Types
 */
export type SSEEventType = 
  | 'labels'        // Public labels changed (consent change)
  | 'nodeTypes'     // Node types changed (member ↔ generic)
  | 'followers'     // Follower hashes updated
  | 'followings'    // Following status updated
  | 'stats:global'  // Global stats updated
  | 'stats:user'    // User-specific stats updated
  | 'importJob';    // Import job progress update (from worker)

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  userId?: string | null;
  timestamp: number;
}

/**
 * Publish an SSE event to all connected clients
 * 
 * @param type - Event type
 * @param data - Event payload
 * @param userId - Optional: target specific user (null = broadcast to all)
 */
export async function publishSSEEvent(
  type: SSEEventType,
  data: any,
  userId?: string | null
): Promise<boolean> {
  try {
    const event: SSEEvent = {
      type,
      data,
      userId: userId || null,
      timestamp: Date.now(),
    };

    const result = await redis.publish(SSE_CHANNEL, event);
    
    if (result > 0) {
      logger.logInfo('SSE', `Published ${type} event`, `Subscribers: ${result}`, userId || 'broadcast');
    }
    
    return result > 0;
  } catch (error) {
    logger.logError('SSE', `Failed to publish ${type} event`, error instanceof Error ? error.message : String(error), userId || 'system');
    return false;
  }
}

export async function queueLabelsInvalidation(source: string, details?: Record<string, any>): Promise<boolean> {
  try {
    const flushIntervalMs = getLabelsFlushIntervalMs();

    await redis.lpush(
      LABELS_BATCH_KEY,
      JSON.stringify({
        source,
        details: details ?? null,
        timestamp: Date.now(),
      })
    );

    await redis.expire(LABELS_BATCH_KEY, Math.ceil(flushIntervalMs * 2 / 1000));
    await maybeFlushLabelChanges();
    return true;
  } catch (error) {
    logger.logError('SSE', 'Failed to queue labels invalidation', error instanceof Error ? error.message : String(error), 'system');
    return false;
  }
}

/**
 * Publish labels update (when consent changes)
 */
export async function publishLabelsUpdate(labelMap: Record<string, string>, floatingLabels: any[]): Promise<boolean> {
  return publishSSEEvent('labels', { labelMap, floatingLabels });
}

/**
 * Publish node type changes (member ↔ generic)
 */
export async function publishNodeTypeChanges(changes: Array<{ coord_hash: string; node_type: 'member' | 'generic' }>): Promise<boolean> {
  return publishSSEEvent('nodeTypes', { changes });
}

/**
 * Publish incremental label change (add or remove a single label)
 * This allows clients to update their label cache without refetching everything
 * 
 * @deprecated Use queueLabelChange() instead for batched updates every 15 minutes
 */
export async function publishLabelChange(change: {
  coord_hash: string;
  action: 'add' | 'remove';
  label?: { x: number; y: number; text: string; priority?: number };
}): Promise<boolean> {
  return publishSSEEvent('labels', { 
    incremental: true,
    change 
  });
}

/**
 * Queue a label change for batched SSE publishing.
 * Changes are accumulated and flushed every 15 minutes to avoid blink spam.
 * 
 * When flushed, sends a single `invalidated: true` event so clients refetch all labels.
 */
export async function queueLabelChange(change: {
  coord_hash: string;
  action: 'add' | 'remove';
  label?: { x: number; y: number; text: string; priority?: number };
}): Promise<boolean> {
  try {
    const flushIntervalMs = getLabelsFlushIntervalMs();

    // Add change to pending list (we just track that something changed, don't need details)
    await redis.lpush(LABELS_BATCH_KEY, JSON.stringify({
      ...change,
      timestamp: Date.now(),
    }));
    
    // Set TTL to avoid orphaned keys (2x flush interval)
    await redis.expire(LABELS_BATCH_KEY, Math.ceil(flushIntervalMs * 2 / 1000));
    
    // Check if we should flush now
    await maybeFlushLabelChanges();
    
    logger.logDebug('SSE', 'Label change queued', `action: ${change.action}, coord_hash: ${change.coord_hash}`, 'system');
    return true;
  } catch (error) {
    logger.logError('SSE', 'Failed to queue label change', error instanceof Error ? error.message : String(error), 'system');
    return false;
  }
}

/**
 * Check if enough time has passed since last flush and flush if needed.
 * Called automatically after each queueLabelChange().
 * Uses atomic check to prevent race conditions on timer initialization.
 */
async function maybeFlushLabelChanges(): Promise<boolean> {
  try {
    const now = Date.now();
    const flushIntervalMs = getLabelsFlushIntervalMs();
    
    // Check if timer key exists
    const lastFlushStr = await redis.get(LABELS_LAST_FLUSH_KEY);
    
    if (!lastFlushStr) {
      // No timer exists - initialize it atomically using setnx via raw client
      const wasSet = await redis.setnx(LABELS_LAST_FLUSH_KEY, now.toString());
      if (wasSet) {
        // We successfully initialized the timer - don't flush yet, start the window
        const ttlSeconds = Math.ceil(flushIntervalMs * 2 / 1000);
        await redis.expire(LABELS_LAST_FLUSH_KEY, ttlSeconds);
        logger.logInfo('SSE', 'Initialized label flush timer', `First change queued, flush in ${Math.round(flushIntervalMs / 1000)}s`, 'system');
        return false;
      }
      // Another process beat us to it - fall through to check the timer
      const existingFlushStr = await redis.get(LABELS_LAST_FLUSH_KEY);
      if (!existingFlushStr) {
        // Key expired between setnx and get - rare but possible, retry next time
        return false;
      }
    }
    
    // Timer exists, check if it's time to flush
    const lastFlush = parseInt(lastFlushStr || (await redis.get(LABELS_LAST_FLUSH_KEY)) || '0', 10);
    
    if (now - lastFlush < flushIntervalMs) {
      // Not time to flush yet
      return false;
    }
    
    // Check if there are pending changes
    const pendingCount = await redis.llen(LABELS_BATCH_KEY);
    if (pendingCount === 0) {
      return false;
    }
    
    // Clear pending changes
    await redis.del(LABELS_BATCH_KEY);
    
    // Update last flush time
    await redis.set(LABELS_LAST_FLUSH_KEY, now.toString());
    
    // Publish invalidation event - clients will refetch all labels
    const result = await publishSSEEvent('labels', {
      invalidated: true,
      version: now,
      batchedChanges: pendingCount,
    });
    
    logger.logInfo('SSE', 'Flushed batched label changes', `${pendingCount} changes, broadcasting invalidation`, 'system');
    return result;
  } catch (error) {
    logger.logError('SSE', 'Failed to flush label changes', error instanceof Error ? error.message : String(error), 'system');
    return false;
  }
}

/**
 * Force flush all pending label changes immediately.
 * Useful for testing or manual trigger.
 */
export async function forceFlushLabelChanges(): Promise<boolean> {
  try {
    const pendingCount = await redis.llen(LABELS_BATCH_KEY);
    if (pendingCount === 0) {
      return false;
    }
    
    await redis.del(LABELS_BATCH_KEY);
    await redis.set(LABELS_LAST_FLUSH_KEY, Date.now().toString());
    
    const result = await publishSSEEvent('labels', {
      invalidated: true,
      version: Date.now(),
      batchedChanges: pendingCount,
      forced: true,
    });
    
    logger.logInfo('SSE', 'Force flushed batched label changes', `${pendingCount} changes`, 'system');
    return result;
  } catch (error) {
    logger.logError('SSE', 'Failed to force flush label changes', error instanceof Error ? error.message : String(error), 'system');
    return false;
  }
}

export function startLabelsFlushScheduler(): void {
  if (globalThis.__labelsFlushSchedulerStarted) return;

  const flushIntervalMs = getLabelsFlushIntervalMs();
  globalThis.__labelsFlushSchedulerStarted = true;
  globalThis.__labelsFlushSchedulerHandle = setInterval(() => {
    forceFlushLabelChanges().catch(() => {});
  }, flushIntervalMs);

  logger.logInfo('SSE', 'Labels flush scheduler started', `intervalMs=${flushIntervalMs}`, 'system');
}

/**
 * Publish follower hashes update for a specific user
 */
export async function publishFollowerHashesUpdate(
  userId: string,
  hashes: string[],
  effectiveHashes: string[]
): Promise<boolean> {
  return publishSSEEvent('followers', { hashes, effectiveHashes }, userId);
}

/**
 * Publish following status update for a specific user
 */
export async function publishFollowingStatusUpdate(
  userId: string,
  updates: Array<{ coord_hash: string; platform: 'bluesky' | 'mastodon'; followed: boolean }>
): Promise<boolean> {
  return publishSSEEvent('followings', { updates }, userId);
}

/**
 * Publish global stats update (broadcast to all)
 */
export async function publishGlobalStatsUpdate(stats: {
  users: number;
  connections: number;
  updated_at: string;
}): Promise<boolean> {
  return publishSSEEvent('stats:global', stats);
}

/**
 * Publish user-specific stats update
 */
export async function publishUserStatsUpdate(
  userId: string,
  stats: {
    connections: { followers: number; following: number; totalEffectiveFollowers: number };
    matches: {
      bluesky: { total: number; hasFollowed: number; notFollowed: number };
      mastodon: { total: number; hasFollowed: number; notFollowed: number };
    };
  }
): Promise<boolean> {
  return publishSSEEvent('stats:user', stats, userId);
}

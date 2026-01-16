import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';

// SSE Channel for graph updates
const SSE_CHANNEL = 'sse:graph:updates';

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

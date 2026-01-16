// SSE Channel for graph updates (public + user-specific)
export const SSE_GRAPH_CHANNEL = 'sse:graph:updates';

// Heartbeat interval (30 seconds) to keep connection alive
export const SSE_HEARTBEAT_INTERVAL_MS = 30000;

/**
 * SSE Event Types:
 * - labels: Public labels changed (consent change by any user)
 * - nodeTypes: Node types changed (member ↔ generic)
 * - followers: Follower hashes updated (new effective follower)
 * - followings: Following status updated (after follow action)
 * - stats:global: Global stats updated (new user, new follow)
 * - stats:user: User-specific stats updated (after user action)
 */
export interface SSEEvent {
  type: 'labels' | 'nodeTypes' | 'followers' | 'followings' | 'stats:global' | 'stats:user';
  data: any;
  // Optional: target specific user (null = broadcast to all)
  userId?: string | null;
  // Timestamp for ordering
  timestamp: number;
}

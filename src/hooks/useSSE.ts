'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * SSE Event Types (must match server-side types)
 */
export type SSEEventType = 
  | 'labels'        // Public labels changed (consent change)
  | 'nodeTypes'     // Node types changed (member ↔ generic)
  | 'followers'     // Follower hashes updated
  | 'followings'    // Following status updated
  | 'stats:global'  // Global stats updated
  | 'stats:user'    // User-specific stats updated
  | 'importJob'     // Import job progress update (from worker)
  | 'connected';    // Initial connection event

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  userId?: string | null;
  timestamp: number;
}

export interface SSELabelsData {
  version: number;
  invalidated: boolean;
}

export interface SSENodeTypesData {
  changes: Array<{ coord_hash: string; node_type: 'member' | 'generic' }>;
}

export interface SSEFollowersData {
  hashes: string[];
  effectiveHashes: string[];
}

export interface SSEFollowingsData {
  updates: Array<{ coord_hash: string; platform: 'bluesky' | 'mastodon'; followed: boolean }>;
}

export interface SSEGlobalStatsData {
  users: number;
  connections: number;
  updated_at: string;
}

export interface SSEUserStatsData {
  connections: { followers: number; following: number; totalEffectiveFollowers: number };
  matches: {
    bluesky: { total: number; hasFollowed: number; notFollowed: number };
    mastodon: { total: number; hasFollowed: number; notFollowed: number };
  };
}

export interface SSEImportJobData {
  jobId: string;
  status: string;
  progress: number;
  totalItems: number;
  stats: {
    total: number;
    progress: number;
    followers: number;
    following: number;
    processed: number;
  };
  phase?: 'pending' | 'nodes' | 'edges' | 'completed' | 'failed';
  phase_progress?: number;
  nodes_total?: number;
  nodes_processed?: number;
  edges_total?: number;
  edges_processed?: number;
}

export interface SSEHandlers {
  onLabels?: (data: SSELabelsData) => void;
  onNodeTypes?: (data: SSENodeTypesData) => void;
  onFollowers?: (data: SSEFollowersData) => void;
  onFollowings?: (data: SSEFollowingsData) => void;
  onGlobalStats?: (data: SSEGlobalStatsData) => void;
  onUserStats?: (data: SSEUserStatsData) => void;
  onImportJob?: (data: SSEImportJobData) => void;
  onConnected?: (data: { userId: string | null; timestamp: number }) => void;
  onError?: (error: Error) => void;
}

// Reconnection settings
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

/**
 * Hook to connect to the SSE endpoint and handle real-time updates.
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Pauses when tab is not visible
 * - Handles all SSE event types
 * 
 * @param handlers - Callbacks for each event type
 * @param enabled - Whether SSE should be enabled (default: true)
 */
export function useSSE(handlers: SSEHandlers, enabled: boolean = true) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const handlersRef = useRef(handlers);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(() => {
    // Don't connect if disabled or already connected
    if (!enabled || eventSourceRef.current) {
      return;
    }

    // Don't connect if tab is not visible
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }

    try {
      console.log('🔌 [SSE] Connecting to /api/sse...');
      const eventSource = new EventSource('/api/sse');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('🔌 [SSE] Connection opened');
        setIsConnected(true);
        setConnectionError(null);
        // Reset reconnect delay on successful connection
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
      };

      eventSource.onmessage = (event) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);
          
          switch (sseEvent.type) {
            case 'connected':
              handlersRef.current.onConnected?.(sseEvent.data);
              break;
            case 'labels':
              handlersRef.current.onLabels?.(sseEvent.data);
              break;
            case 'nodeTypes':
              handlersRef.current.onNodeTypes?.(sseEvent.data);
              break;
            case 'followers':
              handlersRef.current.onFollowers?.(sseEvent.data);
              break;
            case 'followings':
              handlersRef.current.onFollowings?.(sseEvent.data);
              break;
            case 'stats:global':
              handlersRef.current.onGlobalStats?.(sseEvent.data);
              break;
            case 'stats:user':
              handlersRef.current.onUserStats?.(sseEvent.data);
              break;
            case 'importJob':
              handlersRef.current.onImportJob?.(sseEvent.data);
              break;
            default:
              console.warn('🔌 [SSE] Unknown event type:', (sseEvent as any).type);
          }
        } catch (parseError) {
          console.error('🔌 [SSE] Failed to parse event:', parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error('🔌 [SSE] Connection error:', error);
        setIsConnected(false);
        setConnectionError('Connection lost');
        handlersRef.current.onError?.(new Error('SSE connection error'));
        
        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;
        
        // Schedule reconnection with exponential backoff
        if (enabled && document.visibilityState === 'visible') {
          const delay = reconnectDelayRef.current;
          console.log(`🔌 [SSE] Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, delay);
          
          // Increase delay for next attempt (with max cap)
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * RECONNECT_BACKOFF_MULTIPLIER,
            MAX_RECONNECT_DELAY_MS
          );
        }
      };

    } catch (error) {
      console.error('🔌 [SSE] Failed to create EventSource:', error);
      setConnectionError('Failed to connect');
      handlersRef.current.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      console.log('🔌 [SSE] Disconnecting...');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Handle visibility changes - disconnect when hidden, reconnect when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reconnect if not connected
        if (!eventSourceRef.current && enabled) {
          console.log('🔌 [SSE] Tab visible, reconnecting...');
          reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
          connect();
        }
      } else {
        // Disconnect when tab is hidden to save server resources
        console.log('🔌 [SSE] Tab hidden, disconnecting to save resources...');
        disconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    connectionError,
    reconnect: connect,
    disconnect,
  };
}

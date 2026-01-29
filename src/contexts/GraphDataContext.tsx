'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { GraphNode, BoundingBox, AUTH_TILE_CONFIG, TileConfig } from '@/lib/types/graph';
import { MatchingTarget } from '@/lib/types/matching';
import { FollowingHashStatus } from '@/hooks/usePersonalNetwork';
import { tableFromIPC, Table } from 'apache-arrow';
import { useSSE, SSELabelsData, SSENodeTypesData, SSEFollowingsData } from '@/hooks/useSSE';

// Event emitter for cross-hook communication (replaces polling)
type GraphDataEventType = 'followingHashesUpdated' | 'followerHashesUpdated' | 'matchingDataUpdated' | 'baseNodesUpdated' | 'personalLabelsUpdated';

// Helper to create coordinate hash (same format as used in API)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

 function normalizeCoordHash(hash: string): string {
   const [xStr, yStr] = hash.split('_');
   if (!xStr || !yStr) return hash;
   const x = Number(xStr);
   const y = Number(yStr);
   if (!Number.isFinite(x) || !Number.isFinite(y)) return hash;
   return coordHash(x, y);
 }

// Personal label types - uses coord_hash instead of twitter_id for RGPD compliance
interface FloatingLabel {
  coord_hash: string;  // Hash based on x,y coordinates
  x: number;
  y: number;
  text: string;
  priority: number;
  level: number;
}

// Cache-optimized node type (without twitter_id)
interface CachedGraphNode {
  coord_hash: string;  // Hash based on x,y coordinates (used as id)
  label: string;
  x: number;
  y: number;
  community: number | null;
  degree: number;
  tier: string;
  nodeType?: string;
  graphLabel?: string;
  description?: string | null;  // description from graph_personal_labels (for tooltip)
}

// Normalization bounds for coordinate transformation (cached for instant label display)
interface NormalizationBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  centerX: number;
  centerY: number;
}
type GraphDataEventCallback = () => void;

class GraphDataEventEmitter {
  private listeners: Map<GraphDataEventType, Set<GraphDataEventCallback>> = new Map();

  on(event: GraphDataEventType, callback: GraphDataEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: GraphDataEventType, callback: GraphDataEventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: GraphDataEventType) {
    this.listeners.get(event)?.forEach(cb => cb());
  }
}

// Singleton event emitter
const graphDataEvents = new GraphDataEventEmitter();

// ============================================
// Tile Cache for progressive loading
// ============================================

interface TileCacheEntry {
  nodes: GraphNode[];
  timestamp: number;
}

class TileCache {
  private cache: Map<string, TileCacheEntry> = new Map();
  private maxSize: number;

  constructor(maxSize: number = AUTH_TILE_CONFIG.TILE_CACHE_SIZE) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  getTileKey(bbox: BoundingBox, zoom: number): string {
    // Round to 2 decimals for reasonable tile granularity
    return `${bbox.minX.toFixed(2)}_${bbox.maxX.toFixed(2)}_${bbox.minY.toFixed(2)}_${bbox.maxY.toFixed(2)}_z${zoom.toFixed(1)}`;
  }

  get(key: string): GraphNode[] | null {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end (most recently used) - LRU behavior
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.nodes;
    }
    return null;
  }

  set(key: string, nodes: GraphNode[]): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { nodes, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getAllNodes(): GraphNode[] {
    const allNodes: GraphNode[] = [];
    const seenIds = new Set<string>();
    
    this.cache.forEach(entry => {
      entry.nodes.forEach(node => {
        if (!seenIds.has(node.id)) {
          seenIds.add(node.id);
          allNodes.push(node);
        }
      });
    });
    
    return allNodes;
  }

  getTotalNodeCount(): number {
    let count = 0;
    const seenIds = new Set<string>();
    
    this.cache.forEach(entry => {
      entry.nodes.forEach(node => {
        if (!seenIds.has(node.id)) {
          seenIds.add(node.id);
          count++;
        }
      });
    });
    
    return count;
  }
}

// Singleton tile cache
const tileCache = new TileCache();

// User node type (from personal-hashes API)
interface UserNode {
  x: number;
  y: number;
  label: string | null;
  community: number | null;
  tier: string | null;
  degree: number;
}

// Global state to prevent duplicate API calls across components
interface GlobalGraphState {
  baseNodes: GraphNode[];
  baseNodesLoaded: boolean;
  normalizationBounds: NormalizationBounds | null;
  followingHashes: Map<string, FollowingHashStatus>;
  followerHashes: Set<string>;
  effectiveFollowerHashes: Set<string>; // Followers who actually followed via OP (purple highlight)
  userNode: UserNode | null;
  matchingData: MatchingTarget[];
  matchingDataLoaded: boolean;
  hashesLoaded: boolean;
  // Separate loaded flags for different TTLs
  followingHashesLoaded: boolean; // 30min TTL
  followerHashesLoaded: boolean;  // 24h TTL
  // Personal labels
  personalLabelMap: Record<string, string>;
  personalFloatingLabels: FloatingLabel[];
  personalLabelsLoaded: boolean;
  // Followings labels (mode Followings)
  followingsLabelMap: Record<string, string>;
  followingsFloatingLabels: FloatingLabel[];
  followingsLabelsLoaded: boolean;
  // Personal data (unified: matching + hashes)
  personalDataLoaded: boolean;
}

const globalGraphState: GlobalGraphState = {
  baseNodes: [],
  baseNodesLoaded: false,
  normalizationBounds: null,
  followingHashes: new Map(),
  followerHashes: new Set(),
  effectiveFollowerHashes: new Set(),
  userNode: null,
  matchingData: [],
  matchingDataLoaded: false,
  hashesLoaded: false,
  followingHashesLoaded: false,
  followerHashesLoaded: false,
  personalLabelMap: {},
  personalFloatingLabels: [],
  personalLabelsLoaded: false,
  // Followings labels (mode Followings)
  followingsLabelMap: {},
  followingsFloatingLabels: [],
  followingsLabelsLoaded: false,
  personalDataLoaded: false,
};

// Expose globalGraphState on window for cross-hook synchronization (useReconnectState)
if (typeof window !== 'undefined') {
  (window as any).__globalGraphState = globalGraphState;
}

// IndexedDB configuration
const IDB_NAME = 'hqx_graph_cache';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'graph_data';

// Cache TTL: different for nodes vs labels vs hashes
const CACHE_TTL_NODES_MS = 24 * 60 * 60 * 1000; // 24 hours for base nodes (stable data)
const CACHE_TTL_LABELS_MS = 5 * 60 * 1000; // 5 minutes for labels cache validity
const CACHE_TTL_FOLLOWER_HASHES_MS = 24 * 60 * 60 * 1000; // 24 hours for follower hashes (rarely changes)
const CACHE_TTL_FOLLOWING_HASHES_MS = 30 * 60 * 1000; // 30 minutes for following hashes (changes after follow)

// SSE replaces polling for cross-client sync (labels + node_type changes)
// Kept for reference but no longer used
// const SYNC_POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

// IndexedDB helper class
class GraphIndexedDB {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB not available on server'));
        return;
      }

      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onerror = () => {
        console.error('💾 [IndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  async save<T>(key: string, data: T): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NAME);

      const record = {
        key,
        data,
        timestamp: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          console.error(`💾 [IndexedDB] Failed to save ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (err) {
      console.warn(`💾 [IndexedDB] Failed to save ${key}:`, err);
    }
  }

  async load<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
    if (typeof window === 'undefined') return null;

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = transaction.objectStore(IDB_STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve({ data: result.data as T, timestamp: result.timestamp });
          } else {
            resolve(null);
          }
        };
        request.onerror = () => {
          console.error(`💾 [IndexedDB] Failed to load ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (err) {
      console.warn(`💾 [IndexedDB] Failed to load ${key}:`, err);
      return null;
    }
  }

  isCacheValidForNodes(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age < CACHE_TTL_NODES_MS;
  }

  isCacheValidForLabels(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age < CACHE_TTL_LABELS_MS;
  }

  isCacheValidForFollowerHashes(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age < CACHE_TTL_FOLLOWER_HASHES_MS;
  }

  isCacheValidForFollowingHashes(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age < CACHE_TTL_FOLLOWING_HASHES_MS;
  }

  async delete(key: string): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          console.error(`💾 [IndexedDB] Failed to delete ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (err) {
      console.warn(`💾 [IndexedDB] Failed to delete ${key}:`, err);
    }
  }
}

// Singleton instance
const graphIDB = new GraphIndexedDB();

// Cache keys
const CACHE_KEYS = {
  BASE_NODES: 'base_nodes',
  PERSONAL_LABELS: 'personal_labels',
  NORMALIZATION_BOUNDS: 'normalization_bounds',
  GRAPH_NODES_VERSION: 'graph_nodes_version', // Version from Redis to detect changes
  FOLLOWING_HASHES: 'following_hashes', // Followings hashes with status
  FOLLOWER_HASHES: 'follower_hashes', // Followers hashes (simple set)
  USER_NODE: 'user_node', // User's own node in the graph
};

// Cached hash data structure
interface CachedFollowingHashes {
  hashes: Array<{ coord_hash: string; has_follow_bluesky: boolean; has_follow_mastodon: boolean; has_matching: boolean }>;
  lastUpdated: number; // Server timestamp for delta queries
}

interface CachedFollowerHashes {
  hashes: string[];
  effectiveHashes?: string[]; // Followers who actually followed via OP (purple highlight)
  lastUpdated: number;
}

// Check if graph nodes version has changed (member nodes updated)
async function checkGraphNodesVersion(): Promise<{ changed: boolean; serverVersion: number }> {
  try {
    const response = await fetch('/api/internal/sync-member-node', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) {
      return { changed: false, serverVersion: 0 };
    }
    const data = await response.json();
    const serverVersion = data.version || 0;
    
    // Get cached version from IndexedDB
    const cached = await graphIDB.load<number>(CACHE_KEYS.GRAPH_NODES_VERSION);
    const cachedVersion = cached?.data || 0;
    
    if (serverVersion > cachedVersion) {
      // Save new version
      await graphIDB.save(CACHE_KEYS.GRAPH_NODES_VERSION, serverVersion);
      return { changed: true, serverVersion };
    }
    
    return { changed: false, serverVersion };
  } catch (err) {
    console.warn('📊 [GraphDataProvider] Failed to check graph nodes version:', err);
    return { changed: false, serverVersion: 0 };
  }
}

// Context value interface
interface GraphDataContextValue {
  // Base nodes from Mosaic/DuckDB
  baseNodes: GraphNode[];
  setBaseNodes: (nodes: GraphNode[]) => void;
  isBaseNodesLoaded: boolean;
  isBaseNodesLoading: boolean;
  fetchBaseNodes: () => Promise<void>;
  
  // Normalization bounds for coordinate transformation (cached for instant label display)
  normalizationBounds: NormalizationBounds | null;
  
  // Stable hash Sets/Maps for highlighting (RGPD-friendly)
  followingHashes: Map<string, FollowingHashStatus>;
  followerHashes: Set<string>;
  effectiveFollowerHashes: Set<string>; // Followers who actually followed via OP (purple highlight)
  
  // User's own node in the graph (if exists)
  userNode: UserNode | null;
  
  // Matching data for accounts panel
  matchingData: MatchingTarget[];
  
  // Personal labels for tooltips/floating labels
  personalLabelMap: Record<string, string>;
  personalFloatingLabels: FloatingLabel[];
  isPersonalLabelsLoaded: boolean;
  isPersonalLabelsLoading: boolean;
  fetchPersonalLabels: () => Promise<void>;
  invalidateLabelsCache: () => Promise<void>;
  
  // Followings labels for mode Followings
  followingsLabelMap: Record<string, string>;
  followingsFloatingLabels: FloatingLabel[];
  isFollowingsLabelsLoaded: boolean;
  isFollowingsLabelsLoading: boolean;
  fetchFollowingsLabels: () => Promise<void>;
  
  // Loading states
  isHashesLoading: boolean;
  hashesLoaded: boolean;
  isMatchingLoading: boolean;
  isPersonalDataLoading: boolean;
  isPersonalDataLoaded: boolean;
  
  // Fetch functions
  fetchHashes: () => Promise<void>;
  fetchMatchingData: () => Promise<void>;
  
  // Unified personal data fetch (matching + hashes)
  // options.includeHashes: false for mobile (no graph to highlight)
  fetchPersonalData: (options?: { includeHashes?: boolean }) => Promise<void>;
  refetchPersonalData: (options?: { includeHashes?: boolean }) => Promise<void>;
  
  // Update follow status for specific hashes (lightweight, after follow action)
  updateFollowingStatus: (coordHashes: string[], platform: 'bluesky' | 'mastodon', followed: boolean) => void;
  
  // Event subscription for cross-component updates
  subscribeToUpdates: (event: GraphDataEventType, callback: GraphDataEventCallback) => () => void;
  
  // Version counter for nodeType changes (triggers re-renders when nodeTypes change via SSE)
  nodeTypeVersion: number;
  
  // Tile-based progressive loading
  tileNodes: GraphNode[];
  mergedNodes: GraphNode[];  // baseNodes + tileNodes (deduplicated)
  isTileLoading: boolean;
  currentZoom: number;
  tileConfig: TileConfig;
  setMaxMemoryNodes: (maxNodes: number) => void;
  fetchDetailNodes: (bbox?: BoundingBox) => Promise<void>;
  onViewportChange: (boundingBox: BoundingBox, zoomLevel: number) => void;
  clearTileCache: () => void;
}

const GraphDataContext = createContext<GraphDataContextValue | null>(null);

export function useGraphData() {
  const context = useContext(GraphDataContext);
  if (!context) {
    throw new Error('useGraphData must be used within a GraphDataProvider');
  }
  return context;
}

// Optional hook that returns null if not in provider (for gradual migration)
export function useGraphDataOptional() {
  return useContext(GraphDataContext);
}

interface GraphDataProviderProps {
  children: ReactNode;
}

export function GraphDataProvider({ children }: GraphDataProviderProps) {
  // Local state that syncs with global state
  const [baseNodes, setBaseNodesState] = useState<GraphNode[]>(globalGraphState.baseNodes);
  const [isBaseNodesLoaded, setIsBaseNodesLoaded] = useState(globalGraphState.baseNodesLoaded);
  const [isBaseNodesLoading, setIsBaseNodesLoading] = useState(false);
  
  // Normalization bounds state (cached for instant label display)
  const [normalizationBounds, setNormalizationBoundsState] = useState<NormalizationBounds | null>(globalGraphState.normalizationBounds);
  
  // Personal labels state
  const [personalLabelMap, setPersonalLabelMapState] = useState<Record<string, string>>(globalGraphState.personalLabelMap);
  const [personalFloatingLabels, setPersonalFloatingLabelsState] = useState<FloatingLabel[]>(globalGraphState.personalFloatingLabels);
  const [isPersonalLabelsLoaded, setIsPersonalLabelsLoaded] = useState(globalGraphState.personalLabelsLoaded);
  const [isPersonalLabelsLoading, setIsPersonalLabelsLoading] = useState(false);
  
  // Followings labels state (mode Followings)
  const [followingsLabelMap, setFollowingsLabelMapState] = useState<Record<string, string>>(globalGraphState.followingsLabelMap);
  const [followingsFloatingLabels, setFollowingsFloatingLabelsState] = useState<FloatingLabel[]>(globalGraphState.followingsFloatingLabels);
  const [isFollowingsLabelsLoaded, setIsFollowingsLabelsLoaded] = useState(globalGraphState.followingsLabelsLoaded);
  const [isFollowingsLabelsLoading, setIsFollowingsLabelsLoading] = useState(false);
  
  // Use refs for Sets/Maps to maintain stable references
  const followingHashesRef = useRef<Map<string, FollowingHashStatus>>(globalGraphState.followingHashes);
  const followerHashesRef = useRef<Set<string>>(globalGraphState.followerHashes);
  const effectiveFollowerHashesRef = useRef<Set<string>>(globalGraphState.effectiveFollowerHashes);
  
  // User node state (user's position in the graph)
  const [userNode, setUserNodeState] = useState<UserNode | null>(globalGraphState.userNode);
  
  // State to trigger re-renders when hashes change (but Sets stay stable)
  const [hashesVersion, setHashesVersion] = useState(0);
  
  // State to trigger re-renders when nodeTypes change via SSE
  const [nodeTypeVersion, setNodeTypeVersion] = useState(0);
  
  const [matchingData, setMatchingDataState] = useState<MatchingTarget[]>(globalGraphState.matchingData);
  const [isHashesLoading, setIsHashesLoading] = useState(false);
  const [isMatchingLoading, setIsMatchingLoading] = useState(false);
  const [isPersonalDataLoading, setIsPersonalDataLoading] = useState(false);
  const [isPersonalDataLoaded, setIsPersonalDataLoaded] = useState(globalGraphState.personalDataLoaded);
  
  // Fetch promise refs to prevent duplicate calls
  const hashesPromiseRef = useRef<Promise<void> | null>(null);
  const matchingPromiseRef = useRef<Promise<void> | null>(null);
  const baseNodesPromiseRef = useRef<Promise<void> | null>(null);
  const personalLabelsPromiseRef = useRef<Promise<void> | null>(null);
  const personalDataPromiseRef = useRef<Promise<void> | null>(null);
  const followingsLabelsPromiseRef = useRef<Promise<void> | null>(null);
  
  // Labels version ref for SSE cache validation
  const labelsVersionRef = useRef<number>(0);
  
  // ============================================
  // Tile-based progressive loading state
  // ============================================
  const [tileNodes, setTileNodes] = useState<GraphNode[]>([]);
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [baseNodesMinDegree, setBaseNodesMinDegree] = useState<number>(0); // Min degree of baseNodes, tiles load nodes below this
  const [currentMinDegree, setCurrentMinDegree] = useState<number>(0); // Track min degree for progressive loading
  const tilePromiseRef = useRef<Promise<void> | null>(null);
  const viewportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchDetailNodesRef = useRef<((bbox?: BoundingBox, batchMultiplier?: number) => Promise<void>) | null>(null);
  const prevZoomRef = useRef<number>(0);
  const currentBboxRef = useRef<BoundingBox | null>(null);
  
  // Customizable tile config (user can adjust MAX_MEMORY_NODES)
  const [maxMemoryNodes, setMaxMemoryNodesState] = useState(AUTH_TILE_CONFIG.MAX_MEMORY_NODES);
  const tileConfig = useMemo(() => ({
    ...AUTH_TILE_CONFIG,
    MAX_MEMORY_NODES: maxMemoryNodes,
  }), [maxMemoryNodes]);
  
  // Setter for max memory nodes (exposed to UI)
  const setMaxMemoryNodes = useCallback((maxNodes: number) => {
    const clamped = Math.max(50_000, Math.min(660_000, maxNodes));
    setMaxMemoryNodesState(clamped);
    console.log(`📊 [GraphData] Max memory nodes set to ${clamped.toLocaleString()}`);
  }, []);

  // Stable Set references via useMemo (only changes when version changes)
  const followingHashes = useMemo(() => followingHashesRef.current, [hashesVersion]);
  const followerHashes = useMemo(() => followerHashesRef.current, [hashesVersion]);
  const effectiveFollowerHashes = useMemo(() => effectiveFollowerHashesRef.current, [hashesVersion]);

  // Helper to calculate normalization bounds from nodes
  const calculateBounds = useCallback((nodes: GraphNode[]): NormalizationBounds => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const maxRange = Math.max(rangeX, rangeY);
    const isNormalized = (minX >= -1.1 && maxX <= 1.1) || (minX >= -0.1 && maxX <= 1.1);
    const scale = isNormalized ? 100 : (200 / maxRange);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return { minX, maxX, minY, maxY, scale, centerX, centerY };
  }, []);

  // Auto-load data from IndexedDB cache on mount (for instant display)
  useEffect(() => {
    const loadCachedData = async () => {
      // ALWAYS check labels version on mount, even if labels are already loaded in memory
      // This handles the case where user was on another page when cache was invalidated
      console.log('🔄 [Labels Mount] Checking server version... (labelsLoaded:', globalGraphState.personalLabelsLoaded, ', localVersion:', labelsVersionRef.current, ')');
      try {
        const versionResponse = await fetch('/api/graph/refresh-labels-cache', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (versionResponse.ok) {
          const versionData = await versionResponse.json();
          const serverVersion = versionData.version || 0;
          console.log('🔄 [Labels Mount] Server version:', serverVersion, ', local version:', labelsVersionRef.current);
          
          // If we have labels in memory, check if they're stale
          if (globalGraphState.personalLabelsLoaded) {
            console.log('🔄 [Labels Mount] Labels already loaded, comparing versions...');
            // If local version is 0, it means labels were loaded from old cache without version
            // In this case, we need to check against IndexedDB cache version
            let effectiveLocalVersion = labelsVersionRef.current;
            if (effectiveLocalVersion === 0) {
              // Try to get version from IndexedDB cache
              try {
                const cached = await graphIDB.load<{ version?: number }>(CACHE_KEYS.PERSONAL_LABELS);
                effectiveLocalVersion = cached?.data?.version || cached?.timestamp || 0;
                console.log('🔄 [Labels Mount] Got version from IndexedDB cache:', effectiveLocalVersion);
              } catch {
                // Ignore
              }
            }
            
            if (serverVersion > effectiveLocalVersion) {
              console.log('🔄 [Labels Mount] Memory cache stale! (server:', serverVersion, '> local:', effectiveLocalVersion, '), invalidating...');
              // Invalidate memory and IndexedDB cache
              globalGraphState.personalLabelsLoaded = false;
              globalGraphState.personalLabelMap = {};
              globalGraphState.personalFloatingLabels = [];
              await graphIDB.delete(CACHE_KEYS.PERSONAL_LABELS);
              setPersonalLabelMapState({});
              setPersonalFloatingLabelsState([]);
              setIsPersonalLabelsLoaded(false);
              personalLabelsPromiseRef.current = null;
            } else {
              console.log('🔄 [Labels Mount] Memory cache still valid');
              // Update version ref if it was 0
              if (labelsVersionRef.current === 0 && effectiveLocalVersion > 0) {
                labelsVersionRef.current = effectiveLocalVersion;
              }
            }
          } else {
            console.log('🔄 [Labels Mount] No labels in memory yet, will load from cache/API');
          }
          // Update version ref for future comparisons
          if (serverVersion > 0) {
            labelsVersionRef.current = serverVersion;
          }
        } else {
          console.log('🔄 [Labels Mount] Version check failed, response not ok');
        }
      } catch (err) {
        console.log('🔄 [Labels Mount] Version check error:', err);
        // If version check fails, continue with existing cache
      }
      
      // Check if graph nodes version has changed (member nodes updated)
      // If changed, invalidate the base nodes cache
      const { changed: versionChanged } = await checkGraphNodesVersion();
      if (versionChanged) {
        await graphIDB.delete(CACHE_KEYS.BASE_NODES);
        globalGraphState.baseNodesLoaded = false;
        globalGraphState.baseNodes = [];
      }
      
      // Load normalization bounds from cache first (for instant label display)
      if (!globalGraphState.normalizationBounds) {
        try {
          const cachedBounds = await graphIDB.load<NormalizationBounds>(CACHE_KEYS.NORMALIZATION_BOUNDS);
          if (cachedBounds && graphIDB.isCacheValidForNodes(cachedBounds.timestamp)) {
            globalGraphState.normalizationBounds = cachedBounds.data;
            setNormalizationBoundsState(cachedBounds.data);
          }
        } catch (err) {
          console.warn('💾 [IndexedDB] Failed to auto-load normalization bounds:', err);
        }
      }

      // Load base nodes from cache if not already loaded
      if (!globalGraphState.baseNodesLoaded) {
        try {
          const cached = await graphIDB.load<CachedGraphNode[]>(CACHE_KEYS.BASE_NODES);
          if (cached && graphIDB.isCacheValidForNodes(cached.timestamp)) {
            const loadedNodes: GraphNode[] = cached.data.map(node => ({
              id: node.coord_hash,
              label: node.label,
              x: node.x,
              y: node.y,
              community: node.community,
              degree: node.degree,
              tier: node.tier as GraphNode['tier'],
              nodeType: node.nodeType as GraphNode['nodeType'],
              graphLabel: node.graphLabel,
              description: node.description,
              size: 1,
              color: '#ffffff',
            }));
            
            globalGraphState.baseNodes = loadedNodes;
            globalGraphState.baseNodesLoaded = true;
            setBaseNodesState(loadedNodes);
            setIsBaseNodesLoaded(true);
            graphDataEvents.emit('baseNodesUpdated');
            
            // Calculate and cache bounds if not already loaded
            if (!globalGraphState.normalizationBounds && loadedNodes.length > 0) {
              const bounds = calculateBounds(loadedNodes);
              globalGraphState.normalizationBounds = bounds;
              setNormalizationBoundsState(bounds);
              graphIDB.save(CACHE_KEYS.NORMALIZATION_BOUNDS, bounds).catch(err => {
                console.warn('💾 [IndexedDB] Failed to cache normalization bounds:', err);
              });
            }
          }
        } catch (err) {
          console.warn('💾 [IndexedDB] Failed to auto-load base nodes:', err);
        }
      }

      // Load personal labels from cache if not already loaded
      // But first check server version to ensure cache is still valid
      if (!globalGraphState.personalLabelsLoaded) {
        try {
          const cached = await graphIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[]; version?: number }>(CACHE_KEYS.PERSONAL_LABELS);
          if (cached && graphIDB.isCacheValidForLabels(cached.timestamp)) {
            // Check server version before using cache
            let serverVersion = 0;
            try {
              const versionResponse = await fetch('/api/graph/refresh-labels-cache', {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' },
              });
              if (versionResponse.ok) {
                const versionData = await versionResponse.json();
                serverVersion = versionData.version || 0;
              }
            } catch {
              // If version check fails, use cache anyway
            }
            
            // Only use cache if server version matches or we couldn't check
            const cachedVersion = cached.data.version || cached.timestamp;
            if (serverVersion === 0 || serverVersion <= cachedVersion) {
              globalGraphState.personalLabelMap = cached.data.labelMap;
              globalGraphState.personalFloatingLabels = cached.data.floatingLabels;
              globalGraphState.personalLabelsLoaded = true;
              setPersonalLabelMapState(cached.data.labelMap);
              setPersonalFloatingLabelsState(cached.data.floatingLabels);
              setIsPersonalLabelsLoaded(true);
              labelsVersionRef.current = serverVersion || cachedVersion;
              graphDataEvents.emit('personalLabelsUpdated');
            } else {
              // Cache is stale, delete it so fetchPersonalLabels will get fresh data
              console.log('🔄 [Labels] Cache stale (server:', serverVersion, 'cache:', cachedVersion, '), will fetch fresh');
              await graphIDB.delete(CACHE_KEYS.PERSONAL_LABELS);
            }
          }
        } catch (err) {
          console.warn('💾 [IndexedDB] Failed to auto-load personal labels:', err);
        }
      }

      // Load hashes from cache - check each type independently
      // BUT skip cache if coming from large-files upload (fresh data needed)
      const fromLargeFiles = typeof window !== 'undefined' && sessionStorage.getItem('fromLargeFiles') === 'true';
      if (fromLargeFiles) {
        // Clear the flag so subsequent navigations use cache normally
        sessionStorage.removeItem('fromLargeFiles');
        // Also invalidate the cache entries
        await graphIDB.delete(CACHE_KEYS.FOLLOWING_HASHES);
        await graphIDB.delete(CACHE_KEYS.FOLLOWER_HASHES);
        await graphIDB.delete(CACHE_KEYS.USER_NODE);
        // Reset the global state flags so fetchHashes and fetchPersonalData will actually fetch
        globalGraphState.followingHashesLoaded = false;
        globalGraphState.followerHashesLoaded = false;
        globalGraphState.hashesLoaded = false;
        globalGraphState.followingHashes = new Map();
        globalGraphState.followerHashes = new Set();
        globalGraphState.userNode = null;
        // Also reset matching data flags
        globalGraphState.matchingDataLoaded = false;
        globalGraphState.personalDataLoaded = false;
        globalGraphState.matchingData = [];
        // Also reset the refs
        followingHashesRef.current = new Map();
        followerHashesRef.current = new Set();
        setUserNodeState(null);
        setMatchingDataState([]);
        setIsPersonalDataLoaded(false);
        setHashesVersion((v: number) => v + 1);
        // Don't return - just skip loading hashes from cache, API will fetch fresh data
      } else try {
        let followingsLoaded = false;
        let followersLoaded = false;
        
        // Load following hashes (30min TTL) - only if not already in memory
        if (!globalGraphState.followingHashesLoaded) {
          const cachedFollowings = await graphIDB.load<CachedFollowingHashes>(CACHE_KEYS.FOLLOWING_HASHES);
          if (cachedFollowings && graphIDB.isCacheValidForFollowingHashes(cachedFollowings.timestamp)) {
            const hashesMap = new Map<string, FollowingHashStatus>();
            for (const item of cachedFollowings.data.hashes) {
              hashesMap.set(normalizeCoordHash(item.coord_hash), {
                hasBlueskyFollow: item.has_follow_bluesky,
                hasMastodonFollow: item.has_follow_mastodon,
                hasMatching: item.has_matching,
              });
            }
            followingHashesRef.current = hashesMap;
            globalGraphState.followingHashes = hashesMap;
            globalGraphState.followingHashesLoaded = true;
            followingsLoaded = true;
          }
        }

        // Load follower hashes (24h TTL - rarely changes) - only if not already in memory
        if (!globalGraphState.followerHashesLoaded) {
          const cachedFollowers = await graphIDB.load<CachedFollowerHashes>(CACHE_KEYS.FOLLOWER_HASHES);
          if (cachedFollowers && graphIDB.isCacheValidForFollowerHashes(cachedFollowers.timestamp)) {
            const hashesSet = new Set(cachedFollowers.data.hashes.map(normalizeCoordHash));
            const effectiveHashesSet = new Set((cachedFollowers.data.effectiveHashes || []).map(normalizeCoordHash));
            followerHashesRef.current = hashesSet;
            effectiveFollowerHashesRef.current = effectiveHashesSet;
            globalGraphState.followerHashes = hashesSet;
            globalGraphState.effectiveFollowerHashes = effectiveHashesSet;
            globalGraphState.followerHashesLoaded = true;
            followersLoaded = true;
          }
        }

        // Load user node from cache (same TTL as following hashes)
        if (!globalGraphState.userNode) {
          const cachedUserNode = await graphIDB.load<UserNode>(CACHE_KEYS.USER_NODE);
          if (cachedUserNode && graphIDB.isCacheValidForFollowingHashes(cachedUserNode.timestamp)) {
            globalGraphState.userNode = cachedUserNode.data;
            setUserNodeState(cachedUserNode.data);
          }
        }

        // Update global loaded state
        if (globalGraphState.followingHashesLoaded && globalGraphState.followerHashesLoaded) {
          globalGraphState.hashesLoaded = true;
        }
        
        if (followingsLoaded || followersLoaded) {
          setHashesVersion((v: number) => v + 1);
          if (followingsLoaded) graphDataEvents.emit('followingHashesUpdated');
          if (followersLoaded) graphDataEvents.emit('followerHashesUpdated');
        }
      } catch (err) {
        console.warn('💾 [IndexedDB] Failed to auto-load hashes:', err);
      }
    };

    loadCachedData();
  }, [calculateBounds]);

  // ===== SSE for real-time updates (replaces polling) =====
  // SSE handlers for labels, node types, and following status updates
  const handleSSELabels = useCallback(async (data: SSELabelsData) => {
    // Handle incremental label changes (add/remove single label)
    if (data.incremental && data.change) {
      const { coord_hash, action, label } = data.change;
      console.log(`🔌 [SSE] Incremental label ${action}: ${coord_hash}`);
      
      if (action === 'add' && label) {
        // Add new label to existing state
        const newLabelMap = { ...globalGraphState.personalLabelMap, [coord_hash]: label.text };
        const newFloatingLabel: FloatingLabel = {
          coord_hash,
          x: label.x,
          y: label.y,
          text: label.text,
          priority: label.priority || 50,
          level: 0,
        };
        // Check if label already exists, if so update it, otherwise add
        const existingIndex = globalGraphState.personalFloatingLabels.findIndex(l => l.coord_hash === coord_hash);
        let newFloatingLabels: FloatingLabel[];
        if (existingIndex >= 0) {
          newFloatingLabels = [...globalGraphState.personalFloatingLabels];
          newFloatingLabels[existingIndex] = newFloatingLabel;
        } else {
          newFloatingLabels = [...globalGraphState.personalFloatingLabels, newFloatingLabel];
        }
        
        globalGraphState.personalLabelMap = newLabelMap;
        globalGraphState.personalFloatingLabels = newFloatingLabels;
        setPersonalLabelMapState(newLabelMap);
        setPersonalFloatingLabelsState(newFloatingLabels);
        
        // Update IndexedDB cache
        graphIDB.save(CACHE_KEYS.PERSONAL_LABELS, { 
          labelMap: newLabelMap, 
          floatingLabels: newFloatingLabels, 
          version: Date.now() 
        }).catch(() => {});
        
        console.log(`🔌 [SSE] Added label for ${coord_hash}: "${label.text}"`);
      } else if (action === 'remove') {
        // Remove label from existing state
        const newLabelMap = { ...globalGraphState.personalLabelMap };
        delete newLabelMap[coord_hash];
        const newFloatingLabels = globalGraphState.personalFloatingLabels.filter(l => l.coord_hash !== coord_hash);
        
        globalGraphState.personalLabelMap = newLabelMap;
        globalGraphState.personalFloatingLabels = newFloatingLabels;
        setPersonalLabelMapState(newLabelMap);
        setPersonalFloatingLabelsState(newFloatingLabels);
        
        // Update IndexedDB cache
        graphIDB.save(CACHE_KEYS.PERSONAL_LABELS, { 
          labelMap: newLabelMap, 
          floatingLabels: newFloatingLabels, 
          version: Date.now() 
        }).catch(() => {});
        
        console.log(`🔌 [SSE] Removed label for ${coord_hash}`);
      }
      
      graphDataEvents.emit('personalLabelsUpdated');
      return;
    }
    
    // Handle full invalidation (fallback for non-incremental updates)
    if (data.invalidated) {
      // Reset the loaded flag to force a fresh fetch
      globalGraphState.personalLabelsLoaded = false;
      globalGraphState.personalLabelMap = {};
      globalGraphState.personalFloatingLabels = [];
      personalLabelsPromiseRef.current = null;
      
      // Delete old cache
      await graphIDB.delete(CACHE_KEYS.PERSONAL_LABELS);
      
      // Reset state
      setPersonalLabelMapState({});
      setPersonalFloatingLabelsState([]);
      setIsPersonalLabelsLoaded(false);
      
      // Fetch fresh labels from server
      try {
        const labelsResponse = await fetch('/api/graph/consent_labels', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (labelsResponse.ok) {
          const labelsData = await labelsResponse.json();
          if (labelsData.success) {
            const labelMap = labelsData.labelMap || {};
            const floatingLabels: FloatingLabel[] = (labelsData.floatingLabels || []).map((label: any) => ({
              coord_hash: label.coord_hash,
              x: label.x,
              y: label.y,
              text: label.text,
              priority: label.priority,
              level: label.level,
            }));
            
            globalGraphState.personalLabelMap = labelMap;
            globalGraphState.personalFloatingLabels = floatingLabels;
            globalGraphState.personalLabelsLoaded = true;
            setPersonalLabelMapState(labelMap);
            setPersonalFloatingLabelsState(floatingLabels);
            setIsPersonalLabelsLoaded(true);
            
            // Save to IndexedDB cache with version
            graphIDB.save(CACHE_KEYS.PERSONAL_LABELS, { labelMap, floatingLabels, version: data.version }).catch(() => {});
            
            console.log(`🔌 [SSE] Refetched ${Object.keys(labelMap).length} labels`);
          }
        }
      } catch (fetchError) {
        console.warn('Failed to refetch labels after SSE notification:', fetchError);
      }
      
      graphDataEvents.emit('personalLabelsUpdated');
    }
  }, []);

  const handleSSENodeTypes = useCallback((data: SSENodeTypesData) => {
    console.log('🔌 [SSE] NodeTypes update received:', data);
    
    // Only apply if base nodes are loaded
    if (!globalGraphState.baseNodesLoaded || globalGraphState.baseNodes.length === 0) {
      console.log('🔌 [SSE] Skipping node type update - base nodes not loaded yet');
      return;
    }
    
    const changes = data.changes || [];
    if (changes.length > 0) {
      console.log('🔌 [SSE] Applying', changes.length, 'node type changes');
      let hasUpdates = false;
      const updatedNodes = globalGraphState.baseNodes.map(node => {
        const change = changes.find(c => c.coord_hash === node.id);
        if (change && node.nodeType !== change.node_type) {
          hasUpdates = true;
          console.log('🔌 [SSE] Updating node', node.id, 'from', node.nodeType, 'to', change.node_type);
          return { ...node, nodeType: change.node_type as 'member' | 'generic' };
        }
        return node;
      });
      
      if (hasUpdates) {
        globalGraphState.baseNodes = updatedNodes;
        setBaseNodesState(updatedNodes);
        
        // Increment nodeTypeVersion to trigger re-renders in components using baseNodes
        setNodeTypeVersion((v: number) => v + 1);
        
        // Also update IndexedDB cache with new node_type values
        const cachedNodes: CachedGraphNode[] = updatedNodes.map(node => ({
          coord_hash: node.id,
          label: node.label,
          x: node.x,
          y: node.y,
          community: node.community,
          degree: node.degree,
          tier: node.tier,
          nodeType: node.nodeType,
          graphLabel: node.graphLabel || undefined,
          description: node.description || undefined,
        }));
        graphIDB.save(CACHE_KEYS.BASE_NODES, cachedNodes).catch(err => {
          console.warn('💾 [IndexedDB] Failed to update base nodes cache:', err);
        });
        
        graphDataEvents.emit('baseNodesUpdated');
      }
    }
  }, []);

  const handleSSEFollowings = useCallback((data: SSEFollowingsData) => {
    console.log('🔌 [SSE] Followings update received:', data);
    
    const updates = data.updates || [];
    if (updates.length > 0) {
      // Update followingHashes in memory
      const newFollowingHashes = new Map(globalGraphState.followingHashes);
      
      updates.forEach(update => {
        const existing = newFollowingHashes.get(update.coord_hash) || {
          hasBlueskyFollow: false,
          hasMastodonFollow: false,
          hasMatching: true,
        };
        
        if (update.platform === 'bluesky') {
          existing.hasBlueskyFollow = update.followed;
        } else if (update.platform === 'mastodon') {
          existing.hasMastodonFollow = update.followed;
        }
        
        newFollowingHashes.set(update.coord_hash, existing);
      });
      
      globalGraphState.followingHashes = newFollowingHashes;
      followingHashesRef.current = newFollowingHashes;
      setHashesVersion(v => v + 1); // Trigger re-render
      
      // Save to IndexedDB cache
      const hashesArray = Array.from(newFollowingHashes.entries()).map(([hash, status]) => ({
        coord_hash: hash,
        ...status,
      }));
      graphIDB.save(CACHE_KEYS.FOLLOWING_HASHES, hashesArray).catch(() => {});
      
      graphDataEvents.emit('followingHashesUpdated');
      console.log(`🔌 [SSE] Updated ${updates.length} following statuses`);
    }
  }, []);

  // Initialize SSE connection for real-time updates
  useSSE({
    onLabels: handleSSELabels,
    onNodeTypes: handleSSENodeTypes,
    onFollowings: handleSSEFollowings,
    onConnected: (data) => {
      console.log('🔌 [SSE] Connected to server:', data);
    },
    onError: (error) => {
      console.warn('🔌 [SSE] Connection error:', error);
    },
  });

  // Set base nodes and update global state
  const setBaseNodes = useCallback((nodes: GraphNode[]) => {
    globalGraphState.baseNodes = nodes;
    globalGraphState.baseNodesLoaded = true;
    setBaseNodesState(nodes);
    setIsBaseNodesLoaded(true);
    graphDataEvents.emit('baseNodesUpdated');
    
  }, []);

  // Helper to parse Arrow table into nodes
  const parseArrowToNodes = useCallback((arrowTable: Table<any>): { loadedNodes: GraphNode[]; cachedNodes: CachedGraphNode[] } => {
    const loadedNodes: GraphNode[] = [];
    const cachedNodes: CachedGraphNode[] = [];
    const labelCol = arrowTable.getChild('graph_label') || arrowTable.getChild('label');
    const xCol = arrowTable.getChild('x');
    const yCol = arrowTable.getChild('y');
    const communityCol = arrowTable.getChild('community');
    const degreeCol = arrowTable.getChild('degree');
    const tierCol = arrowTable.getChild('tier');
    const nodeTypeCol = arrowTable.getChild('node_type');
    const descriptionCol = arrowTable.getChild('description');

    for (let i = 0; i < arrowTable.numRows; i++) {
      const x = Number(xCol?.get(i) ?? 0);
      const y = Number(yCol?.get(i) ?? 0);
      const hash = coordHash(x, y);
      const label = String(labelCol?.get(i) ?? '');
      const community = communityCol?.get(i) != null ? Number(communityCol.get(i)) : null;
      const degree = Number(degreeCol?.get(i) ?? 0);
      const tier = (tierCol?.get(i) as string) ?? 'minor';
      const nodeType = nodeTypeCol?.get(i) ? String(nodeTypeCol.get(i)) : undefined;
      const graphLabel = labelCol?.get(i) ? String(labelCol.get(i)) : undefined;
      const description = descriptionCol?.get(i) ? String(descriptionCol.get(i)) : null;
      
      loadedNodes.push({
        id: hash,
        label: label || hash,
        x,
        y,
        community,
        degree,
        tier: tier as GraphNode['tier'],
        nodeType: nodeType as GraphNode['nodeType'],
        graphLabel,
        description,
        size: 1,
        color: '#ffffff',
      });
      
      cachedNodes.push({
        coord_hash: hash,
        label: label || hash,
        x,
        y,
        community,
        degree,
        tier,
        nodeType,
        graphLabel,
        description,
      });
    }
    
    return { loadedNodes, cachedNodes };
  }, []);

  // Fetch base nodes from Mosaic/DuckDB with LOD (Level of Detail) loading
  // Load top N nodes by degree for initial display
  // Additional nodes are loaded via tile-based progressive loading when user zooms in
  // Cache stores CachedGraphNode (with coord_hash instead of twitter_id) for RGPD compliance
  const fetchBaseNodes = useCallback(async () => {
    // Return existing promise if already fetching
    if (baseNodesPromiseRef.current) {
      return baseNodesPromiseRef.current;
    }
    
    // Skip if already loaded in memory
    if (globalGraphState.baseNodesLoaded) {
      return;
    }

    setIsBaseNodesLoading(true);
    
    // Initial load limit - top N nodes by degree
    // Additional nodes loaded via tiles when user zooms in
    const INITIAL_NODES_LIMIT = tileConfig.INITIAL_NODES; // 100,000
    
    baseNodesPromiseRef.current = (async () => {
      try {
        // Check if graph nodes version has changed before using cache
        const { changed: versionChanged } = await checkGraphNodesVersion();
        if (versionChanged) {
          await graphIDB.delete(CACHE_KEYS.BASE_NODES);
        }
        
        // Try to load from IndexedDB cache first (stores CachedGraphNode without twitter_id)
        const cached = !versionChanged ? await graphIDB.load<CachedGraphNode[]>(CACHE_KEYS.BASE_NODES) : null;
        if (cached && graphIDB.isCacheValidForNodes(cached.timestamp)) {
          
          // Convert CachedGraphNode back to GraphNode (using coord_hash as id)
          const loadedNodes: GraphNode[] = cached.data.map(node => ({
            id: node.coord_hash,
            label: node.label,
            x: node.x,
            y: node.y,
            community: node.community,
            degree: node.degree,
            tier: node.tier as GraphNode['tier'],
            nodeType: node.nodeType as GraphNode['nodeType'],
            graphLabel: node.graphLabel,
            description: node.description,
            size: 1,
            color: '#ffffff',
          }));          
          globalGraphState.baseNodes = loadedNodes;
          globalGraphState.baseNodesLoaded = true;
          setBaseNodesState(loadedNodes);
          setIsBaseNodesLoaded(true);
          graphDataEvents.emit('baseNodesUpdated');
          return;
        }

        // === Load prioritized nodes via auth endpoint ===
        // Priority: consent/labels > personal network (followings + effectiveFollowers) > top degree
        const startTime = performance.now();
        console.log(`📊 [GraphData] Loading initial ${INITIAL_NODES_LIMIT} nodes via auth endpoint (consent + network + degree)...`);
        
        // Use new GET endpoint (auth required, no-store cache)
        // Server handles prioritization: consent > followings + effectiveFollowers + userNode > top degree
        const responseInitial = await fetch(`/api/graph/v3/auth/base-nodes?limit=${INITIAL_NODES_LIMIT}`, {
          method: 'GET',
        });

        if (!responseInitial.ok) throw new Error('Failed to load initial nodes from Mosaic');

        const bufferInitial = await responseInitial.arrayBuffer();
        const arrowTableInitial = tableFromIPC(bufferInitial);
        const loadTime = performance.now() - startTime;
        
        const { loadedNodes: initialNodes, cachedNodes: initialCached } = parseArrowToNodes(arrowTableInitial);
        
        // Extract priority column to calculate min degree only from degree-based nodes
        const priorityCol = arrowTableInitial.getChild('priority');
        const degreeBasedDegrees: number[] = [];
        let consentNodesCount = 0;
        let networkNodesCount = 0;
        let otherNodesCount = 0;
        for (let i = 0; i < arrowTableInitial.numRows; i++) {
          const priority = priorityCol?.get(i) != null ? Number(priorityCol.get(i)) : 2;
          if (priority === 0) {
            consentNodesCount++;
          } else if (priority === 1) {
            networkNodesCount++;
            // Network nodes don't count for min degree calculation (they're prioritized regardless of degree)
          } else {
            otherNodesCount++;
            degreeBasedDegrees.push(initialNodes[i].degree);
          }
        }
        
        // Count nodes with description
        const nodesWithDescription = initialNodes.filter((node: GraphNode) => node.description).length;
        
        // DEBUG: Count member nodes received from DuckDB
        const memberNodes = initialNodes.filter((node: GraphNode) => node.nodeType === 'member').length;
        
        console.log(`📊 [GraphData] Loaded ${initialNodes.length} initial nodes in ${loadTime.toFixed(0)}ms (${memberNodes} members, ${nodesWithDescription} with description)`);
        console.log(`📊 [GraphData] Priority breakdown: ${consentNodesCount} consent (p0) + ${networkNodesCount} network (p1) + ${otherNodesCount} other (p2)`);
        console.log(`📊 [GraphData] Additional nodes will be loaded via tiles when zooming in (scale < ${tileConfig.ZOOM_THRESHOLD})`);
        
        // Set initial nodes for display
        globalGraphState.baseNodes = initialNodes;
        globalGraphState.baseNodesLoaded = true;
        setBaseNodesState(initialNodes);
        setIsBaseNodesLoaded(true);
        
        // Calculate min degree for tile filtering based on DEGREE-BASED nodes only (not consent nodes)
        // Note: Using reduce instead of Math.min(...arr) to avoid stack overflow with large arrays
        if (degreeBasedDegrees.length > 0) {
          const minDegree = degreeBasedDegrees.reduce((min, d) => d < min ? d : min, degreeBasedDegrees[0]);
          setBaseNodesMinDegree(minDegree);
          console.log(`📊 [GraphData] Base nodes min degree (degree-based only): ${minDegree.toFixed(4)} - tiles will load nodes below this`);
        } else {
          // All nodes are consent nodes, use global min degree
          const minDegree = initialNodes.reduce((min, n) => n.degree < min ? n.degree : min, initialNodes[0]?.degree ?? 0);
          setBaseNodesMinDegree(minDegree);
          console.log(`📊 [GraphData] All nodes are consent nodes, min degree: ${minDegree.toFixed(4)}`);
        }

        graphDataEvents.emit('baseNodesUpdated');
        
        // Save to IndexedDB cache
        graphIDB.save(CACHE_KEYS.BASE_NODES, initialCached).catch(err => {
          console.warn('💾 [IndexedDB] Failed to cache base nodes:', err);
        });
        
      } catch (error) {
        console.error('❌ [GraphDataProvider] Error fetching base nodes:', error);
      } finally {
        setIsBaseNodesLoading(false);
        baseNodesPromiseRef.current = null;
      }
    })();

    return baseNodesPromiseRef.current;
  }, [parseArrowToNodes, tileConfig.INITIAL_NODES, tileConfig.ZOOM_THRESHOLD]);

  // Fetch personal labels (for tooltips and floating labels) with IndexedDB cache
  // API now returns coord_hash instead of twitter_id for RGPD compliance
  const fetchPersonalLabels = useCallback(async () => {
    // Return existing promise if already fetching
    if (personalLabelsPromiseRef.current) {
      return personalLabelsPromiseRef.current;
    }
    
    // Skip if already loaded in memory
    if (globalGraphState.personalLabelsLoaded) {
      return;
    }

    setIsPersonalLabelsLoading(true);
    
    personalLabelsPromiseRef.current = (async () => {
      try {
        // Try to load from IndexedDB cache first (stores coord_hash, not twitter_id)
        const cached = await graphIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[] }>(CACHE_KEYS.PERSONAL_LABELS);
        if (cached && graphIDB.isCacheValidForLabels(cached.timestamp)) {
          globalGraphState.personalLabelMap = cached.data.labelMap;
          globalGraphState.personalFloatingLabels = cached.data.floatingLabels;
          globalGraphState.personalLabelsLoaded = true;
          setPersonalLabelMapState(cached.data.labelMap);
          setPersonalFloatingLabelsState(cached.data.floatingLabels);
          setIsPersonalLabelsLoaded(true);
          graphDataEvents.emit('personalLabelsUpdated');
          return;
        }

        
        const response = await fetch('/api/graph/consent_labels', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch personal labels');

        const data = await response.json();
        
        if (data.success) {
          // labelMap is now keyed by coord_hash (not twitter_id)
          const labelMap = data.labelMap || {};
          // floatingLabels now have coord_hash instead of twitter_id
          const floatingLabels: FloatingLabel[] = (data.floatingLabels || []).map((label: any) => ({
            coord_hash: label.coord_hash,
            x: label.x,
            y: label.y,
            text: label.text,
            priority: label.priority,
            level: label.level,
          }));
          
          globalGraphState.personalLabelMap = labelMap;
          globalGraphState.personalFloatingLabels = floatingLabels;
          globalGraphState.personalLabelsLoaded = true;
          setPersonalLabelMapState(labelMap);
          setPersonalFloatingLabelsState(floatingLabels);
          setIsPersonalLabelsLoaded(true);
                    
          // Save to IndexedDB cache with current version (with coord_hash, no twitter_id)
          const currentVersion = labelsVersionRef.current || Date.now();
          graphIDB.save(CACHE_KEYS.PERSONAL_LABELS, { labelMap, floatingLabels, version: currentVersion }).catch(err => {
            console.warn('💾 [IndexedDB] Failed to cache personal labels:', err);
          });
          
          graphDataEvents.emit('personalLabelsUpdated');
        }
      } catch (error) {
        console.error('❌ [GraphDataProvider] Error fetching personal labels:', error);
      } finally {
        setIsPersonalLabelsLoading(false);
        personalLabelsPromiseRef.current = null;
      }
    })();

    return personalLabelsPromiseRef.current;
  }, []);

  // Invalidate labels cache and reset state (call after consent change)
  const invalidateLabelsCache = useCallback(async () => {
    
    // Delete from IndexedDB
    await graphIDB.delete(CACHE_KEYS.PERSONAL_LABELS);
    
    // Reset global state
    globalGraphState.personalLabelMap = {};
    globalGraphState.personalFloatingLabels = [];
    globalGraphState.personalLabelsLoaded = false;
    
    // Reset local state
    setPersonalLabelMapState({});
    setPersonalFloatingLabelsState([]);
    setIsPersonalLabelsLoaded(false);
    
    // Clear the promise ref so next fetch will actually fetch
    personalLabelsPromiseRef.current = null;
    
  }, []);

  // Fetch followings labels for mode Followings (no cache - user-specific)
  // Uses matching-consent-labels API: only shows labels for matchings with consent
  const fetchFollowingsLabels = useCallback(async () => {
    // Return existing promise if already fetching
    if (followingsLabelsPromiseRef.current) {
      return followingsLabelsPromiseRef.current;
    }

    // Skip if already loaded
    if (globalGraphState.followingsLabelsLoaded) {
      console.log('🏷️ [GraphData] Followings labels already loaded, skipping fetch');
      return;
    }

    setIsFollowingsLabelsLoading(true);

    followingsLabelsPromiseRef.current = (async () => {
      try {
        console.log('🏷️ [GraphData] Fetching matching-consent labels from API...');
        const response = await fetch('/api/graph/matching-consent-labels', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          const labelMap = data.labelMap || {};
          const floatingLabels: FloatingLabel[] = (data.floatingLabels || []).map((l: any) => ({
            coord_hash: l.coord_hash,
            x: l.x,
            y: l.y,
            text: l.text,
            priority: l.priority || 50,
            level: l.level || 0,
          }));

          console.log('🏷️ [GraphData] Loaded', floatingLabels.length, 'followings labels');

          globalGraphState.followingsLabelMap = labelMap;
          globalGraphState.followingsFloatingLabels = floatingLabels;
          globalGraphState.followingsLabelsLoaded = true;
          setFollowingsLabelMapState(labelMap);
          setFollowingsFloatingLabelsState(floatingLabels);
          setIsFollowingsLabelsLoaded(true);
        }
      } catch (error) {
        console.error('❌ [GraphData] Error fetching followings labels:', error);
      } finally {
        setIsFollowingsLabelsLoading(false);
        followingsLabelsPromiseRef.current = null;
      }
    })();

    return followingsLabelsPromiseRef.current;
  }, []);

  // Fetch follower hashes only (24h TTL - rarely changes)
  const fetchFollowerHashes = useCallback(async () => {
    console.log('🔍 [GraphData] fetchFollowerHashes called, already loaded:', globalGraphState.followerHashesLoaded);
    // Skip if already loaded from cache
    if (globalGraphState.followerHashesLoaded) {
      console.log('🔍 [GraphData] fetchFollowerHashes skipped (already loaded)');
      return;
    }

    console.log('🔍 [GraphData] fetchFollowerHashes fetching from API...');
    try {
      const response = await fetch('/api/graph/followers-hashes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });

      if (response.ok) {
        const data = await response.json();
        const hashes = data.hashes || [];
        const effectiveHashes = data.effectiveHashes || []; // Followers who followed via OP
        
        // Update refs (stable references)
        followerHashesRef.current = new Set(hashes.map(normalizeCoordHash));
        effectiveFollowerHashesRef.current = new Set(effectiveHashes.map(normalizeCoordHash));
        globalGraphState.followerHashes = followerHashesRef.current;
        globalGraphState.effectiveFollowerHashes = effectiveFollowerHashesRef.current;
        globalGraphState.followerHashesLoaded = true;
        
        console.log('📊 [GraphDataProvider] Loaded', hashes.length, 'follower hashes,', effectiveHashes.length, 'effective (via OP)');
        
        // Cache follower hashes to IndexedDB (24h TTL)
        const cacheData: CachedFollowerHashes = {
          hashes: hashes.map(normalizeCoordHash),
          effectiveHashes: effectiveHashes.map(normalizeCoordHash), // Also cache effective hashes
          lastUpdated: data.timestamp || Date.now(),
        };
        graphIDB.save(CACHE_KEYS.FOLLOWER_HASHES, cacheData).catch(err => {
          console.warn('💾 [IndexedDB] Failed to cache follower hashes:', err);
        });
        
        // Trigger re-render
        setHashesVersion((v: number) => v + 1);
        graphDataEvents.emit('followerHashesUpdated');
      }
    } catch (error) {
      console.error('❌ [GraphDataProvider] Error fetching follower hashes:', error);
    }
  }, []);

  // Fetch following hashes only (30min TTL - changes after follow)
  const fetchFollowingHashes = useCallback(async () => {
    console.log('🔍 [GraphData] fetchFollowingHashes called, already loaded:', globalGraphState.followingHashesLoaded);
    // Skip if already loaded from cache
    if (globalGraphState.followingHashesLoaded) {
      console.log('🔍 [GraphData] fetchFollowingHashes skipped (already loaded)');
      return;
    }

    console.log('🔍 [GraphData] fetchFollowingHashes fetching from API...');
    try {
      const response = await fetch('/api/graph/followings-hashes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const hashesArray = data.followingHashes || [];
          
          // Build Map from array of objects with follow status
          const hashesMap = new Map<string, FollowingHashStatus>();
          for (const item of hashesArray) {
            const status: FollowingHashStatus = {
              hasBlueskyFollow: item.has_follow_bluesky || false,
              hasMastodonFollow: item.has_follow_mastodon || false,
              hasMatching: item.has_matching || false,
            };
            hashesMap.set(normalizeCoordHash(item.coord_hash), status);
          }
          
          // Update ref (stable reference)
          followingHashesRef.current = hashesMap;
          globalGraphState.followingHashes = followingHashesRef.current;
          globalGraphState.followingHashesLoaded = true;
          
          // Cache following hashes to IndexedDB (30min TTL)
          const cacheData: CachedFollowingHashes = {
            hashes: hashesArray.map((h: any) => ({
              ...h,
              coord_hash: typeof h?.coord_hash === 'string' ? normalizeCoordHash(h.coord_hash) : h.coord_hash,
            })),
            lastUpdated: data.timestamp || Date.now(),
          };
          graphIDB.save(CACHE_KEYS.FOLLOWING_HASHES, cacheData).then(() => {
            console.log('💾 [IndexedDB] Cached', hashesArray.length, 'following hashes (TTL 30min)');
          }).catch(err => {
            console.warn('💾 [IndexedDB] Failed to cache following hashes:', err);
          });
          
          // Extract user node if present
          if (data.userNode) {
            const node: UserNode = {
              x: data.userNode.x,
              y: data.userNode.y,
              label: data.userNode.label,
              community: data.userNode.community,
              tier: data.userNode.tier,
              degree: data.userNode.degree,
            };
            globalGraphState.userNode = node;
            setUserNodeState(node);
            
            // Add userNode hash to followingHashes so it gets highlighted
            // Use same hash format as the rest of the system
            const userNodeHash = `${node.x.toFixed(6)}_${node.y.toFixed(6)}`;
            followingHashesRef.current.set(userNodeHash, {
              hasBlueskyFollow: true, // Mark as "followed" so it shows in green
              hasMastodonFollow: true,
              hasMatching: true,
            });
            globalGraphState.followingHashes = followingHashesRef.current;
            console.log('📊 [GraphData] UserNode received and added to followingHashes:', userNodeHash, node.label);
            
            // Cache user node to IndexedDB
            graphIDB.save(CACHE_KEYS.USER_NODE, node).catch(err => {
              console.warn('💾 [IndexedDB] Failed to cache user node:', err);
            });
            
          } else {
            console.log('📊 [GraphData] No userNode in response');
          }
          
          // Trigger re-render
          setHashesVersion((v: number) => v + 1);
          graphDataEvents.emit('followingHashesUpdated');
        }
      }
    } catch (error) {
      console.error('❌ [GraphDataProvider] Error fetching following hashes:', error);
    }
  }, []);

  // Fetch both hashes in parallel (for initial load)
  // Only fetches what's not already cached
  const fetchHashes = useCallback(async () => {
    console.log('🔍 [GraphData] fetchHashes called, followerLoaded:', globalGraphState.followerHashesLoaded, 'followingLoaded:', globalGraphState.followingHashesLoaded);
    // Return existing promise if already fetching
    if (hashesPromiseRef.current) {
      console.log('🔍 [GraphData] fetchHashes skipped (already fetching)');
      return hashesPromiseRef.current;
    }
    
    // Skip if both already loaded
    if (globalGraphState.followerHashesLoaded && globalGraphState.followingHashesLoaded) {
      console.log('🔍 [GraphData] fetchHashes skipped (both already loaded)');
      globalGraphState.hashesLoaded = true;
      return;
    }

    console.log('🔍 [GraphData] fetchHashes starting parallel fetch...');
    setIsHashesLoading(true);
    
    hashesPromiseRef.current = (async () => {
      try {
        // Fetch in parallel, but only what's needed
        const promises: Promise<void>[] = [];
        
        if (!globalGraphState.followerHashesLoaded) {
          promises.push(fetchFollowerHashes());
        }
        if (!globalGraphState.followingHashesLoaded) {
          promises.push(fetchFollowingHashes());
        }
        
        await Promise.all(promises);
        
        // Mark as loaded if at least one succeeded
        if (globalGraphState.followerHashesLoaded || globalGraphState.followingHashesLoaded) {
          globalGraphState.hashesLoaded = true;
        }
        
      } catch (error) {
        console.error('❌ [GraphDataProvider] Error fetching hashes:', error);
      } finally {
        setIsHashesLoading(false);
        hashesPromiseRef.current = null;
      }
    })();

    return hashesPromiseRef.current;
  }, [fetchFollowerHashes, fetchFollowingHashes]);

  // Fetch matching data (for accounts panel)
  const fetchMatchingData = useCallback(async () => {
    // Return existing promise if already fetching
    if (matchingPromiseRef.current) {
      return matchingPromiseRef.current;
    }
    
    // Skip if already loaded
    if (globalGraphState.matchingDataLoaded) {
      return;
    }

    setIsMatchingLoading(true);
    
    matchingPromiseRef.current = (async () => {
      try {
        
        const response = await fetch('/api/migrate/matching_found', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        });

        if (response.ok) {
          const data = await response.json();
          const matches = data.matches?.following || [];
          
          globalGraphState.matchingData = matches;
          globalGraphState.matchingDataLoaded = true;
          setMatchingDataState(matches);
          
          
          graphDataEvents.emit('matchingDataUpdated');
        }
      } catch (error) {
        console.error('❌ [GraphDataProvider] Error fetching matching data:', error);
      } finally {
        setIsMatchingLoading(false);
        matchingPromiseRef.current = null;
      }
    })();

    return matchingPromiseRef.current;
  }, []);

  // Unified personal data fetch: matching_found + hashes (optional)
  // This is the SINGLE source of truth for loading personal network data
  // Mobile: includeHashes=false (no graph to highlight)
  // Desktop: includeHashes=true (need hashes for graph highlighting)
  const fetchPersonalData = useCallback(async (options?: { includeHashes?: boolean }) => {
    const includeHashes = options?.includeHashes ?? true;
    
    // Return existing promise if already fetching
    if (personalDataPromiseRef.current) {
      return personalDataPromiseRef.current;
    }
    
    // Skip if already loaded (check both matching and hashes if needed)
    if (globalGraphState.personalDataLoaded) {
      // If we need hashes but they're not loaded, continue to fetch them
      if (includeHashes && !globalGraphState.hashesLoaded) {
        // Will fetch hashes below
      } else {
        return;
      }
    }

    setIsPersonalDataLoading(true);
    
    personalDataPromiseRef.current = (async () => {
      try {        
        // Step 1: Fetch hashes FIRST (needed for graph highlighting)
        // Only fetch on desktop (when includeHashes=true)
        if (includeHashes) {
          // Fetch following hashes (30min TTL) - only if not cached
          if (!globalGraphState.followingHashesLoaded) {
            await fetchFollowingHashes();
          }
          
          // Fetch follower hashes (24h TTL) - only if not cached
          // This is the heavy one (88K hashes), so we really want to use cache
          if (!globalGraphState.followerHashesLoaded) {
            await fetchFollowerHashes();
          }
        }
        
        // Step 2: Fetch matching_found AFTER hashes (for accounts panel)
        const matchingResponse = await fetch('/api/migrate/matching_found', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        });
        
        // Process matching_found response
        if (matchingResponse.ok) {
          const data = await matchingResponse.json();
          const matches = data.matches?.following || [];
          
          globalGraphState.matchingData = matches;
          globalGraphState.matchingDataLoaded = true;
          setMatchingDataState(matches);
          
          graphDataEvents.emit('matchingDataUpdated');
          
          // Dispatch window event for useReconnectState to sync
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('matchingDataUpdated'));
          }
        }
        
        // Mark as loaded
        const matchingLoaded = matchingResponse?.ok ?? false;
        
        if (matchingLoaded) {
          globalGraphState.matchingDataLoaded = true;
        }
        
        // Personal data is loaded if matching is loaded
        // Hashes are optional and tracked separately
        if (matchingLoaded) {
          globalGraphState.personalDataLoaded = true;
          setIsPersonalDataLoaded(true);
        }
        
        if (includeHashes && (globalGraphState.followingHashesLoaded || globalGraphState.followerHashesLoaded)) {
          globalGraphState.hashesLoaded = true;
        }
        
        // Trigger re-render with new version (Sets stay stable)
        setHashesVersion((v: number) => v + 1);
        
      } catch (error) {
        console.error('❌ [GraphDataProvider] Error fetching personal data:', error);
      } finally {
        setIsPersonalDataLoading(false);
        personalDataPromiseRef.current = null;
      }
    })();

    return personalDataPromiseRef.current;
  }, [fetchFollowingHashes, fetchFollowerHashes]);

  // Force refetch personal data (after migration)
  // Invalidates cache and fetches fresh data
  const refetchPersonalData = useCallback(async (options?: { includeHashes?: boolean }) => {
    const includeHashes = options?.includeHashes ?? true;
        
    // Invalidate global state
    globalGraphState.personalDataLoaded = false;
    globalGraphState.matchingDataLoaded = false;
    if (includeHashes) {
      globalGraphState.hashesLoaded = false;
      globalGraphState.followingHashesLoaded = false;
      // Note: we don't invalidate followerHashesLoaded - it rarely changes (24h TTL)
    }
    
    // Clear promise ref
    personalDataPromiseRef.current = null;
    
    // Reset local state
    setIsPersonalDataLoaded(false);
    
    // Fetch fresh data
    return fetchPersonalData(options);
  }, [fetchPersonalData]);

  // Update follow status for specific hashes (lightweight, after follow action)
  // This avoids refetching all hashes from the server
  const updateFollowingStatus = useCallback((coordHashes: string[], platform: 'bluesky' | 'mastodon', followed: boolean) => {
    if (coordHashes.length === 0) return;
    
    // Update the Map in place
    const currentMap = followingHashesRef.current;
    let updated = false;
    
    for (const hash of coordHashes) {
      const existing = currentMap.get(hash);
      if (existing) {
        // Update existing entry
        if (platform === 'bluesky') {
          existing.hasBlueskyFollow = followed;
        } else {
          existing.hasMastodonFollow = followed;
        }
        updated = true;
      } else if (followed) {
        // Add new entry if following
        currentMap.set(hash, {
          hasBlueskyFollow: platform === 'bluesky' ? followed : false,
          hasMastodonFollow: platform === 'mastodon' ? followed : false,
          hasMatching: true, // If we're following, there must be a matching
        });
        updated = true;
      }
    }
    
    if (updated) {
      // Update global state
      globalGraphState.followingHashes = currentMap;
      
      // Update IndexedDB cache with new data
      const hashesArray: CachedFollowingHashes['hashes'] = [];
      currentMap.forEach((status: FollowingHashStatus, coord_hash: string) => {
        hashesArray.push({
          coord_hash,
          has_follow_bluesky: status.hasBlueskyFollow,
          has_follow_mastodon: status.hasMastodonFollow,
          has_matching: status.hasMatching,
        });
      });
      
      const cacheData: CachedFollowingHashes = {
        hashes: hashesArray,
        lastUpdated: Date.now(),
      };
      graphIDB.save(CACHE_KEYS.FOLLOWING_HASHES, cacheData).catch(err => {
        console.warn('💾 [IndexedDB] Failed to update following hashes cache:', err);
      });
      
      // Trigger re-render
      setHashesVersion((v: number) => v + 1);
      graphDataEvents.emit('followingHashesUpdated');
      
    }
  }, []);

  // Subscribe to updates (for cross-component communication)
  const subscribeToUpdates = useCallback((event: GraphDataEventType, callback: GraphDataEventCallback) => {
    return graphDataEvents.on(event, callback);
  }, []);

  // ============================================
  // Tile-based progressive loading functions
  // ============================================

  // Fetch additional nodes progressively - each call loads the next batch by degree
  // batchMultiplier: load more nodes per request during aggressive zoom (1-5x)
  const fetchDetailNodes = useCallback(async (bbox?: BoundingBox, batchMultiplier: number = 1) => {
    // Use currentMinDegree if set, otherwise use baseNodesMinDegree
    const degreeThreshold = currentMinDegree > 0 ? currentMinDegree : baseNodesMinDegree;
    
    if (degreeThreshold <= 0) {
      // Don't log spam - this is expected during initial load before baseNodes are ready
      return;
    }

    if (tilePromiseRef.current) {
      console.log(`📦 [Tiles] Skipping: already loading`);
      return tilePromiseRef.current;
    }

    // Check if we've reached the limit
    const currentTotal = baseNodes.length + tileNodes.length;
    if (currentTotal >= tileConfig.MAX_MEMORY_NODES) {
      console.log(`📦 [Tiles] Skipping: reached max nodes (${currentTotal}/${tileConfig.MAX_MEMORY_NODES})`);
      return;
    }

    setIsTileLoading(true);

    // Calculate actual batch size: multiply by batchMultiplier for aggressive zoom
    // Allow aggressive zoom to request up to the remaining "detail budget": MAX_MEMORY_NODES - INITIAL_NODES
    const maxDetailBudget = Math.max(0, tileConfig.MAX_MEMORY_NODES - tileConfig.INITIAL_NODES);
    const remainingBudget = Math.max(0, tileConfig.MAX_MEMORY_NODES - currentTotal);
    const actualBatchSize = Math.min(
      tileConfig.NODES_PER_TILE * batchMultiplier,
      maxDetailBudget,
      remainingBudget
    );

    tilePromiseRef.current = (async () => {
      try {
        // Use PUBLIC tiles endpoint (cacheable via nginx) with band index
        // Tiles are not user-specific, only base-nodes are prioritized per user
        // This allows us to benefit from nginx cache for tiles
        const zoomLevelIndex = Math.min(4, Math.max(0, Math.floor(currentZoom * 10))); // Rough mapping
        const bandIndex = Math.min(4, Math.max(1, zoomLevelIndex)); // band 1-4 for progressive loading
        
        // Build URL with optional spatial filter via gx/gy
        const tileUrl = new URL('/api/graph/v3/tiles', window.location.origin);
        
        if (bbox) {
          // Calculate grid indices from bbox (use center point)
          const gridSize = [1.0, 0.5, 0.25, 0.1, 0.05][bandIndex] || 0.25;
          const centerX = (bbox.minX + bbox.maxX) / 2;
          const centerY = (bbox.minY + bbox.maxY) / 2;
          const gx = Math.floor(centerX / gridSize);
          const gy = Math.floor(centerY / gridSize);
          
          tileUrl.searchParams.set('z', String(bandIndex));
          tileUrl.searchParams.set('gx', String(gx));
          tileUrl.searchParams.set('gy', String(gy));
        } else {
          // Full graph tile (z=0, gx=0, gy=0)
          tileUrl.searchParams.set('z', '0');
          tileUrl.searchParams.set('gx', '0');
          tileUrl.searchParams.set('gy', '0');
        }
        
        tileUrl.searchParams.set('band', String(bandIndex));
        tileUrl.searchParams.set('ceiling', String(degreeThreshold));
        tileUrl.searchParams.set('limit', String(actualBatchSize));
        
        const bboxInfo = bbox ? ` in bbox [${bbox.minX.toFixed(2)},${bbox.maxX.toFixed(2)}]x[${bbox.minY.toFixed(2)},${bbox.maxY.toFixed(2)}]` : '';
        console.log(`📦 [Tiles] Fetching ${actualBatchSize} nodes with degree < ${degreeThreshold.toFixed(4)}${bboxInfo} (band=${bandIndex})`);

        const response = await fetch(tileUrl.toString(), {
          method: 'GET',
        });

        if (!response.ok) {
          console.warn('⚠️ [Tiles] Failed to fetch tile:', response.statusText);
          return;
        }

        const buffer = await response.arrayBuffer();
        const arrowTable = tableFromIPC(buffer);
        const { loadedNodes } = parseArrowToNodes(arrowTable);

        if (loadedNodes.length === 0) {
          console.log(`📦 [Tiles] No more nodes to load (all nodes loaded)`);
          return;
        }

        // Update currentMinDegree to the minimum degree of loaded nodes
        const minDegreeInBatch = Math.min(...loadedNodes.map(n => n.degree));
        setCurrentMinDegree(minDegreeInBatch);
        console.log(`📦 [Tiles] Next batch will load degree < ${minDegreeInBatch.toFixed(4)}`);

        setTileNodes(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newNodes = loadedNodes.filter(n => !existingIds.has(n.id));
          
          const totalNodes = prev.length + newNodes.length;
          if (totalNodes > tileConfig.MAX_MEMORY_NODES - baseNodes.length) {
            const maxTileNodes = tileConfig.MAX_MEMORY_NODES - baseNodes.length;
            const combined = [...prev, ...newNodes];
            console.log(`📦 [Tiles] setTileNodes: prev=${prev.length}, new=${newNodes.length}, trimmed to ${maxTileNodes}`);
            return combined.slice(-maxTileNodes);
          }
          
          console.log(`📦 [Tiles] setTileNodes: prev=${prev.length}, new=${newNodes.length}, total=${prev.length + newNodes.length}`);
          return [...prev, ...newNodes];
        });

        console.log(`📦 [Tiles] Loaded ${loadedNodes.length} nodes (degree range: ${minDegreeInBatch.toFixed(4)} - ${degreeThreshold.toFixed(4)})`);

      } catch (error) {
        console.error('❌ [Tiles] Error fetching tile:', error);
      } finally {
        setIsTileLoading(false);
        tilePromiseRef.current = null;
      }
    })();

    return tilePromiseRef.current;
  }, [parseArrowToNodes, baseNodes.length, tileNodes.length, baseNodesMinDegree, currentMinDegree, tileConfig.NODES_PER_TILE, tileConfig.MAX_MEMORY_NODES]);

  // Keep ref updated to the latest fetchDetailNodes to avoid stale closures in debounce
  fetchDetailNodesRef.current = fetchDetailNodes;
  
  // Check if viewport has moved significantly (pan detection)
  const hasMovedSignificantly = useCallback((oldBbox: BoundingBox | null, newBbox: BoundingBox): boolean => {
    if (!oldBbox) return true;
    const oldCenterX = (oldBbox.minX + oldBbox.maxX) / 2;
    const oldCenterY = (oldBbox.minY + oldBbox.maxY) / 2;
    const newCenterX = (newBbox.minX + newBbox.maxX) / 2;
    const newCenterY = (newBbox.minY + newBbox.maxY) / 2;
    const oldWidth = oldBbox.maxX - oldBbox.minX;
    const oldHeight = oldBbox.maxY - oldBbox.minY;
    // Consider significant if moved more than 30% of viewport size
    const threshold = Math.max(oldWidth, oldHeight) * 0.3;
    const distance = Math.sqrt((newCenterX - oldCenterX) ** 2 + (newCenterY - oldCenterY) ** 2);
    return distance > threshold;
  }, []);

  // Handle viewport change with smart loading/unloading
  // Supports aggressive zoom: loads multiple batches when zoom delta is large
  const onViewportChange = useCallback((boundingBox: BoundingBox, zoomLevel: number) => {
    const prevZoom = prevZoomRef.current;
    const prevBbox = currentBboxRef.current;
    prevZoomRef.current = zoomLevel;
    currentBboxRef.current = boundingBox;
    setCurrentZoom(zoomLevel);
    
    // Detect pan
    const isPanning = hasMovedSignificantly(prevBbox, boundingBox) && Math.abs(zoomLevel - prevZoom) < prevZoom * 0.1;
    
    // Calculate zoom aggressiveness: how many batches to load based on zoom delta
    const zoomRatio = prevZoom > 0 ? zoomLevel / prevZoom : 1;
    const isZoomingIn = zoomRatio > 1.1; // More than 10% zoom in
    // Calculate batches: 1 batch per 50% zoom increase, max 5 batches
    const batchCount = isZoomingIn ? Math.min(5, Math.max(1, Math.floor(Math.log2(zoomRatio) * 2) + 1)) : 1;
    
    // Below threshold: unload detail nodes and don't load new ones
    if (zoomLevel < tileConfig.ZOOM_THRESHOLD) {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
      viewportDebounceRef.current = setTimeout(() => {
        setTileNodes(prev => {
          if (prev.length > 0) {
            console.log(`📦 [Tiles] Unloading ${prev.length} detail nodes (zoom out below threshold)`);
            setCurrentMinDegree(0);
            return [];
          }
          return prev;
        });
      }, tileConfig.DEBOUNCE_MS);
      return;
    }

    // PAN: Clear old detail nodes and load new ones for the new area
    if (isPanning) {
      setTileNodes(prev => {
        if (prev.length > 0) {
          console.log(`📦 [Tiles] Pan detected - clearing ${prev.length} old nodes`);
          setCurrentMinDegree(0);
          return [];
        }
        return prev;
      });
    }

    // ZOOM IN or PAN: Load detail nodes (larger batch for aggressive zoom)
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
    }
    viewportDebounceRef.current = setTimeout(async () => {
      if (batchCount > 1) {
        console.log(`🚀 [Tiles] Aggressive zoom detected (${zoomRatio.toFixed(2)}x) - loading ${batchCount}x batch size`);
      }
      // Pass batchCount as multiplier to load more nodes in one request
      await fetchDetailNodesRef.current?.(boundingBox, batchCount);
    }, tileConfig.DEBOUNCE_MS);
  }, [tileConfig.ZOOM_THRESHOLD, tileConfig.DEBOUNCE_MS, hasMovedSignificantly]);

  // Clear tile cache
  const clearTileCache = useCallback(() => {
    tileCache.clear();
    setTileNodes([]);
    setCurrentMinDegree(0);
    console.log('🗑️ [Tiles] Cache cleared');
  }, []);

  // Merged nodes: baseNodes + tileNodes (deduplicated)
  const mergedNodes = useMemo(() => {
    if (tileNodes.length === 0) {
      return baseNodes;
    }

    // Create a map of base node IDs for fast lookup
    const baseNodeIds = new Set(baseNodes.map(n => n.id));
    
    // Filter tile nodes that are not in base nodes
    const uniqueTileNodes = tileNodes.filter(n => !baseNodeIds.has(n.id));
    
    // Merge: base nodes first, then unique tile nodes
    return [...baseNodes, ...uniqueTileNodes];
  }, [baseNodes, tileNodes]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
    };
  }, []);

  // Context value with stable references
  const contextValue = useMemo<GraphDataContextValue>(() => ({
    baseNodes,
    setBaseNodes,
    isBaseNodesLoaded,
    isBaseNodesLoading,
    fetchBaseNodes,
    normalizationBounds,
    followingHashes,
    followerHashes,
    effectiveFollowerHashes,
    userNode,
    matchingData,
    personalLabelMap,
    personalFloatingLabels,
    isPersonalLabelsLoaded,
    isPersonalLabelsLoading,
    fetchPersonalLabels,
    invalidateLabelsCache,
    followingsLabelMap,
    followingsFloatingLabels,
    isFollowingsLabelsLoaded,
    isFollowingsLabelsLoading,
    fetchFollowingsLabels,
    isHashesLoading,
    hashesLoaded: globalGraphState.hashesLoaded,
    isMatchingLoading,
    isPersonalDataLoading,
    isPersonalDataLoaded,
    fetchHashes,
    fetchMatchingData,
    fetchPersonalData,
    refetchPersonalData,
    updateFollowingStatus,
    subscribeToUpdates,
    nodeTypeVersion,
    // Tile-based progressive loading
    tileNodes,
    mergedNodes,
    isTileLoading,
    currentZoom,
    tileConfig,
    setMaxMemoryNodes,
    fetchDetailNodes,
    onViewportChange,
    clearTileCache,
  }), [
    baseNodes,
    setBaseNodes,
    isBaseNodesLoaded,
    isBaseNodesLoading,
    fetchBaseNodes,
    normalizationBounds,
    followingHashes,
    followerHashes,
    effectiveFollowerHashes,
    userNode,
    matchingData,
    personalLabelMap,
    personalFloatingLabels,
    isPersonalLabelsLoaded,
    isPersonalLabelsLoading,
    fetchPersonalLabels,
    invalidateLabelsCache,
    followingsLabelMap,
    followingsFloatingLabels,
    isFollowingsLabelsLoaded,
    isFollowingsLabelsLoading,
    fetchFollowingsLabels,
    isHashesLoading,
    hashesVersion,
    isMatchingLoading,
    isPersonalDataLoading,
    isPersonalDataLoaded,
    fetchHashes,
    fetchMatchingData,
    fetchPersonalData,
    refetchPersonalData,
    updateFollowingStatus,
    nodeTypeVersion,
    subscribeToUpdates,
    // Tile-based progressive loading dependencies
    tileNodes,
    mergedNodes,
    isTileLoading,
    currentZoom,
    tileConfig,
    setMaxMemoryNodes,
    fetchDetailNodes,
    onViewportChange,
    clearTileCache,
  ]);

  return (
    <GraphDataContext.Provider value={contextValue}>
      {children}
    </GraphDataContext.Provider>
  );
}

// Export event emitter for direct access if needed
export { graphDataEvents };
export type { GraphDataEventType, FloatingLabel, NormalizationBounds };

/**
 * Utility function to invalidate the hashes cache in IndexedDB.
 * Call this after importing new data (e.g., from large-files upload) to force
 * a fresh fetch of followings/followers hashes on the next page load.
 */
export async function invalidateHashesCache(): Promise<void> {
  if (typeof window === 'undefined') 
  {
    return;
  }
  
  try {
    await graphIDB.delete(CACHE_KEYS.FOLLOWING_HASHES);
    await graphIDB.delete(CACHE_KEYS.FOLLOWER_HASHES);
  } catch (err) {
    console.warn('💾 [IndexedDB] Failed to invalidate hashes cache:', err);
  }
}

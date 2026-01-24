'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { GraphNode, BoundingBox, DEFAULT_TILE_CONFIG, TileConfig } from '@/lib/types/graph';
import { tableFromIPC, Table } from 'apache-arrow';
import { useSSE, SSELabelsData } from '@/hooks/useSSE';

// Helper to create coordinate hash (same format as used in API)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

// Floating label type - uses coord_hash for RGPD compliance
interface FloatingLabel {
  coord_hash: string;
  x: number;
  y: number;
  text: string;
  priority: number;
  level: number;
}

// Cache-optimized node type (without twitter_id)
interface CachedGraphNode {
  coord_hash: string;
  label: string;
  x: number;
  y: number;
  community: number | null;
  degree: number;
  tier: string;
  nodeType?: string;
  graphLabel?: string;
}

// Normalization bounds for coordinate transformation
interface NormalizationBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  centerX: number;
  centerY: number;
}

// IndexedDB configuration
const IDB_NAME = 'hqx_public_graph_cache';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'public_graph_data';

// Cache TTL: 24 hours for graph data
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// SSE replaces polling for cross-client sync
// Kept for reference but no longer used
// const SYNC_POLL_INTERVAL_MS = 30 * 1000;

// IndexedDB helper class
class PublicGraphIndexedDB {
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
        console.error('💾 [PublicIDB] Failed to open database:', request.error);
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
          console.error(`💾 [PublicIDB] Failed to save ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (err) {
      console.warn(`💾 [PublicIDB] Failed to save ${key}:`, err);
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
          console.error(`💾 [PublicIDB] Failed to load ${key}:`, request.error);
          reject(request.error);
        };
      });
    } catch (err) {
      console.warn(`💾 [PublicIDB] Failed to load ${key}:`, err);
      return null;
    }
  }

  isCacheValid(timestamp: number): boolean {
    const age = Date.now() - timestamp;
    return age < CACHE_TTL_MS;
  }
}

// Singleton instance
const publicGraphIDB = new PublicGraphIndexedDB();

// Cache keys
const CACHE_KEYS = {
  BASE_NODES: 'public_base_nodes',
  FLOATING_LABELS: 'public_floating_labels',
  NORMALIZATION_BOUNDS: 'public_normalization_bounds',
  TILE_STATE: 'public_tile_state',
};

// ============================================
// Tile Cache for progressive loading (Public)
// ============================================

interface TileCacheEntry {
  nodes: GraphNode[];
  timestamp: number;
}

class PublicTileCache {
  private cache: Map<string, TileCacheEntry> = new Map();
  private maxSize: number;

  constructor(maxSize: number = DEFAULT_TILE_CONFIG.TILE_CACHE_SIZE) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  getTileKey(bbox: BoundingBox, zoom: number): string {
    return `${bbox.minX.toFixed(2)}_${bbox.maxX.toFixed(2)}_${bbox.minY.toFixed(2)}_${bbox.maxY.toFixed(2)}_z${zoom.toFixed(1)}`;
  }

  get(key: string): GraphNode[] | null {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.nodes;
    }
    return null;
  }

  set(key: string, nodes: GraphNode[]): void {
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
}

// Singleton tile cache for public context
const publicTileCache = new PublicTileCache();

// Global state to prevent duplicate API calls across components
interface GlobalPublicGraphState {
  baseNodes: GraphNode[];
  baseNodesLoaded: boolean;
  normalizationBounds: NormalizationBounds | null;
  labelMap: Record<string, string>;
  floatingLabels: FloatingLabel[];
  labelsLoaded: boolean;
}

const globalPublicState: GlobalPublicGraphState = {
  baseNodes: [],
  baseNodesLoaded: false,
  normalizationBounds: null,
  labelMap: {},
  floatingLabels: [],
  labelsLoaded: false,
};

// Context value interface
interface PublicGraphDataContextValue {
  // Base nodes from Mosaic/DuckDB (public)
  baseNodes: GraphNode[];
  isBaseNodesLoaded: boolean;
  isBaseNodesLoading: boolean;
  fetchBaseNodes: () => Promise<void>;
  
  // Normalization bounds for coordinate transformation
  normalizationBounds: NormalizationBounds | null;
  
  // Public labels for tooltips/floating labels
  labelMap: Record<string, string>;
  floatingLabels: FloatingLabel[];
  isLabelsLoaded: boolean;
  isLabelsLoading: boolean;
  fetchLabels: () => Promise<void>;
  
  // Tile-based progressive loading
  tileNodes: GraphNode[];
  mergedNodes: GraphNode[];
  isTileLoading: boolean;
  currentZoom: number;
  tileConfig: TileConfig;
  setMaxMemoryNodes: (maxNodes: number) => void;
  fetchDetailNodes: (bbox?: BoundingBox) => Promise<void>;
  onViewportChange: (boundingBox: BoundingBox, zoomLevel: number) => void;
  clearTileCache: () => void;
}

const PublicGraphDataContext = createContext<PublicGraphDataContextValue | null>(null);

export function usePublicGraphData() {
  const context = useContext(PublicGraphDataContext);
  if (!context) {
    throw new Error('usePublicGraphData must be used within a PublicGraphDataProvider');
  }
  return context;
}

// Optional hook that returns null if not in provider
export function usePublicGraphDataOptional() {
  return useContext(PublicGraphDataContext);
}

interface PublicGraphDataProviderProps {
  children: ReactNode;
}

export function PublicGraphDataProvider({ children }: PublicGraphDataProviderProps) {
  // Local state that syncs with global state
  const [baseNodes, setBaseNodesState] = useState<GraphNode[]>(globalPublicState.baseNodes);
  const [isBaseNodesLoaded, setIsBaseNodesLoaded] = useState(globalPublicState.baseNodesLoaded);
  const [isBaseNodesLoading, setIsBaseNodesLoading] = useState(false);
  
  // Normalization bounds state
  const [normalizationBounds, setNormalizationBoundsState] = useState<NormalizationBounds | null>(globalPublicState.normalizationBounds);
  
  // Labels state
  const [labelMap, setLabelMapState] = useState<Record<string, string>>(globalPublicState.labelMap);
  const [floatingLabels, setFloatingLabelsState] = useState<FloatingLabel[]>(globalPublicState.floatingLabels);
  const [isLabelsLoaded, setIsLabelsLoaded] = useState(globalPublicState.labelsLoaded);
  const [isLabelsLoading, setIsLabelsLoading] = useState(false);
  
  // Fetch promise refs to prevent duplicate calls
  const baseNodesPromiseRef = useRef<Promise<void> | null>(null);
  const labelsPromiseRef = useRef<Promise<void> | null>(null);
  
  // Labels version ref for polling
  const labelsVersionRef = useRef<number>(0);
  
  // ============================================
  // Tile-based progressive loading state
  // ============================================
  const [tileNodes, setTileNodes] = useState<GraphNode[]>([]); // Currently displayed tile nodes
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [baseNodesMinDegree, setBaseNodesMinDegree] = useState<number>(0); // Min degree of baseNodes, tiles load nodes below this
  const tileNodesRef = useRef<GraphNode[]>([]);
  const tilePromiseRef = useRef<Promise<void> | null>(null);
  const pendingTileRequestRef = useRef<{ bbox?: BoundingBox; batchMultiplier: number } | null>(null);
  const viewportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchDetailNodesRef = useRef<((bbox?: BoundingBox, batchMultiplier?: number) => Promise<void>) | null>(null);
  
  // Accumulated cache of ALL tile nodes ever loaded (persisted to IndexedDB)
  // This is separate from tileNodes (which is what's currently displayed)
  // When user zooms out, tileNodes is cleared but allCachedTileNodes remains
  // When user zooms back in, we first restore from cache, then fetch missing nodes
  const allCachedTileNodesRef = useRef<GraphNode[]>([]);
  const cachedMinDegreeRef = useRef<number>(0); // Lowest degree ever loaded (for progressive fetch)
  
  // Customizable tile config (user can adjust MAX_MEMORY_NODES)
  const [maxMemoryNodes, setMaxMemoryNodesState] = useState(DEFAULT_TILE_CONFIG.MAX_MEMORY_NODES);
  const tileConfig = useMemo(() => ({
    ...DEFAULT_TILE_CONFIG,
    MAX_MEMORY_NODES: maxMemoryNodes,
  }), [maxMemoryNodes]);
  
  // Setter for max memory nodes (exposed to UI)
  const setMaxMemoryNodes = useCallback((maxNodes: number) => {
    const clamped = Math.max(50_000, Math.min(660_000, maxNodes));
    setMaxMemoryNodesState(clamped);
    console.log(`📊 [PublicGraphData] Max memory nodes set to ${clamped.toLocaleString()}`);
  }, []);

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

  // Auto-load data from IndexedDB cache on mount
  useEffect(() => {
    const loadCachedData = async () => {
      // ALWAYS check labels version on mount, even if labels are already loaded in memory
      // This handles the case where user was on another page when cache was invalidated
      try {
        const versionResponse = await fetch('/api/graph/refresh-labels-cache', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (versionResponse.ok) {
          const versionData = await versionResponse.json();
          const serverVersion = versionData.version || 0;
          
          // If we have labels in memory, check if they're stale
          if (globalPublicState.labelsLoaded && labelsVersionRef.current > 0) {
            if (serverVersion > labelsVersionRef.current) {
              console.log('🔄 [Public Labels] Memory cache stale on mount (server:', serverVersion, 'local:', labelsVersionRef.current, '), invalidating...');
              // Invalidate memory and IndexedDB cache
              globalPublicState.labelsLoaded = false;
              globalPublicState.labelMap = {};
              globalPublicState.floatingLabels = [];
              await publicGraphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: {}, floatingLabels: [] });
              setLabelMapState({});
              setFloatingLabelsState([]);
              setIsLabelsLoaded(false);
              labelsPromiseRef.current = null;
            }
          }
          // Update version ref for future comparisons
          if (serverVersion > 0) {
            labelsVersionRef.current = serverVersion;
          }
        }
      } catch {
        // If version check fails, continue with existing cache
      }
      
      // Load normalization bounds from cache first
      if (!globalPublicState.normalizationBounds) {
        try {
          const cachedBounds = await publicGraphIDB.load<NormalizationBounds>(CACHE_KEYS.NORMALIZATION_BOUNDS);
          if (cachedBounds && publicGraphIDB.isCacheValid(cachedBounds.timestamp)) {
            globalPublicState.normalizationBounds = cachedBounds.data;
            setNormalizationBoundsState(cachedBounds.data);
          }
        } catch (err) {
          console.warn('💾 [PublicIDB] Failed to auto-load bounds:', err);
        }
      }

      // Load base nodes from cache if not already loaded
      if (!globalPublicState.baseNodesLoaded) {
        try {
          const cached = await publicGraphIDB.load<CachedGraphNode[]>(CACHE_KEYS.BASE_NODES);
          if (cached && publicGraphIDB.isCacheValid(cached.timestamp)) {
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
              size: 1,
              color: '#ffffff',
            }));
            globalPublicState.baseNodes = loadedNodes;
            globalPublicState.baseNodesLoaded = true;
            setBaseNodesState(loadedNodes);
            setIsBaseNodesLoaded(true);
            
            // Calculate bounds if not already loaded
            if (!globalPublicState.normalizationBounds && loadedNodes.length > 0) {
              const bounds = calculateBounds(loadedNodes);
              globalPublicState.normalizationBounds = bounds;
              setNormalizationBoundsState(bounds);
              publicGraphIDB.save(CACHE_KEYS.NORMALIZATION_BOUNDS, bounds).catch(console.warn);
            }
          }
        } catch (err) {
          console.warn('💾 [PublicIDB] Failed to auto-load base nodes:', err);
        }
      }

      // Load tile state (accumulated cache + currentMinDegree + baseNodesMinDegree) from cache
      // The cache is ACCUMULATIVE - we never delete nodes, only add new ones
      try {
        const cachedTileState = await publicGraphIDB.load<{ tileNodes: CachedGraphNode[]; currentMinDegree: number; baseNodesMinDegree?: number }>(CACHE_KEYS.TILE_STATE);
        if (cachedTileState && publicGraphIDB.isCacheValid(cachedTileState.timestamp)) {
          const restoredTileNodes: GraphNode[] = (cachedTileState.data.tileNodes || []).map(node => ({
            id: node.coord_hash,
            label: node.label,
            x: node.x,
            y: node.y,
            community: node.community,
            degree: node.degree,
            tier: node.tier as GraphNode['tier'],
            nodeType: node.nodeType as GraphNode['nodeType'],
            graphLabel: node.graphLabel,
            size: 1,
            color: '#ffffff',
          }));

          // Restore baseNodesMinDegree first (needed for fetch fallback)
          const restoredBaseMinDegree = Number(cachedTileState.data.baseNodesMinDegree || 0);
          if (restoredBaseMinDegree > 0) {
            setBaseNodesMinDegree(restoredBaseMinDegree);
            console.log(`💾 [PublicIDB] Restored baseNodesMinDegree=${restoredBaseMinDegree.toFixed(4)}`);
          }

          if (restoredTileNodes.length > 0) {
            const restoredMinDegree = Number(cachedTileState.data.currentMinDegree || 0);
            // Store in accumulated cache ref (this is the persistent cache)
            allCachedTileNodesRef.current = restoredTileNodes;
            cachedMinDegreeRef.current = restoredMinDegree;
            setCurrentMinDegree(restoredMinDegree);
            console.log(`💾 [PublicIDB] Restored ${restoredTileNodes.length} tile nodes to cache (display will be rebuilt from viewport), currentMinDegree=${restoredMinDegree.toFixed(4)}`);
          }
        }
      } catch (err) {
        console.warn('💾 [PublicIDB] Failed to auto-load tile state:', err);
      }

      // Load labels from cache if not already loaded
      // But first check server version to ensure cache is still valid
      if (!globalPublicState.labelsLoaded) {
        try {
          const cached = await publicGraphIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[]; version?: number }>(CACHE_KEYS.FLOATING_LABELS);
          if (cached && publicGraphIDB.isCacheValid(cached.timestamp)) {
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
              globalPublicState.labelMap = cached.data.labelMap;
              globalPublicState.floatingLabels = cached.data.floatingLabels;
              globalPublicState.labelsLoaded = true;
              setLabelMapState(cached.data.labelMap);
              setFloatingLabelsState(cached.data.floatingLabels);
              setIsLabelsLoaded(true);
              labelsVersionRef.current = serverVersion || cachedVersion;
            } else {
              // Cache is stale, delete it so fetchLabels will get fresh data
              console.log('🔄 [Public Labels] Cache stale (server:', serverVersion, 'cache:', cachedVersion, '), will fetch fresh');
              await publicGraphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: {}, floatingLabels: [] });
            }
          }
        } catch (err) {
          console.warn('💾 [PublicIDB] Failed to auto-load labels:', err);
        }
      }
    };

    loadCachedData();
  }, [calculateBounds]);

  // ===== SSE for real-time updates (replaces polling) =====
  // SSE handler for labels updates
  const handleSSELabels = useCallback(async (data: SSELabelsData) => {
    console.log('🔌 [Public SSE] Labels update received:', data);
    
    if (data.invalidated) {
      // Reset the loaded flag to force a fresh fetch
      globalPublicState.labelsLoaded = false;
      globalPublicState.labelMap = {};
      globalPublicState.floatingLabels = [];
      labelsPromiseRef.current = null;
      
      // Delete old cache
      await publicGraphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: {}, floatingLabels: [] });
      
      // Reset state
      setLabelMapState({});
      setFloatingLabelsState([]);
      setIsLabelsLoaded(false);
      
      // Fetch fresh labels from server
      try {
        const labelsResponse = await fetch('/api/graph/consent_labels', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (labelsResponse.ok) {
          const labelsData = await labelsResponse.json();
          if (labelsData.success) {
            const newLabelMap = labelsData.labelMap || {};
            const newFloatingLabels: FloatingLabel[] = (labelsData.floatingLabels || []).map((label: any) => ({
              coord_hash: label.coord_hash,
              x: label.x,
              y: label.y,
              text: label.text,
              priority: label.priority,
              level: label.level,
            }));
            
            globalPublicState.labelMap = newLabelMap;
            globalPublicState.floatingLabels = newFloatingLabels;
            globalPublicState.labelsLoaded = true;
            setLabelMapState(newLabelMap);
            setFloatingLabelsState(newFloatingLabels);
            setIsLabelsLoaded(true);
            
            // Save to IndexedDB cache with version
            publicGraphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: newLabelMap, floatingLabels: newFloatingLabels, version: data.version }).catch(() => {});
            
            console.log(`🔌 [Public SSE] Refetched ${Object.keys(newLabelMap).length} labels`);
          }
        }
      } catch (fetchError) {
        console.warn('Failed to refetch public labels after SSE notification:', fetchError);
      }
    }
  }, []);

  // Initialize SSE connection for real-time updates
  useSSE({
    onLabels: handleSSELabels,
    onConnected: (data) => {
      console.log('🔌 [Public SSE] Connected to server:', data);
    },
    onError: (error) => {
      console.warn('🔌 [Public SSE] Connection error:', error);
    },
  });

  // Fetch base nodes from Mosaic/DuckDB (public, no auth required)
  const fetchBaseNodes = useCallback(async () => {
    // Return existing promise if already fetching
    if (baseNodesPromiseRef.current) {
      return baseNodesPromiseRef.current;
    }
    
    // Skip if already loaded in memory
    if (globalPublicState.baseNodesLoaded) {
      return;
    }

    setIsBaseNodesLoading(true);
    
    baseNodesPromiseRef.current = (async () => {
      try {
        // Try to load from IndexedDB cache first
        const cached = await publicGraphIDB.load<CachedGraphNode[]>(CACHE_KEYS.BASE_NODES);
        if (cached && publicGraphIDB.isCacheValid(cached.timestamp)) {
          
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
            size: 1,
            color: '#ffffff',
          }));
          
          globalPublicState.baseNodes = loadedNodes;
          globalPublicState.baseNodesLoaded = true;
          setBaseNodesState(loadedNodes);
          setIsBaseNodesLoaded(true);
          return;
        }

        
        // Fetch only public data (no twitter_id), exclude community 8
        // Limit to top N nodes by degree for initial load - additional nodes loaded via tiles
        // PRIORITY: First load all nodes present in users_with_name_consent (members with consent)
        // Then fill up to INITIAL_NODES with highest degree nodes
        const INITIAL_NODES_LIMIT = tileConfig.INITIAL_NODES; // 100,000
        console.log(`📊 [PublicGraphData] Loading initial ${INITIAL_NODES_LIMIT} nodes (members with consent first, then top by degree)...`);
        
        // Use a CTE to prioritize members with consent:
        // 1. First get all nodes that are in users_with_name_consent (priority = 0)
        // 2. Then get remaining nodes ordered by degree (priority = 1)
        // 3. Union and limit to INITIAL_NODES
        const sql = `
          WITH consent_nodes AS (
            SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type, 0 as priority
            FROM postgres_db.public.graph_nodes_03_11_25 g
            INNER JOIN postgres_db.public.users_with_name_consent u ON g.id = u.twitter_id
            WHERE g.community != 8
          ),
          other_nodes AS (
            SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type, 1 as priority
            FROM postgres_db.public.graph_nodes_03_11_25 g
            WHERE g.community != 8
              AND NOT EXISTS (
                SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
              )
          ),
          combined AS (
            SELECT * FROM consent_nodes
            UNION ALL
            SELECT * FROM other_nodes
          )
          SELECT label, x, y, community, degree, tier, node_type, priority
          FROM combined
          ORDER BY priority ASC, degree DESC
          LIMIT ${INITIAL_NODES_LIMIT}
        `;
        
        const response = await fetch('/api/mosaic/sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, type: 'arrow' }),
        });

        if (!response.ok) throw new Error('Failed to load nodes from Mosaic');

        const buffer = await response.arrayBuffer();
        const arrowTable = tableFromIPC(buffer);

        const loadedNodes: GraphNode[] = [];
        const cachedNodes: CachedGraphNode[] = [];
        const degreeBasedNodes: number[] = []; // Track degrees of non-consent nodes for threshold calculation
        const labelCol = arrowTable.getChild('graph_label') || arrowTable.getChild('label');
        const xCol = arrowTable.getChild('x');
        const yCol = arrowTable.getChild('y');
        const communityCol = arrowTable.getChild('community');
        const degreeCol = arrowTable.getChild('degree');
        const tierCol = arrowTable.getChild('tier');
        const nodeTypeCol = arrowTable.getChild('node_type');
        const priorityCol = arrowTable.getChild('priority');

        let consentNodesCount = 0;
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
          const priority = priorityCol?.get(i) != null ? Number(priorityCol.get(i)) : 1;
          
          // Track consent vs degree-based nodes
          if (priority === 0) {
            consentNodesCount++;
          } else {
            degreeBasedNodes.push(degree);
          }
          
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
          });
        }

        globalPublicState.baseNodes = loadedNodes;
        globalPublicState.baseNodesLoaded = true;
        setBaseNodesState(loadedNodes);
        setIsBaseNodesLoaded(true);
        
        // Calculate min degree for tile filtering based on DEGREE-BASED nodes only (not consent nodes)
        // This ensures tiles load nodes below the degree threshold of the "top by degree" nodes
        // Consent nodes are already loaded regardless of their degree
        if (degreeBasedNodes.length > 0) {
          const minDegree = Math.min(...degreeBasedNodes);
          setBaseNodesMinDegree(minDegree);
          console.log(`📊 [PublicGraphData] Loaded ${consentNodesCount} consent nodes + ${degreeBasedNodes.length} by degree`);
          console.log(`📊 [PublicGraphData] Base nodes min degree (degree-based only): ${minDegree.toFixed(4)} - tiles will load nodes below this`);
        } else {
          // All nodes are consent nodes, use global min degree
          const minDegree = Math.min(...loadedNodes.map(n => n.degree));
          setBaseNodesMinDegree(minDegree);
          console.log(`📊 [PublicGraphData] All ${loadedNodes.length} nodes are consent nodes, min degree: ${minDegree.toFixed(4)}`);
        }
        
        // Calculate and cache bounds
        if (loadedNodes.length > 0) {
          const bounds = calculateBounds(loadedNodes);
          globalPublicState.normalizationBounds = bounds;
          setNormalizationBoundsState(bounds);
          publicGraphIDB.save(CACHE_KEYS.NORMALIZATION_BOUNDS, bounds).catch(console.warn);
        }
        
        // Save to IndexedDB cache
        publicGraphIDB.save(CACHE_KEYS.BASE_NODES, cachedNodes).catch(console.warn);
        
      } catch (error) {
        console.error('❌ [PublicGraphData] Error fetching base nodes:', error);
      } finally {
        setIsBaseNodesLoading(false);
        baseNodesPromiseRef.current = null;
      }
    })();

    return baseNodesPromiseRef.current;
  }, [calculateBounds]);

  // Fetch public labels (for tooltips and floating labels)
  const fetchLabels = useCallback(async () => {
    // Return existing promise if already fetching
    if (labelsPromiseRef.current) {
      return labelsPromiseRef.current;
    }
    
    // Skip if already loaded in memory
    if (globalPublicState.labelsLoaded) {
      return;
    }

    setIsLabelsLoading(true);
    
    labelsPromiseRef.current = (async () => {
      try {
        // Try to load from IndexedDB cache first
        const cached = await publicGraphIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[] }>(CACHE_KEYS.FLOATING_LABELS);
        if (cached && publicGraphIDB.isCacheValid(cached.timestamp)) {
          globalPublicState.labelMap = cached.data.labelMap;
          globalPublicState.floatingLabels = cached.data.floatingLabels;
          globalPublicState.labelsLoaded = true;
          setLabelMapState(cached.data.labelMap);
          setFloatingLabelsState(cached.data.floatingLabels);
          setIsLabelsLoaded(true);
          return;
        }

        
        const response = await fetch('/api/graph/consent_labels', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch consent labels');

        const data = await response.json();
        
        if (data.success) {
          const newLabelMap = data.labelMap || {};
          const newFloatingLabels: FloatingLabel[] = (data.floatingLabels || []).map((label: any) => ({
            coord_hash: label.coord_hash,
            x: label.x,
            y: label.y,
            text: label.text,
            priority: label.priority,
            level: label.level,
          }));
          
          globalPublicState.labelMap = newLabelMap;
          globalPublicState.floatingLabels = newFloatingLabels;
          globalPublicState.labelsLoaded = true;
          setLabelMapState(newLabelMap);
          setFloatingLabelsState(newFloatingLabels);
          setIsLabelsLoaded(true);
                    
          // Save to IndexedDB cache with current version
          const currentVersion = labelsVersionRef.current || Date.now();
          publicGraphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: newLabelMap, floatingLabels: newFloatingLabels, version: currentVersion }).catch(console.warn);
        }
      } catch (error) {
        console.error('❌ [PublicGraphData] Error fetching labels:', error);
      } finally {
        setIsLabelsLoading(false);
        labelsPromiseRef.current = null;
      }
    })();

    return labelsPromiseRef.current;
  }, []);

  // ============================================
  // Tile-based progressive loading functions
  // ============================================

  // Helper to parse Arrow table into nodes (for tiles)
  const parseArrowToNodes = useCallback((arrowTable: Table<any>): GraphNode[] => {
    const loadedNodes: GraphNode[] = [];
    const labelCol = arrowTable.getChild('graph_label') || arrowTable.getChild('label');
    const xCol = arrowTable.getChild('x');
    const yCol = arrowTable.getChild('y');
    const communityCol = arrowTable.getChild('community');
    const degreeCol = arrowTable.getChild('degree');
    const tierCol = arrowTable.getChild('tier');
    const nodeTypeCol = arrowTable.getChild('node_type');

    for (let i = 0; i < arrowTable.numRows; i++) {
      const x = Number(xCol?.get(i) ?? 0);
      const y = Number(yCol?.get(i) ?? 0);
      const hash = coordHash(x, y);
      const label = String(labelCol?.get(i) ?? '');
      const community = communityCol?.get(i) != null ? Number(communityCol.get(i)) : null;
      const degree = Number(degreeCol?.get(i) ?? 0);
      const tier = (tierCol?.get(i) as string) ?? 'minor';
      const nodeType = nodeTypeCol?.get(i) ? String(nodeTypeCol.get(i)) : undefined;
      
      loadedNodes.push({
        id: hash,
        label: label || hash,
        x,
        y,
        community,
        degree,
        tier: tier as GraphNode['tier'],
        nodeType: nodeType as GraphNode['nodeType'],
        size: 1,
        color: '#ffffff',
      });
    }
    
    return loadedNodes;
  }, []);

  // Track the minimum degree we've loaded so far (for progressive loading)
  // Start with baseNodesMinDegree, then decrease as we load more batches
  const [currentMinDegree, setCurrentMinDegree] = useState<number>(0);
  
  // Track previous zoom level to detect zoom in/out
  const prevZoomRef = useRef<number>(0);
  // Track current viewport bounding box for spatial filtering
  const currentBboxRef = useRef<BoundingBox | null>(null);
  const tileStateSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save accumulated cache to IndexedDB (debounced)
  // We save allCachedTileNodesRef (the full cache), not tileNodes (which may be empty after dezoom)
  const saveTileCacheToIDB = useCallback(() => {
    if (tileStateSaveTimeoutRef.current) {
      clearTimeout(tileStateSaveTimeoutRef.current);
    }

    tileStateSaveTimeoutRef.current = setTimeout(() => {
      const cachedNodes = allCachedTileNodesRef.current;
      if (cachedNodes.length === 0) return;
      
      const cachedTileNodes: CachedGraphNode[] = cachedNodes.map(n => ({
        coord_hash: n.id,
        label: n.label,
        x: n.x,
        y: n.y,
        community: n.community,
        degree: n.degree,
        tier: n.tier,
        nodeType: n.nodeType,
        graphLabel: n.graphLabel ?? undefined,
      }));

      publicGraphIDB.save(CACHE_KEYS.TILE_STATE, {
        tileNodes: cachedTileNodes,
        currentMinDegree: cachedMinDegreeRef.current,
        baseNodesMinDegree,
      }).catch(() => {});
      
      console.log(`💾 [PublicIDB] Saved ${cachedNodes.length} tile nodes to cache, minDegree=${cachedMinDegreeRef.current.toFixed(4)}`);
    }, 1000);
  }, [baseNodesMinDegree]);

  useEffect(() => {
    tileNodesRef.current = tileNodes;
  }, [tileNodes]);
  
  // Fetch additional nodes progressively - each call loads the next batch by degree
  // This allows loading 100k initial → +50k → +50k → etc as user zooms
  // If bbox is provided, also filter by spatial location for pan support
  // batchMultiplier: load more nodes per request during aggressive zoom (1-5x)
  // 
  // CACHE STRATEGY:
  // 1. First check accumulated cache (allCachedTileNodesRef) for nodes matching criteria
  // 2. If cache has enough nodes, use them directly (no fetch)
  // 3. If cache doesn't have enough, fetch from server and ADD to cache
  // 4. Cache is NEVER cleared - only accumulated (persisted to IndexedDB)
  const fetchDetailNodes = useCallback(async (bbox?: BoundingBox, batchMultiplier: number = 1) => {
    // Use cachedMinDegree if set (from accumulated cache), otherwise use baseNodesMinDegree
    // This ensures we continue from where we left off, even after dezoom/rezoom
    const degreeThreshold = cachedMinDegreeRef.current > 0 ? cachedMinDegreeRef.current : baseNodesMinDegree;
    
    if (degreeThreshold <= 0) {
      // Don't log spam - this is expected during initial load before baseNodes are ready
      return;
    }

    if (tilePromiseRef.current) {
      // Don't drop the request: store the latest desired bbox/batchMultiplier
      pendingTileRequestRef.current = { bbox, batchMultiplier };
      console.log(`📦 [Public Tiles] Skipping: already loading (queued latest request)`);
      return tilePromiseRef.current;
    }

    // Check if we've reached the limit for DISPLAY (not cache)
    const currentDisplayTotal = baseNodes.length + tileNodes.length;
    if (currentDisplayTotal >= tileConfig.MAX_MEMORY_NODES) {
      console.log(`📦 [Public Tiles] Skipping: reached max display nodes (${currentDisplayTotal}/${tileConfig.MAX_MEMORY_NODES})`);
      return;
    }

    setIsTileLoading(true);

    // Calculate how many nodes we want to display
    const maxDetailBudget = Math.max(0, tileConfig.MAX_MEMORY_NODES - tileConfig.INITIAL_NODES);
    const remainingDisplayBudget = Math.max(0, tileConfig.MAX_MEMORY_NODES - currentDisplayTotal);
    const targetBatchSize = Math.min(
      tileConfig.NODES_PER_TILE * batchMultiplier,
      maxDetailBudget,
      remainingDisplayBudget
    );

    tilePromiseRef.current = (async () => {
      try {
        // STEP 1: Check accumulated cache for nodes we can reuse
        const cachedNodes = allCachedTileNodesRef.current;
        const displayedIds = new Set(tileNodes.map(n => n.id));
        const baseIds = new Set(baseNodes.map(n => n.id));

        // If we are re-zooming after a dezoom (display cleared), prefer replaying cached nodes
        // based on bbox only (ignore degree threshold) to avoid re-fetching the same nodes.
        const isReplayFromCache = tileNodes.length === 0 && !!bbox;
        
        // Find cached nodes that:
        // - Are not already displayed
        // - Are not in baseNodes
        // - Match the bbox (if provided)
        // - Have degree below threshold (except during replay-from-cache)
        let cachedCandidates = cachedNodes.filter(n => {
          if (displayedIds.has(n.id) || baseIds.has(n.id)) return false;
          if (!isReplayFromCache && n.degree >= degreeThreshold) return false;
          if (bbox) {
            if (n.x < bbox.minX || n.x > bbox.maxX || n.y < bbox.minY || n.y > bbox.maxY) return false;
          }
          return true;
        });
        
        // Sort by degree DESC (highest first, to match server behavior)
        cachedCandidates.sort((a, b) => b.degree - a.degree);
        
        // Take up to targetBatchSize from cache
        const fromCache = cachedCandidates.slice(0, targetBatchSize);
        const needFromServer = targetBatchSize - fromCache.length;
        
        if (fromCache.length > 0) {
          console.log(
            isReplayFromCache
              ? `📦 [Public Tiles] Replayed ${fromCache.length} nodes from cache in bbox (need ${needFromServer} more from server)`
              : `📦 [Public Tiles] Found ${fromCache.length} nodes in cache (need ${needFromServer} more from server)`
          );
        }
        
        let loadedFromServer: GraphNode[] = [];
        
        // STEP 2: Fetch from server if we need more nodes
        if (needFromServer > 0) {
          // Use the lowest degree from cache candidates as the new threshold
          // This ensures we don't re-fetch nodes we already have
          const serverDegreeThreshold = fromCache.length > 0 
            ? Math.min(...fromCache.map(n => n.degree))
            : degreeThreshold;
          
          const spatialFilter = bbox ? `
              AND g.x BETWEEN ${bbox.minX} AND ${bbox.maxX}
              AND g.y BETWEEN ${bbox.minY} AND ${bbox.maxY}` : '';
          
          const sql = `
            SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type
            FROM postgres_db.public.graph_nodes_03_11_25 g
            WHERE g.community != 8
              AND g.degree < ${serverDegreeThreshold}${spatialFilter}
            ORDER BY g.degree DESC
            LIMIT ${needFromServer}
          `;
          
          const bboxInfo = bbox ? ` in bbox [${bbox.minX.toFixed(2)},${bbox.maxX.toFixed(2)}]x[${bbox.minY.toFixed(2)},${bbox.maxY.toFixed(2)}]` : '';
          console.log(`📦 [Public Tiles] Fetching ${needFromServer} nodes with degree < ${serverDegreeThreshold.toFixed(4)}${bboxInfo}`);

          const response = await fetch('/api/mosaic/sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, type: 'arrow' }),
          });

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const arrowTable = tableFromIPC(buffer);
            loadedFromServer = parseArrowToNodes(arrowTable);
            
            if (loadedFromServer.length > 0) {
              // Add new nodes to accumulated cache (deduplicated)
              const existingCacheIds = new Set(cachedNodes.map(n => n.id));
              const newForCache = loadedFromServer.filter(n => !existingCacheIds.has(n.id));
              if (newForCache.length > 0) {
                allCachedTileNodesRef.current = [...cachedNodes, ...newForCache];
                console.log(`📦 [Public Tiles] Added ${newForCache.length} new nodes to cache (total: ${allCachedTileNodesRef.current.length})`);
              }
            }
          } else {
            console.warn('⚠️ [Public Tiles] Failed to fetch tile:', response.statusText);
          }
        }

        // STEP 3: Combine cache + server results and update display
        const allNewNodes = [...fromCache, ...loadedFromServer];
        
        if (allNewNodes.length === 0) {
          console.log(`📦 [Public Tiles] No more nodes to load (all nodes loaded)`);
          return;
        }

        // Update cachedMinDegree to the minimum degree we've ever loaded.
        // Apply a small epsilon to ensure the next query threshold strictly decreases
        // (otherwise we can get stuck repeatedly requesting the same degree boundary).
        const minDegreeInBatch = Math.min(...allNewNodes.map(n => n.degree));
        const nextThreshold = Math.max(0, minDegreeInBatch - 1e-6);
        if (cachedMinDegreeRef.current === 0 || nextThreshold < cachedMinDegreeRef.current) {
          cachedMinDegreeRef.current = nextThreshold;
        }
        setCurrentMinDegree(cachedMinDegreeRef.current);
        console.log(`📦 [Public Tiles] Next batch will load degree < ${cachedMinDegreeRef.current.toFixed(4)}`);

        // STEP 4: Update displayed tileNodes
        setTileNodes(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newNodes = allNewNodes.filter(n => !existingIds.has(n.id));
          
          const totalNodes = prev.length + newNodes.length;
          const maxTileNodes = tileConfig.MAX_MEMORY_NODES - baseNodes.length;
          
          if (totalNodes > maxTileNodes) {
            const combined = [...prev, ...newNodes];
            console.log(`📦 [Public Tiles] setTileNodes: prev=${prev.length}, new=${newNodes.length}, trimmed to ${maxTileNodes}`);
            return combined.slice(-maxTileNodes);
          }
          
          console.log(`📦 [Public Tiles] setTileNodes: prev=${prev.length}, new=${newNodes.length}, total=${totalNodes}`);
          return [...prev, ...newNodes];
        });

        // STEP 5: Persist accumulated cache to IndexedDB (debounced)
        saveTileCacheToIDB();

        console.log(`📦 [Public Tiles] Loaded ${allNewNodes.length} nodes (${fromCache.length} from cache, ${loadedFromServer.length} from server)`);

      } catch (error) {
        console.error('❌ [Public Tiles] Error fetching tile:', error);
      } finally {
        setIsTileLoading(false);
        tilePromiseRef.current = null;

        // If viewport changed while we were loading, immediately run the latest queued request.
        const pending = pendingTileRequestRef.current;
        if (pending) {
          pendingTileRequestRef.current = null;
          setTimeout(() => {
            void fetchDetailNodesRef.current?.(pending.bbox, pending.batchMultiplier);
          }, 0);
        }
      }
    })();

    return tilePromiseRef.current;
  }, [parseArrowToNodes, baseNodes, tileNodes, baseNodesMinDegree, tileConfig.NODES_PER_TILE, tileConfig.MAX_MEMORY_NODES, saveTileCacheToIDB]);

  // Keep ref updated to the latest fetchDetailNodes to avoid stale closures in debounce
  fetchDetailNodesRef.current = fetchDetailNodes;
  
  // Unload detail nodes from DISPLAY when zooming out significantly
  // NOTE: This only clears the React state (tileNodes), NOT the accumulated cache
  // The cache (allCachedTileNodesRef) is preserved so rezoom can reuse cached nodes
  const unloadDetailNodes = useCallback(() => {
    if (tileNodes.length > 0) {
      console.log(`📦 [Public Tiles] Hiding ${tileNodes.length} detail nodes from display (zoom out) - cache preserved (${allCachedTileNodesRef.current.length} nodes)`);
      setTileNodes([]);
      // Don't reset currentMinDegree - we want to continue from cache on rezoom
      // setCurrentMinDegree(0); // REMOVED - keep cache state
    }
  }, [tileNodes.length]);
  
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
    const isFirstViewportChange = prevBbox === null;
    prevZoomRef.current = zoomLevel;
    currentBboxRef.current = boundingBox;
    setCurrentZoom(zoomLevel);
    
    // Detect zoom direction and pan (but not on first viewport change after restore)
    const isPanning = !isFirstViewportChange && hasMovedSignificantly(prevBbox, boundingBox) && Math.abs(zoomLevel - prevZoom) < prevZoom * 0.1;
    
    // Calculate zoom aggressiveness: how many batches to load based on zoom delta
    // If user zooms from 0.1 to 2.0 (20x), we want to load more batches than 0.1 to 0.2 (2x)
    const zoomRatio = prevZoom > 0 ? zoomLevel / prevZoom : 1;
    const isZoomingIn = zoomRatio > 1.1; // More than 10% zoom in
    // Calculate batches: 1 batch per 50% zoom increase, max 5 batches
    const batchCount = isZoomingIn ? Math.min(5, Math.max(1, Math.floor(Math.log2(zoomRatio) * 2) + 1)) : 1;
    
    // Below threshold: hide detail nodes from display (but keep cache intact)
    // But skip on first viewport change (preserve restored tiles)
    if (zoomLevel < tileConfig.ZOOM_THRESHOLD) {
      if (isFirstViewportChange) {
        // First viewport change after mount/restore - don't unload restored tiles
        return;
      }
      // Hide detail nodes when zooming out to overview (cache is preserved)
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
      viewportDebounceRef.current = setTimeout(() => {
        // Check inside timeout to get latest state
        setTileNodes(prev => {
          if (prev.length > 0) {
            console.log(`📦 [Public Tiles] Hiding ${prev.length} detail nodes (zoom out) - cache preserved (${allCachedTileNodesRef.current.length} nodes)`);
            // Don't reset currentMinDegree - cache state is preserved for rezoom
            return [];
          }
          return prev;
        });
      }, tileConfig.DEBOUNCE_MS);
      return;
    }

    // PAN: Clear displayed nodes and load new ones for the new area
    // Cache is preserved - we'll check it first before fetching
    // Skip on first viewport change to preserve restored tiles
    if (isPanning) {
      setTileNodes(prev => {
        if (prev.length > 0) {
          console.log(`📦 [Public Tiles] Pan detected - clearing display, will reload from cache + server`);
          // Don't reset currentMinDegree - cache state is preserved
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
        console.log(`🚀 [Public Tiles] Aggressive zoom detected (${zoomRatio.toFixed(2)}x) - loading ${batchCount}x batch size`);
      }
      // Pass batchCount as multiplier to load more nodes in one request
      await fetchDetailNodesRef.current?.(boundingBox, batchCount);
    }, tileConfig.DEBOUNCE_MS);
  }, [tileConfig.ZOOM_THRESHOLD, tileConfig.DEBOUNCE_MS, hasMovedSignificantly]);

  // Clear tile cache
  const clearTileCache = useCallback(() => {
    publicTileCache.clear();
    setTileNodes([]);
    allCachedTileNodesRef.current = [];
    cachedMinDegreeRef.current = 0;
    setCurrentMinDegree(0);
    publicGraphIDB.save(CACHE_KEYS.TILE_STATE, {
      tileNodes: [],
      currentMinDegree: 0,
      baseNodesMinDegree,
    }).catch(() => {});
    console.log('🗑️ [Public Tiles] Cache cleared');
  }, [baseNodesMinDegree]);

  // Merged nodes: baseNodes + tileNodes (deduplicated)
  const mergedNodes = useMemo(() => {
    if (tileNodes.length === 0) {
      console.log(`📊 [PublicContext] mergedNodes: ${baseNodes.length} (no tile nodes yet)`);
      return baseNodes;
    }

    const baseNodeIds = new Set(baseNodes.map(n => n.id));
    const uniqueTileNodes = tileNodes.filter(n => !baseNodeIds.has(n.id));
    const merged = [...baseNodes, ...uniqueTileNodes];
    
    console.log(`📊 [PublicContext] mergedNodes: ${merged.length} (base: ${baseNodes.length}, tiles: ${tileNodes.length}, unique new: ${uniqueTileNodes.length})`);
    return merged;
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
  const contextValue = useMemo<PublicGraphDataContextValue>(() => ({
    baseNodes,
    isBaseNodesLoaded,
    isBaseNodesLoading,
    fetchBaseNodes,
    normalizationBounds,
    labelMap,
    floatingLabels,
    isLabelsLoaded,
    isLabelsLoading,
    fetchLabels,
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
    isBaseNodesLoaded,
    isBaseNodesLoading,
    fetchBaseNodes,
    normalizationBounds,
    labelMap,
    floatingLabels,
    isLabelsLoaded,
    isLabelsLoading,
    fetchLabels,
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
    <PublicGraphDataContext.Provider value={contextValue}>
      {children}
    </PublicGraphDataContext.Provider>
  );
}

export type { FloatingLabel, NormalizationBounds };

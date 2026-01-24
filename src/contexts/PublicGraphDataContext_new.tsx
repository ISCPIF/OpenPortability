'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { GraphNode, BoundingBox, DEFAULT_TILE_CONFIG, TileConfig } from '@/lib/types/graph';
import { tableFromIPC, Table } from 'apache-arrow';
import { useSSE, SSELabelsData } from '@/hooks/useSSE';

// ============================================
// Types & Constants
// ============================================

function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

interface FloatingLabel {
  coord_hash: string;
  x: number;
  y: number;
  text: string;
  priority: number;
  level: number;
}

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
const IDB_NAME = 'hqx_public_graph_cache_v2';
const IDB_VERSION = 1;
const IDB_STORE_NODES = 'tile_nodes';
const IDB_STORE_META = 'metadata';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================
// IndexedDB Helper - Optimized for accumulative tile cache
// ============================================

class TileNodeIndexedDB {
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
        console.error('💾 [TileIDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store for individual tile nodes (keyed by coord_hash)
        if (!db.objectStoreNames.contains(IDB_STORE_NODES)) {
          const nodeStore = db.createObjectStore(IDB_STORE_NODES, { keyPath: 'coord_hash' });
          nodeStore.createIndex('degree', 'degree', { unique: false });
        }
        
        // Store for metadata (minDegree, timestamp, etc.)
        if (!db.objectStoreNames.contains(IDB_STORE_META)) {
          db.createObjectStore(IDB_STORE_META, { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  // Add nodes to cache (upsert - never delete)
  async addNodes(nodes: CachedGraphNode[]): Promise<void> {
    if (typeof window === 'undefined' || nodes.length === 0) return;

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_NODES, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NODES);

      for (const node of nodes) {
        store.put(node);
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (err) {
      console.warn('💾 [TileIDB] Failed to add nodes:', err);
    }
  }

  // Get all nodes from cache
  async getAllNodes(): Promise<CachedGraphNode[]> {
    if (typeof window === 'undefined') return [];

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_NODES, 'readonly');
      const store = transaction.objectStore(IDB_STORE_NODES);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('💾 [TileIDB] Failed to get all nodes:', err);
      return [];
    }
  }

  // Get nodes within bounding box (client-side filter for now)
  async getNodesInBbox(bbox: BoundingBox): Promise<CachedGraphNode[]> {
    const allNodes = await this.getAllNodes();
    return allNodes.filter(n => 
      n.x >= bbox.minX && n.x <= bbox.maxX && 
      n.y >= bbox.minY && n.y <= bbox.maxY
    );
  }

  // Get node count
  async getNodeCount(): Promise<number> {
    if (typeof window === 'undefined') return 0;

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_NODES, 'readonly');
      const store = transaction.objectStore(IDB_STORE_NODES);

      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      return 0;
    }
  }

  // Save metadata
  async saveMeta(key: string, data: any): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_META, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_META);

      return new Promise((resolve, reject) => {
        const request = store.put({ key, data, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('💾 [TileIDB] Failed to save meta:', err);
    }
  }

  // Load metadata
  async loadMeta<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
    if (typeof window === 'undefined') return null;

    try {
      const db = await this.getDB();
      const transaction = db.transaction(IDB_STORE_META, 'readonly');
      const store = transaction.objectStore(IDB_STORE_META);

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
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      return null;
    }
  }

  // Clear all tile nodes (explicit user action)
  async clearNodes(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const db = await this.getDB();
      const transaction = db.transaction([IDB_STORE_NODES, IDB_STORE_META], 'readwrite');
      transaction.objectStore(IDB_STORE_NODES).clear();
      transaction.objectStore(IDB_STORE_META).clear();

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (err) {
      console.warn('💾 [TileIDB] Failed to clear:', err);
    }
  }

  isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL_MS;
  }
}

const tileNodeIDB = new TileNodeIndexedDB();

// ============================================
// Legacy IDB for base nodes / labels (unchanged)
// ============================================

const LEGACY_IDB_NAME = 'hqx_public_graph_cache';
const LEGACY_IDB_VERSION = 1;
const LEGACY_IDB_STORE = 'public_graph_data';

class LegacyIndexedDB {
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

      const request = indexedDB.open(LEGACY_IDB_NAME, LEGACY_IDB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(LEGACY_IDB_STORE)) {
          db.createObjectStore(LEGACY_IDB_STORE, { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  async save<T>(key: string, data: T): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const db = await this.getDB();
      const tx = db.transaction(LEGACY_IDB_STORE, 'readwrite');
      const store = tx.objectStore(LEGACY_IDB_STORE);
      store.put({ key, data, timestamp: Date.now() });
    } catch (err) {
      console.warn(`💾 [LegacyIDB] Failed to save ${key}:`, err);
    }
  }

  async load<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
    if (typeof window === 'undefined') return null;
    try {
      const db = await this.getDB();
      const tx = db.transaction(LEGACY_IDB_STORE, 'readonly');
      const store = tx.objectStore(LEGACY_IDB_STORE);
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? { data: result.data as T, timestamp: result.timestamp } : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      return null;
    }
  }

  isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL_MS;
  }
}

const legacyIDB = new LegacyIndexedDB();

const CACHE_KEYS = {
  BASE_NODES: 'public_base_nodes',
  FLOATING_LABELS: 'public_floating_labels',
  NORMALIZATION_BOUNDS: 'public_normalization_bounds',
};

// ============================================
// Global state to prevent duplicate API calls
// ============================================

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

// ============================================
// Context Interface
// ============================================

interface PublicGraphDataContextValue {
  baseNodes: GraphNode[];
  isBaseNodesLoaded: boolean;
  isBaseNodesLoading: boolean;
  fetchBaseNodes: () => Promise<void>;
  normalizationBounds: NormalizationBounds | null;
  labelMap: Record<string, string>;
  floatingLabels: FloatingLabel[];
  isLabelsLoaded: boolean;
  isLabelsLoading: boolean;
  fetchLabels: () => Promise<void>;
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

export function usePublicGraphDataOptional() {
  return useContext(PublicGraphDataContext);
}

// ============================================
// Provider
// ============================================

interface PublicGraphDataProviderProps {
  children: ReactNode;
}

export function PublicGraphDataProvider({ children }: PublicGraphDataProviderProps) {
  // Base nodes state
  const [baseNodes, setBaseNodesState] = useState<GraphNode[]>(globalPublicState.baseNodes);
  const [isBaseNodesLoaded, setIsBaseNodesLoaded] = useState(globalPublicState.baseNodesLoaded);
  const [isBaseNodesLoading, setIsBaseNodesLoading] = useState(false);
  
  // Normalization bounds
  const [normalizationBounds, setNormalizationBoundsState] = useState<NormalizationBounds | null>(globalPublicState.normalizationBounds);
  
  // Labels state
  const [labelMap, setLabelMapState] = useState<Record<string, string>>(globalPublicState.labelMap);
  const [floatingLabels, setFloatingLabelsState] = useState<FloatingLabel[]>(globalPublicState.floatingLabels);
  const [isLabelsLoaded, setIsLabelsLoaded] = useState(globalPublicState.labelsLoaded);
  const [isLabelsLoading, setIsLabelsLoading] = useState(false);
  
  // Fetch promise refs
  const baseNodesPromiseRef = useRef<Promise<void> | null>(null);
  const labelsPromiseRef = useRef<Promise<void> | null>(null);
  const labelsVersionRef = useRef<number>(0);
  
  // ============================================
  // Tile-based progressive loading state
  // ============================================
  
  // tileNodes = what's currently DISPLAYED (can be cleared on zoom out)
  const [tileNodes, setTileNodes] = useState<GraphNode[]>([]);
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [baseNodesMinDegree, setBaseNodesMinDegree] = useState<number>(0);
  
  // In-memory cache of ALL tile nodes (mirrors IndexedDB for fast access)
  // This is the source of truth for what's been fetched
  const allCachedTileNodesRef = useRef<Map<string, GraphNode>>(new Map());
  
  // Fetch coordination (simple: skip if loading, no queue)
  const tilePromiseRef = useRef<Promise<void> | null>(null);
  const viewportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchDetailNodesRef = useRef<((bbox?: BoundingBox, batchMultiplier?: number) => Promise<void>) | null>(null);
  
  // Current min degree for progressive loading (ref to avoid stale closures)
  const currentMinDegreeRef = useRef<number>(0);
  
  // Viewport tracking
  const prevZoomRef = useRef<number>(0);
  const currentBboxRef = useRef<BoundingBox | null>(null);
  
  // Tile config
  const [maxMemoryNodes, setMaxMemoryNodesState] = useState(DEFAULT_TILE_CONFIG.MAX_MEMORY_NODES);
  const tileConfig = useMemo(() => ({
    ...DEFAULT_TILE_CONFIG,
    MAX_MEMORY_NODES: maxMemoryNodes,
  }), [maxMemoryNodes]);
  
  const setMaxMemoryNodes = useCallback((maxNodes: number) => {
    const clamped = Math.max(50_000, Math.min(660_000, maxNodes));
    setMaxMemoryNodesState(clamped);
    console.log(`📊 [PublicGraph] Max memory nodes set to ${clamped.toLocaleString()}`);
  }, []);

  // ============================================
  // Helpers
  // ============================================

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

  const cachedNodeToGraphNode = useCallback((node: CachedGraphNode): GraphNode => ({
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
  }), []);

  const graphNodeToCached = useCallback((node: GraphNode): CachedGraphNode => ({
    coord_hash: node.id,
    label: node.label,
    x: node.x,
    y: node.y,
    community: node.community,
    degree: node.degree,
    tier: node.tier,
    nodeType: node.nodeType,
    graphLabel: node.graphLabel ?? undefined,
  }), []);

  // ============================================
  // Load cached data on mount
  // ============================================

  useEffect(() => {
    const loadCachedData = async () => {
      // Load normalization bounds
      if (!globalPublicState.normalizationBounds) {
        try {
          const cachedBounds = await legacyIDB.load<NormalizationBounds>(CACHE_KEYS.NORMALIZATION_BOUNDS);
          if (cachedBounds && legacyIDB.isCacheValid(cachedBounds.timestamp)) {
            globalPublicState.normalizationBounds = cachedBounds.data;
            setNormalizationBoundsState(cachedBounds.data);
          }
        } catch (err) {
          console.warn('💾 [PublicGraph] Failed to load bounds:', err);
        }
      }

      // Load base nodes
      if (!globalPublicState.baseNodesLoaded) {
        try {
          const cached = await legacyIDB.load<CachedGraphNode[]>(CACHE_KEYS.BASE_NODES);
          if (cached && legacyIDB.isCacheValid(cached.timestamp)) {
            const loadedNodes = cached.data.map(cachedNodeToGraphNode);
            globalPublicState.baseNodes = loadedNodes;
            globalPublicState.baseNodesLoaded = true;
            setBaseNodesState(loadedNodes);
            setIsBaseNodesLoaded(true);
            
            // Calculate baseNodesMinDegree from cached nodes
            if (loadedNodes.length > 0) {
              const minDegree = Math.min(...loadedNodes.map(n => n.degree));
              setBaseNodesMinDegree(minDegree);
              console.log(`💾 [PublicGraph] Loaded ${loadedNodes.length} base nodes from cache, minDegree=${minDegree.toFixed(4)}`);
            }
            
            if (!globalPublicState.normalizationBounds && loadedNodes.length > 0) {
              const bounds = calculateBounds(loadedNodes);
              globalPublicState.normalizationBounds = bounds;
              setNormalizationBoundsState(bounds);
              legacyIDB.save(CACHE_KEYS.NORMALIZATION_BOUNDS, bounds).catch(console.warn);
            }
          }
        } catch (err) {
          console.warn('💾 [PublicGraph] Failed to load base nodes:', err);
        }
      }

      // Load tile cache metadata (minDegree) - NOT USED for runtime anymore
      // We use currentMinDegree state which resets on dezoom, so cache metadata is only for reference
      try {
        const meta = await tileNodeIDB.loadMeta<{ minDegree: number; baseNodesMinDegree: number }>('tile_state');
        if (meta && tileNodeIDB.isCacheValid(meta.timestamp)) {
          if (meta.data.baseNodesMinDegree > 0) {
            setBaseNodesMinDegree(meta.data.baseNodesMinDegree);
          }
          console.log(`💾 [TileCache] Metadata loaded (baseNodesMinDegree=${meta.data.baseNodesMinDegree})`);
        }
      } catch (err) {
        console.warn('💾 [TileCache] Failed to load metadata:', err);
      }

      // Load tile nodes into memory cache (but don't display yet - wait for viewport)
      try {
        const cachedNodes = await tileNodeIDB.getAllNodes();
        if (cachedNodes.length > 0) {
          for (const node of cachedNodes) {
            allCachedTileNodesRef.current.set(node.coord_hash, cachedNodeToGraphNode(node));
          }
          console.log(`💾 [TileCache] Loaded ${cachedNodes.length} nodes into memory (display will be built from viewport)`);
        }
      } catch (err) {
        console.warn('💾 [TileCache] Failed to load nodes:', err);
      }

      // Load labels
      if (!globalPublicState.labelsLoaded) {
        try {
          const cached = await legacyIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[]; version?: number }>(CACHE_KEYS.FLOATING_LABELS);
          if (cached && legacyIDB.isCacheValid(cached.timestamp)) {
            globalPublicState.labelMap = cached.data.labelMap;
            globalPublicState.floatingLabels = cached.data.floatingLabels;
            globalPublicState.labelsLoaded = true;
            setLabelMapState(cached.data.labelMap);
            setFloatingLabelsState(cached.data.floatingLabels);
            setIsLabelsLoaded(true);
            labelsVersionRef.current = cached.data.version || cached.timestamp;
          }
        } catch (err) {
          console.warn('💾 [PublicGraph] Failed to load labels:', err);
        }
      }
    };

    loadCachedData();
  }, [cachedNodeToGraphNode, calculateBounds]);

  // ============================================
  // SSE for real-time label updates
  // ============================================

  const handleSSELabels = useCallback(async (data: SSELabelsData) => {
    console.log('🔌 [SSE] Labels update received:', data);
    
    if (data.invalidated) {
      globalPublicState.labelsLoaded = false;
      globalPublicState.labelMap = {};
      globalPublicState.floatingLabels = [];
      labelsPromiseRef.current = null;
      
      await legacyIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: {}, floatingLabels: [] });
      
      setLabelMapState({});
      setFloatingLabelsState([]);
      setIsLabelsLoaded(false);
      
      try {
        const response = await fetch('/api/graph/consent_labels', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const labelsData = await response.json();
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
            
            legacyIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: newLabelMap, floatingLabels: newFloatingLabels, version: data.version }).catch(() => {});
            console.log(`🔌 [SSE] Refetched ${Object.keys(newLabelMap).length} labels`);
          }
        }
      } catch (fetchError) {
        console.warn('Failed to refetch labels after SSE:', fetchError);
      }
    }
  }, []);

  useSSE({
    onLabels: handleSSELabels,
    onConnected: (data) => console.log('🔌 [SSE] Connected:', data),
    onError: (error) => console.warn('🔌 [SSE] Error:', error),
  });

  // ============================================
  // Fetch base nodes
  // ============================================

  const fetchBaseNodes = useCallback(async () => {
    if (baseNodesPromiseRef.current) return baseNodesPromiseRef.current;
    if (globalPublicState.baseNodesLoaded) return;

    setIsBaseNodesLoading(true);
    
    baseNodesPromiseRef.current = (async () => {
      try {
        const cached = await legacyIDB.load<CachedGraphNode[]>(CACHE_KEYS.BASE_NODES);
        if (cached && legacyIDB.isCacheValid(cached.timestamp)) {
          const loadedNodes = cached.data.map(cachedNodeToGraphNode);
          globalPublicState.baseNodes = loadedNodes;
          globalPublicState.baseNodesLoaded = true;
          setBaseNodesState(loadedNodes);
          setIsBaseNodesLoaded(true);
          return;
        }

        const INITIAL_NODES_LIMIT = tileConfig.INITIAL_NODES;
        console.log(`📊 [PublicGraph] Loading initial ${INITIAL_NODES_LIMIT} nodes...`);
        
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
        const degreeBasedNodes: number[] = [];
        
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
        
        if (degreeBasedNodes.length > 0) {
          const minDegree = Math.min(...degreeBasedNodes);
          setBaseNodesMinDegree(minDegree);
          console.log(`📊 [PublicGraph] Loaded ${consentNodesCount} consent + ${degreeBasedNodes.length} by degree, minDegree=${minDegree.toFixed(4)}`);
        } else {
          const minDegree = Math.min(...loadedNodes.map(n => n.degree));
          setBaseNodesMinDegree(minDegree);
        }
        
        if (loadedNodes.length > 0) {
          const bounds = calculateBounds(loadedNodes);
          globalPublicState.normalizationBounds = bounds;
          setNormalizationBoundsState(bounds);
          legacyIDB.save(CACHE_KEYS.NORMALIZATION_BOUNDS, bounds).catch(console.warn);
        }
        
        legacyIDB.save(CACHE_KEYS.BASE_NODES, cachedNodes).catch(console.warn);
        
      } catch (error) {
        console.error('❌ [PublicGraph] Error fetching base nodes:', error);
      } finally {
        setIsBaseNodesLoading(false);
        baseNodesPromiseRef.current = null;
      }
    })();

    return baseNodesPromiseRef.current;
  }, [calculateBounds, cachedNodeToGraphNode, tileConfig.INITIAL_NODES]);

  // ============================================
  // Fetch labels
  // ============================================

  const fetchLabels = useCallback(async () => {
    if (labelsPromiseRef.current) return labelsPromiseRef.current;
    if (globalPublicState.labelsLoaded) return;

    setIsLabelsLoading(true);
    
    labelsPromiseRef.current = (async () => {
      try {
        const cached = await legacyIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[] }>(CACHE_KEYS.FLOATING_LABELS);
        if (cached && legacyIDB.isCacheValid(cached.timestamp)) {
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
          
          const currentVersion = labelsVersionRef.current || Date.now();
          legacyIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: newLabelMap, floatingLabels: newFloatingLabels, version: currentVersion }).catch(console.warn);
        }
      } catch (error) {
        console.error('❌ [PublicGraph] Error fetching labels:', error);
      } finally {
        setIsLabelsLoading(false);
        labelsPromiseRef.current = null;
      }
    })();

    return labelsPromiseRef.current;
  }, []);

  // ============================================
  // Progressive tile loading - CACHE-FIRST (like GraphDataContext.tsx but with cache)
  // ============================================

  const fetchDetailNodes = useCallback(async (bbox?: BoundingBox, batchMultiplier: number = 1) => {
    // Use currentMinDegreeRef if set, otherwise use baseNodesMinDegree
    const degreeThreshold = currentMinDegreeRef.current > 0 ? currentMinDegreeRef.current : baseNodesMinDegree;
    
    if (degreeThreshold <= 0) {
      return;
    }

    // Simple: skip if already loading (no queue)
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

    // Calculate actual batch size
    const maxDetailBudget = Math.max(0, tileConfig.MAX_MEMORY_NODES - tileConfig.INITIAL_NODES);
    const remainingBudget = Math.max(0, tileConfig.MAX_MEMORY_NODES - currentTotal);
    const actualBatchSize = Math.min(
      tileConfig.NODES_PER_TILE * batchMultiplier,
      maxDetailBudget,
      remainingBudget
    );

    tilePromiseRef.current = (async () => {
      try {
        const baseIds = new Set(baseNodes.map(n => n.id));
        const displayedIds = new Set(tileNodes.map(n => n.id));
        const cacheMap = allCachedTileNodesRef.current;
        
        // ========================================
        // STEP 1: Check cache for matching nodes
        // ========================================
        const fromCache: GraphNode[] = [];
        
        if (cacheMap.size > 0) {
          for (const node of cacheMap.values()) {
            // Skip if already displayed or in base
            if (displayedIds.has(node.id) || baseIds.has(node.id)) continue;
            
            // Only nodes below current threshold (progressive loading)
            if (node.degree >= degreeThreshold) continue;
            
            // Check bbox if provided
            if (bbox) {
              if (node.x < bbox.minX || node.x > bbox.maxX || node.y < bbox.minY || node.y > bbox.maxY) continue;
            }
            
            fromCache.push(node);
            if (fromCache.length >= actualBatchSize) break;
          }
          
          // Sort by degree DESC (highest first)
          fromCache.sort((a, b) => b.degree - a.degree);
        }
        
        const needFromServer = actualBatchSize - fromCache.length;
        const bboxInfo = bbox ? ` bbox=[${bbox.minX.toFixed(1)},${bbox.maxX.toFixed(1)}]x[${bbox.minY.toFixed(1)},${bbox.maxY.toFixed(1)}]` : '';
        
        if (fromCache.length > 0) {
          console.log(`📦 [Tiles] Cache hit: ${fromCache.length} nodes, need ${needFromServer} from server${bboxInfo}`);
        }
        
        // ========================================
        // STEP 2: Fetch from server if needed
        // ========================================
        let loadedFromServer: GraphNode[] = [];
        
        if (needFromServer > 0) {
          // Find the minimum degree in cache to use as server threshold
          // This ensures we don't re-fetch nodes we already have
          const serverThreshold = fromCache.length > 0 
            ? Math.min(...fromCache.map(n => n.degree))
            : degreeThreshold;
          
          const spatialFilter = bbox ? `
              AND g.x BETWEEN ${bbox.minX} AND ${bbox.maxX}
              AND g.y BETWEEN ${bbox.minY} AND ${bbox.maxY}` : '';
          
          const sql = `
            SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type
            FROM postgres_db.public.graph_nodes_03_11_25 g
            WHERE g.community != 8
              AND g.degree < ${serverThreshold}${spatialFilter}
            ORDER BY g.degree DESC
            LIMIT ${needFromServer}
          `;
          
          console.log(`📦 [Tiles] Fetching ${needFromServer} nodes with degree < ${serverThreshold.toFixed(4)}${bboxInfo}`);

          const response = await fetch('/api/mosaic/sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, type: 'arrow' }),
          });

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const arrowTable = tableFromIPC(buffer);
            loadedFromServer = parseArrowToNodes(arrowTable);
            
            // Add new nodes to cache
            if (loadedFromServer.length > 0) {
              const newForCache: CachedGraphNode[] = [];
              for (const node of loadedFromServer) {
                if (!cacheMap.has(node.id)) {
                  cacheMap.set(node.id, node);
                  newForCache.push(graphNodeToCached(node));
                }
              }
              if (newForCache.length > 0) {
                tileNodeIDB.addNodes(newForCache).catch(console.warn);
                console.log(`📦 [Tiles] Added ${newForCache.length} to cache (total: ${cacheMap.size})`);
              }
            }
          } else {
            console.warn('⚠️ [Tiles] Fetch failed:', response.statusText);
          }
        }

        // ========================================
        // STEP 3: Combine and update display
        // ========================================
        const allNewNodes = [...fromCache, ...loadedFromServer];
        
        if (allNewNodes.length === 0) {
          console.log(`📦 [Tiles] No more nodes to load`);
          return;
        }

        // Update threshold based on ALL nodes (cache + server)
        const minDegreeInBatch = Math.min(...allNewNodes.map(n => n.degree));
        currentMinDegreeRef.current = minDegreeInBatch;
        console.log(`📦 [Tiles] Next batch will load degree < ${minDegreeInBatch.toFixed(4)}`);

        setTileNodes(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newNodes = allNewNodes.filter(n => !existingIds.has(n.id));
          
          const totalNodes = prev.length + newNodes.length;
          const maxTileNodes = tileConfig.MAX_MEMORY_NODES - baseNodes.length;
          
          if (totalNodes > maxTileNodes) {
            const combined = [...prev, ...newNodes];
            console.log(`📦 [Tiles] Display: ${prev.length} + ${newNodes.length} → trimmed to ${maxTileNodes}`);
            return combined.slice(-maxTileNodes);
          }
          
          console.log(`📦 [Tiles] Display: ${prev.length} + ${newNodes.length} = ${totalNodes} (${fromCache.length} cache, ${loadedFromServer.length} server)`);
          return [...prev, ...newNodes];
        });

      } catch (error) {
        console.error('❌ [Tiles] Error fetching tile:', error);
      } finally {
        setIsTileLoading(false);
        tilePromiseRef.current = null;
      }
    })();

    return tilePromiseRef.current;
  }, [parseArrowToNodes, graphNodeToCached, baseNodes, tileNodes, baseNodesMinDegree, tileConfig.NODES_PER_TILE, tileConfig.MAX_MEMORY_NODES, tileConfig.INITIAL_NODES]);

  // Keep ref updated to the latest fetchDetailNodes to avoid stale closures in debounce
  fetchDetailNodesRef.current = fetchDetailNodes;

  // ============================================
  // Viewport change handler
  // ============================================

  const hasMovedSignificantly = useCallback((oldBbox: BoundingBox | null, newBbox: BoundingBox): boolean => {
    if (!oldBbox) return true;
    const oldCenterX = (oldBbox.minX + oldBbox.maxX) / 2;
    const oldCenterY = (oldBbox.minY + oldBbox.maxY) / 2;
    const newCenterX = (newBbox.minX + newBbox.maxX) / 2;
    const newCenterY = (newBbox.minY + newBbox.maxY) / 2;
    const oldWidth = oldBbox.maxX - oldBbox.minX;
    const oldHeight = oldBbox.maxY - oldBbox.minY;
    const threshold = Math.max(oldWidth, oldHeight) * 0.3;
    const distance = Math.sqrt((newCenterX - oldCenterX) ** 2 + (newCenterY - oldCenterY) ** 2);
    return distance > threshold;
  }, []);

  const onViewportChange = useCallback((boundingBox: BoundingBox, zoomLevel: number) => {
    const prevZoom = prevZoomRef.current;
    const prevBbox = currentBboxRef.current;
    const isFirstViewportChange = prevBbox === null;
    
    prevZoomRef.current = zoomLevel;
    currentBboxRef.current = boundingBox;
    setCurrentZoom(zoomLevel);
    
    const isPanning = !isFirstViewportChange && hasMovedSignificantly(prevBbox, boundingBox) && Math.abs(zoomLevel - prevZoom) < prevZoom * 0.1;
    
    const zoomRatio = prevZoom > 0 ? zoomLevel / prevZoom : 1;
    const isZoomingIn = zoomRatio > 1.1;
    const batchCount = isZoomingIn ? Math.min(5, Math.max(1, Math.floor(Math.log2(zoomRatio) * 2) + 1)) : 1;
    
    // Below threshold: unload detail nodes and reset threshold
    if (zoomLevel < tileConfig.ZOOM_THRESHOLD) {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
      viewportDebounceRef.current = setTimeout(() => {
        setTileNodes(prev => {
          if (prev.length > 0) {
            console.log(`📦 [Tiles] Unloading ${prev.length} detail nodes (zoom out below threshold)`);
            currentMinDegreeRef.current = 0; // Reset so next zoom in starts fresh
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
          currentMinDegreeRef.current = 0; // Reset threshold for new area
          return [];
        }
        return prev;
      });
    }

    // Zoom in or pan: load detail nodes
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
    }
    viewportDebounceRef.current = setTimeout(async () => {
      if (batchCount > 1) {
        console.log(`🚀 [Tiles] Aggressive zoom (${zoomRatio.toFixed(2)}x) - ${batchCount}x batch`);
      }
      await fetchDetailNodesRef.current?.(boundingBox, batchCount);
    }, tileConfig.DEBOUNCE_MS);
  }, [tileConfig.ZOOM_THRESHOLD, tileConfig.DEBOUNCE_MS, hasMovedSignificantly]);

  // ============================================
  // Clear cache (explicit user action)
  // ============================================

  const clearTileCache = useCallback(() => {
    setTileNodes([]);
    currentMinDegreeRef.current = 0;
    allCachedTileNodesRef.current = new Map();
    tileNodeIDB.clearNodes().catch(console.warn);
    console.log('🗑️ [Tiles] Cache cleared');
  }, []);

  // ============================================
  // Merged nodes
  // ============================================

  const mergedNodes = useMemo(() => {
    if (tileNodes.length === 0) {
      return baseNodes;
    }

    const baseNodeIds = new Set(baseNodes.map(n => n.id));
    const uniqueTileNodes = tileNodes.filter(n => !baseNodeIds.has(n.id));
    const merged = [...baseNodes, ...uniqueTileNodes];
    
    console.log(`📊 [PublicGraph] mergedNodes: ${merged.length} (base: ${baseNodes.length}, tiles: ${uniqueTileNodes.length})`);
    return merged;
  }, [baseNodes, tileNodes]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
    };
  }, []);

  // ============================================
  // Context value
  // ============================================

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

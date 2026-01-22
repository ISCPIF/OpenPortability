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
  const [tileNodes, setTileNodes] = useState<GraphNode[]>([]);
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [baseNodesMinDegree, setBaseNodesMinDegree] = useState<number>(0); // Min degree of baseNodes, tiles load nodes below this
  const tilePromiseRef = useRef<Promise<void> | null>(null);
  const viewportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchDetailNodesRef = useRef<((bbox?: BoundingBox) => Promise<void>) | null>(null);
  const tileConfig = DEFAULT_TILE_CONFIG;

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
        const INITIAL_NODES_LIMIT = tileConfig.INITIAL_NODES; // 100,000
        console.log(`📊 [PublicGraphData] Loading initial ${INITIAL_NODES_LIMIT} nodes (top by degree)...`);
        const sql = `SELECT label, x, y, community, degree, tier, node_type FROM postgres_db.public.graph_nodes_03_11_25 WHERE community != 8 ORDER BY degree DESC LIMIT ${INITIAL_NODES_LIMIT}`;
        
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
          const graphLabel = labelCol?.get(i) ? String(labelCol.get(i)) : undefined;
          
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
        
        // Calculate min degree of baseNodes for tile filtering
        // Tiles will load nodes with degree < this value to avoid duplicates
        if (loadedNodes.length > 0) {
          const minDegree = Math.min(...loadedNodes.map(n => n.degree));
          setBaseNodesMinDegree(minDegree);
          console.log(`📊 [PublicGraphData] Base nodes min degree: ${minDegree.toFixed(4)} - tiles will load nodes below this`);
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
  
  // Fetch additional nodes progressively - each call loads the next batch by degree
  // This allows loading 100k initial → +50k → +50k → etc as user zooms
  // If bbox is provided, also filter by spatial location for pan support
  const fetchDetailNodes = useCallback(async (bbox?: BoundingBox) => {
    // Use currentMinDegree if set, otherwise use baseNodesMinDegree
    const degreeThreshold = currentMinDegree > 0 ? currentMinDegree : baseNodesMinDegree;
    
    if (degreeThreshold <= 0) {
      console.log(`📦 [Public Tiles] Skipping: no degree threshold set yet`);
      return;
    }

    if (tilePromiseRef.current) {
      console.log(`📦 [Public Tiles] Skipping: already loading`);
      return tilePromiseRef.current;
    }

    // Check if we've reached the limit
    const currentTotal = baseNodes.length + tileNodes.length;
    if (currentTotal >= tileConfig.MAX_MEMORY_NODES) {
      console.log(`📦 [Public Tiles] Skipping: reached max nodes (${currentTotal}/${tileConfig.MAX_MEMORY_NODES})`);
      return;
    }

    setIsTileLoading(true);

    tilePromiseRef.current = (async () => {
      try {
        // Build SQL with optional spatial filter
        // Note: bbox is in original coordinates (0-1 range for this dataset)
        const spatialFilter = bbox ? `
            AND g.x BETWEEN ${bbox.minX} AND ${bbox.maxX}
            AND g.y BETWEEN ${bbox.minY} AND ${bbox.maxY}` : '';
        
        const sql = `
          SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type
          FROM postgres_db.public.graph_nodes_03_11_25 g
          WHERE g.community != 8
            AND g.degree < ${degreeThreshold}${spatialFilter}
          ORDER BY g.degree DESC
          LIMIT ${tileConfig.NODES_PER_TILE}
        `;
        
        const bboxInfo = bbox ? ` in bbox [${bbox.minX.toFixed(2)},${bbox.maxX.toFixed(2)}]x[${bbox.minY.toFixed(2)},${bbox.maxY.toFixed(2)}]` : '';
        console.log(`📦 [Public Tiles] Fetching ${tileConfig.NODES_PER_TILE} nodes with degree < ${degreeThreshold.toFixed(4)}${bboxInfo}`);

        const response = await fetch('/api/mosaic/sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, type: 'arrow' }),
        });

        if (!response.ok) {
          console.warn('⚠️ [Public Tiles] Failed to fetch tile:', response.statusText);
          return;
        }

        const buffer = await response.arrayBuffer();
        const arrowTable = tableFromIPC(buffer);
        const loadedNodes = parseArrowToNodes(arrowTable);

        if (loadedNodes.length === 0) {
          console.log(`📦 [Public Tiles] No more nodes to load (all nodes loaded)`);
          return;
        }

        // Update currentMinDegree to the minimum degree of loaded nodes
        // This allows the next batch to load nodes with even lower degree
        const minDegreeInBatch = Math.min(...loadedNodes.map(n => n.degree));
        setCurrentMinDegree(minDegreeInBatch);
        console.log(`📦 [Public Tiles] Next batch will load degree < ${minDegreeInBatch.toFixed(4)}`);

        setTileNodes(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newNodes = loadedNodes.filter(n => !existingIds.has(n.id));
          
          const totalNodes = prev.length + newNodes.length;
          if (totalNodes > tileConfig.MAX_MEMORY_NODES - baseNodes.length) {
            const maxTileNodes = tileConfig.MAX_MEMORY_NODES - baseNodes.length;
            const combined = [...prev, ...newNodes];
            console.log(`📦 [Public Tiles] setTileNodes: prev=${prev.length}, new=${newNodes.length}, trimmed to ${maxTileNodes}`);
            return combined.slice(-maxTileNodes);
          }
          
          console.log(`📦 [Public Tiles] setTileNodes: prev=${prev.length}, new=${newNodes.length}, total=${prev.length + newNodes.length}`);
          return [...prev, ...newNodes];
        });

        console.log(`📦 [Public Tiles] Loaded ${loadedNodes.length} nodes (degree range: ${minDegreeInBatch.toFixed(4)} - ${degreeThreshold.toFixed(4)})`);

      } catch (error) {
        console.error('❌ [Public Tiles] Error fetching tile:', error);
      } finally {
        setIsTileLoading(false);
        tilePromiseRef.current = null;
      }
    })();

    return tilePromiseRef.current;
  }, [parseArrowToNodes, baseNodes.length, tileNodes.length, baseNodesMinDegree, currentMinDegree, tileConfig.NODES_PER_TILE, tileConfig.MAX_MEMORY_NODES]);

  // Keep ref updated to the latest fetchDetailNodes to avoid stale closures in debounce
  fetchDetailNodesRef.current = fetchDetailNodes;
  
  // Unload detail nodes when zooming out significantly
  const unloadDetailNodes = useCallback(() => {
    if (tileNodes.length > 0) {
      console.log(`📦 [Public Tiles] Unloading ${tileNodes.length} detail nodes (zoom out)`);
      setTileNodes([]);
      setCurrentMinDegree(0); // Reset so next zoom-in starts fresh
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
  const onViewportChange = useCallback((boundingBox: BoundingBox, zoomLevel: number) => {
    const prevZoom = prevZoomRef.current;
    const prevBbox = currentBboxRef.current;
    prevZoomRef.current = zoomLevel;
    currentBboxRef.current = boundingBox;
    setCurrentZoom(zoomLevel);
    
    // Detect zoom direction and pan
    const isPanning = hasMovedSignificantly(prevBbox, boundingBox) && Math.abs(zoomLevel - prevZoom) < prevZoom * 0.1;
    
    // Below threshold: unload detail nodes and don't load new ones
    if (zoomLevel < tileConfig.ZOOM_THRESHOLD) {
      // Unload detail nodes when zooming out to overview
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
      viewportDebounceRef.current = setTimeout(() => {
        // Check inside timeout to get latest state
        setTileNodes(prev => {
          if (prev.length > 0) {
            console.log(`📦 [Public Tiles] Unloading ${prev.length} detail nodes (zoom out below threshold)`);
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
          console.log(`📦 [Public Tiles] Pan detected - clearing ${prev.length} old nodes`);
          setCurrentMinDegree(0);
          return [];
        }
        return prev;
      });
    }

    // ZOOM IN or PAN: Load more detail nodes
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
    }
    viewportDebounceRef.current = setTimeout(() => {
      // Pass bbox for spatial filtering when panning
      fetchDetailNodesRef.current?.(boundingBox);
    }, tileConfig.DEBOUNCE_MS);
  }, [tileConfig.ZOOM_THRESHOLD, tileConfig.DEBOUNCE_MS, hasMovedSignificantly]);

  // Clear tile cache
  const clearTileCache = useCallback(() => {
    publicTileCache.clear();
    setTileNodes([]);
    console.log('🗑️ [Public Tiles] Cache cleared');
  }, []);

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

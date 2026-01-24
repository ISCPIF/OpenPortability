'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { GraphNode, BoundingBox } from '@/lib/types/graph';
import { tableFromIPC } from 'apache-arrow';
import { useSSE, SSELabelsData } from '@/hooks/useSSE';

// ============================================
// Types and Interfaces
// ============================================

type TileKey = string;

interface ZoomLevel {
  minScale: number;
  maxScale: number;
  minDegree: number;
  maxNodesPerViewport: number;
  gridSize: number;
}

interface Tile {
  key: TileKey;
  nodes: GraphNode[];
  bounds: BoundingBox;
  zoomLevelIndex: number;
  timestamp: number;
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

// ============================================
// Configuration
// ============================================

const ZOOM_LEVELS: ZoomLevel[] = [
  { minScale: 0, maxScale: 0.05, minDegree: 4, maxNodesPerViewport: 0, gridSize: 1.0 },
  { minScale: 0.05, maxScale: 0.15, minDegree: 3, maxNodesPerViewport: 20_000, gridSize: 0.5 },
  { minScale: 0.15, maxScale: 0.5, minDegree: 2, maxNodesPerViewport: 50_000, gridSize: 0.25 },
  { minScale: 0.5, maxScale: 2, minDegree: 1.5, maxNodesPerViewport: 100_000, gridSize: 0.1 },
  { minScale: 2, maxScale: Infinity, minDegree: 0, maxNodesPerViewport: 150_000, gridSize: 0.05 },
];

const CONFIG = {
  INITIAL_NODES: 100_000,
  MAX_MEMORY_NODES: 600_000,
  TILE_CACHE_SIZE: 50,
  DEBOUNCE_MS: 200,
  PREFETCH_MARGIN: 1,
};

const INITIAL_DEGREE_CEILING_EPSILON = 1e-9;

// Degree band width under the initial cutoff (minDegree of the initial 100k).
// As zoom increases, we widen the band => we load progressively lower-degree nodes.
// Note: degrees in this dataset are mostly in [0, 6].
const DETAIL_DEGREE_BAND_WIDTH_BY_ZOOM_INDEX: number[] = [
  0.00, // z0: no details
  0.50, // z1
  1.00, // z2
  2.50, // z3
  10.0, // z4+: effectively down to 0 for typical ceilings
];

// ============================================
// IndexedDB for initial nodes only
// ============================================

const IDB_NAME = 'hqx_public_graph_v3';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'graph_data';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_KEYS = {
  INITIAL_NODES: 'initial_nodes_v3',
  DETAIL_DEGREE_CEILING: 'detail_degree_ceiling_v3',
  NORMALIZATION_BOUNDS: 'normalization_bounds_v3',
  FLOATING_LABELS: 'floating_labels_v3',
};

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
        console.error('💾 [IDB-V3] Failed to open database:', request.error);
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

      const record = { key, data, timestamp: Date.now() };

      return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`💾 [IDB-V3] Failed to save ${key}:`, err);
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
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn(`💾 [IDB-V3] Failed to load ${key}:`, err);
      return null;
    }
  }

  isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_TTL_MS;
  }
}

const graphIDB = new GraphIndexedDB();

// ============================================
// Tile Manager (LRU Cache)
// ============================================

class TileManager {
  private cache: Map<TileKey, Tile> = new Map();
  private maxSize: number;

  constructor(maxSize: number = CONFIG.TILE_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: TileKey): Tile | null {
    const tile = this.cache.get(key);
    if (tile) {
      this.cache.delete(key);
      this.cache.set(key, tile);
    }
    return tile || null;
  }

  set(key: TileKey, tile: Tile): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, tile);
  }

  has(key: TileKey): boolean {
    return this.cache.has(key);
  }

  getNodesForTiles(keys: TileKey[]): GraphNode[] {
    const nodes: GraphNode[] = [];
    const seenIds = new Set<string>();

    for (const key of keys) {
      const tile = this.get(key);
      if (tile) {
        for (const node of tile.nodes) {
          if (!seenIds.has(node.id)) {
            seenIds.add(node.id);
            nodes.push(node);
          }
        }
      }
    }

    return nodes;
  }

  getMissingTiles(keys: TileKey[]): TileKey[] {
    return keys.filter(key => !this.cache.has(key));
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================
// Utility Functions
// ============================================

function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

function extractDetailDegreeCeilingFromArrow(buffer: ArrayBuffer): number | null {
  try {
    const arrowTable = tableFromIPC(buffer);
    const cutoffCol = arrowTable.getChild('detail_degree_ceiling');
    if (!cutoffCol || arrowTable.numRows <= 0) return null;
    const v = Number(cutoffCol.get(0));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function getZoomLevelIndex(scale: number): number {
  for (let i = 0; i < ZOOM_LEVELS.length; i++) {
    if (scale >= ZOOM_LEVELS[i].minScale && scale < ZOOM_LEVELS[i].maxScale) {
      return i;
    }
  }
  return ZOOM_LEVELS.length - 1;
}

function getZoomLevel(scale: number): ZoomLevel {
  return ZOOM_LEVELS[getZoomLevelIndex(scale)];
}

function getTileKey(zoomLevelIndex: number, gx: number, gy: number): TileKey {
  return `${zoomLevelIndex}_${gx}_${gy}`;
}

function getVisibleTileKeys(
  viewport: BoundingBox,
  zoomLevelIndex: number,
  gridSize: number,
  prefetchMargin: number = 1
): { visible: TileKey[]; prefetch: TileKey[] } {
  const gridCount = Math.max(1, Math.ceil(1 / gridSize));

  // Visible tile indices (half-open intervals):
  // - min uses floor
  // - max uses ceil-1 so that maxX/maxY == 1 maps to the last valid tile
  const visibleMinGxRaw = Math.floor(viewport.minX / gridSize);
  const visibleMaxGxRaw = Math.ceil(viewport.maxX / gridSize) - 1;
  const visibleMinGyRaw = Math.floor(viewport.minY / gridSize);
  const visibleMaxGyRaw = Math.ceil(viewport.maxY / gridSize) - 1;

  const visibleMinGx = Math.max(0, Math.min(gridCount - 1, visibleMinGxRaw));
  const visibleMaxGx = Math.max(0, Math.min(gridCount - 1, visibleMaxGxRaw));
  const visibleMinGy = Math.max(0, Math.min(gridCount - 1, visibleMinGyRaw));
  const visibleMaxGy = Math.max(0, Math.min(gridCount - 1, visibleMaxGyRaw));

  const minGx = Math.max(0, Math.min(gridCount - 1, visibleMinGx - prefetchMargin));
  const maxGx = Math.max(0, Math.min(gridCount - 1, visibleMaxGx + prefetchMargin));
  const minGy = Math.max(0, Math.min(gridCount - 1, visibleMinGy - prefetchMargin));
  const maxGy = Math.max(0, Math.min(gridCount - 1, visibleMaxGy + prefetchMargin));

  const visible: TileKey[] = [];
  const prefetch: TileKey[] = [];

  for (let gx = minGx; gx <= maxGx; gx++) {
    for (let gy = minGy; gy <= maxGy; gy++) {
      const key = getTileKey(zoomLevelIndex, gx, gy);
      const isVisible = (
        gx >= visibleMinGx &&
        gx <= visibleMaxGx &&
        gy >= visibleMinGy &&
        gy <= visibleMaxGy
      );

      if (isVisible) {
        visible.push(key);
      } else {
        prefetch.push(key);
      }
    }
  }

  return { visible, prefetch };
}

// ============================================
// Global State (singleton)
// ============================================

interface GlobalState {
  initialNodes: GraphNode[];
  initialNodesLoaded: boolean;
  detailDegreeCeiling: number | null;
  normalizationBounds: NormalizationBounds | null;
  labelMap: Record<string, string>;
  floatingLabels: FloatingLabel[];
  labelsLoaded: boolean;
}

const globalState: GlobalState = {
  initialNodes: [],
  initialNodesLoaded: false,
  detailDegreeCeiling: null,
  normalizationBounds: null,
  labelMap: {},
  floatingLabels: [],
  labelsLoaded: false,
};

// ============================================
// Context Value Interface
// ============================================

interface PublicGraphDataContextV3Value {
  initialNodes: GraphNode[];
  tileNodes: GraphNode[];
  mergedNodes: GraphNode[];
  
  isInitialLoading: boolean;
  isInitialLoaded: boolean;
  isTileLoading: boolean;
  
  currentScale: number;
  currentZoomLevel: ZoomLevel;
  
  normalizationBounds: NormalizationBounds | null;
  labelMap: Record<string, string>;
  floatingLabels: FloatingLabel[];
  isLabelsLoaded: boolean;
  isLabelsLoading: boolean;
  
  fetchInitialNodes: () => Promise<void>;
  fetchLabels: () => Promise<void>;
  onViewportChange: (bbox: BoundingBox, scale: number) => void;
  clearTileCache: () => void;
}

const PublicGraphDataContextV3 = createContext<PublicGraphDataContextV3Value | null>(null);

export function usePublicGraphDataV3() {
  const context = useContext(PublicGraphDataContextV3);
  if (!context) {
    throw new Error('usePublicGraphDataV3 must be used within a PublicGraphDataProviderV3');
  }
  return context;
}

export function usePublicGraphDataV3Optional() {
  return useContext(PublicGraphDataContextV3);
}

// ============================================
// Provider Component
// ============================================

interface PublicGraphDataProviderV3Props {
  children: ReactNode;
}

export function PublicGraphDataProviderV3({ children }: PublicGraphDataProviderV3Props) {
  // State
  const [initialNodes, setInitialNodes] = useState<GraphNode[]>(globalState.initialNodes);
  const [isInitialLoaded, setIsInitialLoaded] = useState(globalState.initialNodesLoaded);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  
  const [tileNodes, setTileNodes] = useState<GraphNode[]>([]);
  const [isTileLoading, setIsTileLoading] = useState(false);

  const tileNodeMapRef = useRef<Map<string, GraphNode>>(new Map());

  const [detailDegreeCeiling, setDetailDegreeCeiling] = useState<number | null>(null);
  
  const [currentScale, setCurrentScale] = useState(0.025);
  const [normalizationBounds, setNormalizationBounds] = useState<NormalizationBounds | null>(globalState.normalizationBounds);
  
  const [labelMap, setLabelMap] = useState<Record<string, string>>(globalState.labelMap);
  const [floatingLabels, setFloatingLabels] = useState<FloatingLabel[]>(globalState.floatingLabels);
  const [isLabelsLoaded, setIsLabelsLoaded] = useState(globalState.labelsLoaded);
  const [isLabelsLoading, setIsLabelsLoading] = useState(false);
  
  // Refs
  const tileManagerRef = useRef<TileManager>(new TileManager());
  const initialNodesPromiseRef = useRef<Promise<void> | null>(null);
  const detailDegreeCeilingPromiseRef = useRef<Promise<void> | null>(null);
  const labelsPromiseRef = useRef<Promise<void> | null>(null);
  const viewportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const currentViewportRef = useRef<BoundingBox | null>(null);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const labelsVersionRef = useRef<number>(0);

  const detailDegreeCeilingRef = useRef<number | null>(null);
  const prevZoomLevelIndexRef = useRef<number>(-1);
  const prevBboxRef = useRef<BoundingBox | null>(null);

  // Computed
  const currentZoomLevel = useMemo(() => getZoomLevel(currentScale), [currentScale]);

  // Calculate bounds from nodes
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

  const computeMinDegree = useCallback((nodes: GraphNode[]): number => {
    if (nodes.length === 0) return 0;
    let min = Infinity;
    for (const n of nodes) {
      if (typeof n.degree === 'number' && Number.isFinite(n.degree)) {
        min = Math.min(min, n.degree);
      }
    }
    return min === Infinity ? 0 : min;
  }, []);

  // Parse Arrow table to nodes
  const parseArrowToNodes = useCallback((buffer: ArrayBuffer): { nodes: GraphNode[]; cached: CachedGraphNode[] } => {
    const arrowTable = tableFromIPC(buffer);
    const nodes: GraphNode[] = [];
    const cached: CachedGraphNode[] = [];

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

      nodes.push({
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

      cached.push({
        coord_hash: hash,
        label: label || hash,
        x,
        y,
        community,
        degree,
        tier,
        nodeType,
      });
    }

    return { nodes, cached };
  }, []);

  // Load cached data on mount
  useEffect(() => {
    const loadCachedData = async () => {
      if (globalState.detailDegreeCeiling == null) {
        try {
          const cachedCeiling = await graphIDB.load<number>(CACHE_KEYS.DETAIL_DEGREE_CEILING);
          if (cachedCeiling && graphIDB.isCacheValid(cachedCeiling.timestamp)) {
            globalState.detailDegreeCeiling = cachedCeiling.data;
            detailDegreeCeilingRef.current = cachedCeiling.data;
            setDetailDegreeCeiling(cachedCeiling.data);
          }
        } catch (err) {
          console.warn('💾 [IDB-V3] Failed to load detail degree ceiling:', err);
        }
      }

      // Load normalization bounds
      if (!globalState.normalizationBounds) {
        try {
          const cachedBounds = await graphIDB.load<NormalizationBounds>(CACHE_KEYS.NORMALIZATION_BOUNDS);
          if (cachedBounds && graphIDB.isCacheValid(cachedBounds.timestamp)) {
            globalState.normalizationBounds = cachedBounds.data;
            setNormalizationBounds(cachedBounds.data);
          }
        } catch (err) {
          console.warn('💾 [IDB-V3] Failed to load bounds:', err);
        }
      }

      // Load initial nodes
      if (!globalState.initialNodesLoaded) {
        try {
          const cached = await graphIDB.load<CachedGraphNode[]>(CACHE_KEYS.INITIAL_NODES);
          if (cached && graphIDB.isCacheValid(cached.timestamp)) {
            const loadedNodes: GraphNode[] = cached.data.map(node => ({
              id: node.coord_hash,
              label: node.label,
              x: node.x,
              y: node.y,
              community: node.community,
              degree: node.degree,
              tier: node.tier as GraphNode['tier'],
              nodeType: node.nodeType as GraphNode['nodeType'],
              size: 1,
              color: '#ffffff',
            }));

            globalState.initialNodes = loadedNodes;
            globalState.initialNodesLoaded = true;
            setInitialNodes(loadedNodes);
            setIsInitialLoaded(true);

            if (globalState.detailDegreeCeiling != null) {
              detailDegreeCeilingRef.current = globalState.detailDegreeCeiling;
              setDetailDegreeCeiling(globalState.detailDegreeCeiling);
            }

            if (!globalState.normalizationBounds && loadedNodes.length > 0) {
              const bounds = calculateBounds(loadedNodes);
              globalState.normalizationBounds = bounds;
              setNormalizationBounds(bounds);
              graphIDB.save(CACHE_KEYS.NORMALIZATION_BOUNDS, bounds).catch(console.warn);
            }

            console.log(`💾 [IDB-V3] Loaded ${loadedNodes.length} initial nodes from cache`);
          }
        } catch (err) {
          console.warn('💾 [IDB-V3] Failed to load initial nodes:', err);
        }
      }

      // Load labels
      if (!globalState.labelsLoaded) {
        try {
          const cached = await graphIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[] }>(CACHE_KEYS.FLOATING_LABELS);
          if (cached && graphIDB.isCacheValid(cached.timestamp)) {
            globalState.labelMap = cached.data.labelMap;
            globalState.floatingLabels = cached.data.floatingLabels;
            globalState.labelsLoaded = true;
            setLabelMap(cached.data.labelMap);
            setFloatingLabels(cached.data.floatingLabels);
            setIsLabelsLoaded(true);
          }
        } catch (err) {
          console.warn('💾 [IDB-V3] Failed to load labels:', err);
        }
      }
    };

    loadCachedData();
  }, [calculateBounds]);

  // Fetch initial nodes (100k)
  const fetchInitialNodes = useCallback(async () => {
    if (initialNodesPromiseRef.current) return initialNodesPromiseRef.current;
    if (globalState.initialNodesLoaded) return;

    setIsInitialLoading(true);

    initialNodesPromiseRef.current = (async () => {
      try {
        const sql = `
          WITH degree_ceiling_all AS (
            SELECT MIN(degree) AS detail_degree_ceiling
            FROM (
              SELECT degree
              FROM postgres_db.public.graph_nodes_03_11_25
              WHERE community != 8
              ORDER BY degree DESC
              LIMIT ${CONFIG.INITIAL_NODES}
            ) t
          ),
          consent_nodes AS (
            SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
                   c.detail_degree_ceiling AS detail_degree_ceiling,
                   0 AS priority
            FROM postgres_db.public.graph_nodes_03_11_25 g
            INNER JOIN postgres_db.public.users_with_name_consent u ON g.id = u.twitter_id
            CROSS JOIN degree_ceiling_all c
            WHERE g.community != 8
          ),
          combined AS (
            SELECT * FROM consent_nodes
            UNION ALL
            SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
                   c.detail_degree_ceiling AS detail_degree_ceiling,
                   1 AS priority
            FROM postgres_db.public.graph_nodes_03_11_25 g
            CROSS JOIN degree_ceiling_all c
            WHERE g.community != 8
              AND NOT EXISTS (
                SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
              )
          )
          SELECT label, x, y, community, degree, tier, node_type, detail_degree_ceiling
          FROM combined
          ORDER BY priority ASC, degree DESC
          LIMIT ${CONFIG.INITIAL_NODES}
        `;

        console.log(`📊 [V3] Fetching ${CONFIG.INITIAL_NODES} initial nodes...`);
        const startTime = performance.now();

        const response = await fetch('/api/mosaic/sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, type: 'arrow' }),
        });

        if (!response.ok) throw new Error('Failed to fetch initial nodes');

        const buffer = await response.arrayBuffer();
        const { nodes, cached } = parseArrowToNodes(buffer);

        // The initial list is consent-first, so compute a detail ceiling based on the
        // non-consent portion actually selected (otherwise minDegree is polluted by low-degree consent nodes).
        const arrowDetailCeiling = extractDetailDegreeCeilingFromArrow(buffer);

        const loadTime = performance.now() - startTime;
        console.log(`📊 [V3] Loaded ${nodes.length} initial nodes in ${loadTime.toFixed(0)}ms`);

        globalState.initialNodes = nodes;
        globalState.initialNodesLoaded = true;
        setInitialNodes(nodes);
        setIsInitialLoaded(true);

        const fallbackMinDegree = computeMinDegree(nodes);
        const effectiveCeiling = arrowDetailCeiling ?? (fallbackMinDegree > 0 ? fallbackMinDegree : null);
        detailDegreeCeilingRef.current = effectiveCeiling;
        setDetailDegreeCeiling(effectiveCeiling);

        globalState.detailDegreeCeiling = effectiveCeiling;

        if (effectiveCeiling != null) {
          graphIDB.save(CACHE_KEYS.DETAIL_DEGREE_CEILING, effectiveCeiling).catch(console.warn);
        }

        if (effectiveCeiling != null) {
          console.log(`📊 [V3] Detail degree ceiling: ${effectiveCeiling.toFixed(4)}`);
        }

        // Calculate and cache bounds
        if (nodes.length > 0) {
          const bounds = calculateBounds(nodes);
          globalState.normalizationBounds = bounds;
          setNormalizationBounds(bounds);
          graphIDB.save(CACHE_KEYS.NORMALIZATION_BOUNDS, bounds).catch(console.warn);
        }

        // Save to IndexedDB
        graphIDB.save(CACHE_KEYS.INITIAL_NODES, cached).catch(console.warn);

      } catch (error) {
        console.error('❌ [V3] Error fetching initial nodes:', error);
      } finally {
        setIsInitialLoading(false);
        initialNodesPromiseRef.current = null;
      }
    })();

    return initialNodesPromiseRef.current;
  }, [calculateBounds, parseArrowToNodes]);

  const fetchDetailDegreeCeiling = useCallback(async () => {
    if (detailDegreeCeilingPromiseRef.current) return detailDegreeCeilingPromiseRef.current;
    if (globalState.detailDegreeCeiling != null) return;

    detailDegreeCeilingPromiseRef.current = (async () => {
      try {
        const sql = `
          SELECT MIN(degree) AS detail_degree_ceiling
          FROM (
            SELECT degree
            FROM postgres_db.public.graph_nodes_03_11_25
            WHERE community != 8
            ORDER BY degree DESC
            LIMIT ${CONFIG.INITIAL_NODES}
          ) t
        `;

        const response = await fetch('/api/mosaic/sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, type: 'arrow' }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch detail degree ceiling');
        }

        const buffer = await response.arrayBuffer();
        const ceiling = extractDetailDegreeCeilingFromArrow(buffer);
        if (ceiling != null) {
          globalState.detailDegreeCeiling = ceiling;
          detailDegreeCeilingRef.current = ceiling;
          setDetailDegreeCeiling(ceiling);
          graphIDB.save(CACHE_KEYS.DETAIL_DEGREE_CEILING, ceiling).catch(console.warn);
          console.log(`📊 [V3] Detail degree ceiling: ${ceiling.toFixed(4)}`);
        }
      } catch (err) {
        console.warn('❌ [V3] Failed to fetch detail degree ceiling:', err);
      } finally {
        detailDegreeCeilingPromiseRef.current = null;
      }
    })();

    return detailDegreeCeilingPromiseRef.current;
  }, []);

  useEffect(() => {
    if (globalState.initialNodesLoaded && globalState.detailDegreeCeiling == null) {
      fetchDetailDegreeCeiling();
    }
  }, [fetchDetailDegreeCeiling]);

  // Fetch labels
  const fetchLabels = useCallback(async () => {
    if (labelsPromiseRef.current) return labelsPromiseRef.current;
    if (globalState.labelsLoaded) return;

    setIsLabelsLoading(true);

    labelsPromiseRef.current = (async (): Promise<void> => {
      try {
        const response = await fetch('/api/graph/consent_labels', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch labels');

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

          globalState.labelMap = newLabelMap;
          globalState.floatingLabels = newFloatingLabels;
          globalState.labelsLoaded = true;
          setLabelMap(newLabelMap);
          setFloatingLabels(newFloatingLabels);
          setIsLabelsLoaded(true);

          graphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: newLabelMap, floatingLabels: newFloatingLabels }).catch(console.warn);
        }
      } catch (error) {
        console.error('❌ [V3] Error fetching labels:', error);
      } finally {
        setIsLabelsLoading(false);
        labelsPromiseRef.current = null;
      }
    })();

    return labelsPromiseRef.current;
  }, []);

  // SSE handler for labels
  const handleSSELabels = useCallback(async (data: SSELabelsData) => {
    if (data.invalidated) {
      globalState.labelsLoaded = false;
      globalState.labelMap = {};
      globalState.floatingLabels = [];
      labelsPromiseRef.current = null;
      setLabelMap({});
      setFloatingLabels([]);
      setIsLabelsLoaded(false);

      // Refetch
      try {
        const response = await fetch('/api/graph/consent_labels');
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

            globalState.labelMap = newLabelMap;
            globalState.floatingLabels = newFloatingLabels;
            globalState.labelsLoaded = true;
            setLabelMap(newLabelMap);
            setFloatingLabels(newFloatingLabels);
            setIsLabelsLoaded(true);

            graphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: newLabelMap, floatingLabels: newFloatingLabels, version: data.version }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Failed to refetch labels after SSE:', err);
      }
    }
  }, []);

  useSSE({
    onLabels: handleSSELabels,
    onConnected: (data) => console.log('🔌 [V3 SSE] Connected:', data),
    onError: (error) => console.warn('🔌 [V3 SSE] Error:', error),
  });

  // Fetch viewport nodes (tiles)
  const fetchViewportNodes = useCallback(async (
    viewport: BoundingBox,
    zoomLevel: ZoomLevel,
    zoomLevelIndex: number,
    tileKeys: TileKey[]
  ) => {
    // If a fetch is in progress, just return - the finally block will check for missing tiles
    if (fetchPromiseRef.current) {
      return;
    }
    if (zoomLevel.maxNodesPerViewport === 0) return;

    const degreeCeiling = detailDegreeCeilingRef.current;
    if (degreeCeiling == null || degreeCeiling <= 0) {
      // Initial nodes not loaded yet (or min degree unknown)
      return;
    }

    const bandWidth = DETAIL_DEGREE_BAND_WIDTH_BY_ZOOM_INDEX[Math.min(zoomLevelIndex, DETAIL_DEGREE_BAND_WIDTH_BY_ZOOM_INDEX.length - 1)] ?? 0.15;
    const degreeFloor = Math.max(0, degreeCeiling - bandWidth);
    if (!(degreeFloor < degreeCeiling)) {
      return;
    }

    const clampedViewport: BoundingBox = {
      minX: Math.max(0, Math.min(1, viewport.minX)),
      maxX: Math.max(0, Math.min(1, viewport.maxX)),
      minY: Math.max(0, Math.min(1, viewport.minY)),
      maxY: Math.max(0, Math.min(1, viewport.maxY)),
    };

    const { visible, prefetch } = getVisibleTileKeys(clampedViewport, zoomLevelIndex, zoomLevel.gridSize, CONFIG.PREFETCH_MARGIN);
    const effectiveTileKeys = tileKeys.length > 0 ? tileKeys : [...visible, ...prefetch];

    setIsTileLoading(true);
    fetchPromiseRef.current = (async () => {
      try {
        const tileManager = tileManagerRef.current;
        const missingTileKeys = tileManager.getMissingTiles(effectiveTileKeys);

        const MAX_TILES_PER_FETCH = 12;
        const prioritizedMissing = missingTileKeys.slice(0, MAX_TILES_PER_FETCH);
        if (prioritizedMissing.length === 0) {
          return;
        }

        const perTileLimit = Math.min(
          zoomLevel.maxNodesPerViewport,
          Math.max(2000, Math.ceil(zoomLevel.maxNodesPerViewport / MAX_TILES_PER_FETCH), 0)
        );

        let totalFetched = 0;
        let totalAdded = 0;
        const startTime = performance.now();

        for (const key of prioritizedMissing) {
          const parts = key.split('_');
          if (parts.length !== 3) continue;
          const gx = Number(parts[1]);
          const gy = Number(parts[2]);
          if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;

          const tileBounds: BoundingBox = {
            minX: Math.max(0, Math.min(1, gx * zoomLevel.gridSize)),
            maxX: Math.max(0, Math.min(1, (gx + 1) * zoomLevel.gridSize)),
            minY: Math.max(0, Math.min(1, gy * zoomLevel.gridSize)),
            maxY: Math.max(0, Math.min(1, (gy + 1) * zoomLevel.gridSize)),
          };
          if (tileBounds.minX >= tileBounds.maxX || tileBounds.minY >= tileBounds.maxY) continue;

          console.log(
            `📦 [V3 Tiles] Fetching tile ${key} (degree in [${degreeFloor.toFixed(4)}, ${degreeCeiling.toFixed(4)}), ` +
              `limit ${perTileLimit}, bbox: [${tileBounds.minX.toFixed(2)}, ${tileBounds.maxX.toFixed(2)}] x ` +
              `[${tileBounds.minY.toFixed(2)}, ${tileBounds.maxY.toFixed(2)}])`
          );

          const sql = `
            SELECT label, x, y, community, degree, tier, node_type
            FROM postgres_db.public.graph_nodes_03_11_25
            WHERE community != 8
              AND degree < ${degreeCeiling - INITIAL_DEGREE_CEILING_EPSILON}
              AND degree >= ${degreeFloor}
              AND x BETWEEN ${tileBounds.minX} AND ${tileBounds.maxX}
              AND y BETWEEN ${tileBounds.minY} AND ${tileBounds.maxY}
            ORDER BY degree DESC
            LIMIT ${perTileLimit}
          `;

          const response = await fetch('/api/mosaic/sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, type: 'arrow' }),
          });

          if (!response.ok) {
            console.warn(`⚠️ [V3 Tiles] Failed to fetch tile ${key}:`, response.statusText);
            continue;
          }

          const buffer = await response.arrayBuffer();
          const { nodes } = parseArrowToNodes(buffer);
          totalFetched += nodes.length;

          tileManager.set(key, {
            key,
            nodes,
            bounds: tileBounds,
            zoomLevelIndex,
            timestamp: Date.now(),
          });

          let added = 0;
          for (const n of nodes) {
            if (!tileNodeMapRef.current.has(n.id)) {
              tileNodeMapRef.current.set(n.id, n);
              added++;
            }
          }
          totalAdded += added;
        }

        const loadTime = performance.now() - startTime;
        console.log(`📦 [V3 Tiles] Loaded ${totalFetched} nodes across ${prioritizedMissing.length} tiles in ${loadTime.toFixed(0)}ms`);

        const accumulated = Array.from(tileNodeMapRef.current.values());
        const maxTileNodes = Math.max(0, CONFIG.MAX_MEMORY_NODES - initialNodes.length);
        if (accumulated.length > maxTileNodes) {
          // Keep the most recent nodes (rough heuristic)
          const trimmed = accumulated.slice(accumulated.length - maxTileNodes);
          tileNodeMapRef.current.clear();
          for (const n of trimmed) {
            tileNodeMapRef.current.set(n.id, n);
          }
          setTileNodes(trimmed);
        } else {
          setTileNodes(accumulated);
        }
        if (totalAdded > 0) {
          console.log(`📦 [V3 Tiles] Accumulated +${totalAdded} (total tile nodes: ${tileNodeMapRef.current.size})`);
        }
      } catch (error) {
        console.error('❌ [V3 Tiles] Error fetching viewport nodes:', error);
      } finally {
        setIsTileLoading(false);
        fetchPromiseRef.current = null;
        
        // Check if there are still missing tiles for the current viewport
        // This handles both pending requests and cases where we need to continue fetching
        const currentViewport = currentViewportRef.current;
        const currentZoomIdx = prevZoomLevelIndexRef.current;
        if (currentViewport && currentZoomIdx >= 0) {
          const zoomLevel = ZOOM_LEVELS[currentZoomIdx];
          if (zoomLevel.maxNodesPerViewport > 0) {
            const clampedBbox: BoundingBox = {
              minX: Math.max(0, Math.min(1, currentViewport.minX)),
              maxX: Math.max(0, Math.min(1, currentViewport.maxX)),
              minY: Math.max(0, Math.min(1, currentViewport.minY)),
              maxY: Math.max(0, Math.min(1, currentViewport.maxY)),
            };
            const { visible, prefetch } = getVisibleTileKeys(clampedBbox, currentZoomIdx, zoomLevel.gridSize, CONFIG.PREFETCH_MARGIN);
            const allTileKeys = [...visible, ...prefetch];
            const missingTiles = tileManagerRef.current.getMissingTiles(allTileKeys);
            
            if (missingTiles.length > 0) {
              // Use setTimeout to avoid stack overflow
              setTimeout(() => {
                fetchViewportNodes(clampedBbox, zoomLevel, currentZoomIdx, missingTiles);
              }, 0);
            }
          }
        }
      }
    })();
  }, [parseArrowToNodes]);

  // Handle viewport change - SIMPLIFIED: just fetch bbox directly
  const onViewportChange = useCallback((bbox: BoundingBox, scale: number) => {
    currentViewportRef.current = bbox;
    setCurrentScale(scale);

    const zoomLevelIndex = getZoomLevelIndex(scale);
    
    // Debug: log scale and zoom level
    // console.log(`🔍 [V3] onViewportChange: scale=${scale.toFixed(4)}, zoomLevelIndex=${zoomLevelIndex}, minDegree=${ZOOM_LEVELS[zoomLevelIndex].minDegree}`);
    const zoomLevel = ZOOM_LEVELS[zoomLevelIndex];

    // At low zoom, just use initial nodes
    if (zoomLevel.maxNodesPerViewport === 0) {
      // Use ref to check if we need to clear, avoiding dependency on tileNodes.length
      if (tileNodeMapRef.current.size > 0) {
        console.log(`📦 [V3] Zoom out - clearing ${tileNodeMapRef.current.size} tile nodes`);
        setTileNodes([]);
        tileNodeMapRef.current.clear();
      }
      prevZoomLevelIndexRef.current = zoomLevelIndex;
      return;
    }

    // Debounce tile loading
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
    }

    viewportDebounceRef.current = setTimeout(() => {
      // Check if zoom level changed - if so, clear cache and reload
      const zoomLevelChanged = prevZoomLevelIndexRef.current !== zoomLevelIndex;

      if (zoomLevelChanged) {
        console.log(`📦 [V3] Zoom level changed: ${prevZoomLevelIndexRef.current} -> ${zoomLevelIndex}`);
        // Clear tile cache so new tiles can be fetched for this zoom level
        // BUT keep accumulated nodes to avoid UI flicker - they'll be deduplicated anyway
        tileManagerRef.current.clear();
        
        // The finally block in fetchViewportNodes will check for missing tiles
        // using the current viewport state after each fetch completes

        // Keep the ceiling stable (it's the cutoff under the initial top 100k by degree)
        // Do NOT reset it to minDegree(initialNodes) (polluted by consent-first low-degree nodes).
        if (globalState.detailDegreeCeiling != null) {
          detailDegreeCeilingRef.current = globalState.detailDegreeCeiling;
          setDetailDegreeCeiling(globalState.detailDegreeCeiling);
        }
      }

      prevZoomLevelIndexRef.current = zoomLevelIndex;
      prevBboxRef.current = bbox;

      // Compute visible tiles and check if any are missing from cache
      const clampedBbox: BoundingBox = {
        minX: Math.max(0, Math.min(1, bbox.minX)),
        maxX: Math.max(0, Math.min(1, bbox.maxX)),
        minY: Math.max(0, Math.min(1, bbox.minY)),
        maxY: Math.max(0, Math.min(1, bbox.maxY)),
      };
      const { visible, prefetch } = getVisibleTileKeys(clampedBbox, zoomLevelIndex, zoomLevel.gridSize, CONFIG.PREFETCH_MARGIN);
      
      // Check if there are any missing tiles - if so, fetch them
      const allTileKeys = [...visible, ...prefetch];
      const missingTiles = tileManagerRef.current.getMissingTiles(allTileKeys);
      
      if (missingTiles.length > 0) {
        // Sort tiles by distance to viewport center for more logical loading order
        const centerX = (clampedBbox.minX + clampedBbox.maxX) / 2;
        const centerY = (clampedBbox.minY + clampedBbox.maxY) / 2;
        const distanceToCenter = (key: TileKey): number => {
          const parts = key.split('_');
          if (parts.length !== 3) return Infinity;
          const gx = Number(parts[1]);
          const gy = Number(parts[2]);
          const tileCenterX = (gx + 0.5) * zoomLevel.gridSize;
          const tileCenterY = (gy + 0.5) * zoomLevel.gridSize;
          return Math.sqrt((tileCenterX - centerX) ** 2 + (tileCenterY - centerY) ** 2);
        };
        
        // Sort missing tiles by distance to center
        const sortedMissing = [...missingTiles].sort((a, b) => distanceToCenter(a) - distanceToCenter(b));
        
        console.log(`📦 [V3] Found ${missingTiles.length} missing tiles for viewport, fetching...`);
        fetchViewportNodes(clampedBbox, zoomLevel, zoomLevelIndex, sortedMissing);
      }
    }, CONFIG.DEBOUNCE_MS);
  }, [fetchViewportNodes]);

  // Clear tile cache
  const clearTileCache = useCallback(() => {
    tileManagerRef.current.clear();
    setTileNodes([]);
    tileNodeMapRef.current.clear();
    detailDegreeCeilingRef.current = globalState.detailDegreeCeiling;
    setDetailDegreeCeiling(detailDegreeCeilingRef.current);
    console.log('🗑️ [V3] Tile cache cleared');
  }, []);

  // Merged nodes: initial + tiles (deduplicated)
  const mergedNodes = useMemo(() => {
    if (tileNodes.length === 0) {
      return initialNodes;
    }

    const initialIds = new Set(initialNodes.map(n => n.id));
    const uniqueTileNodes = tileNodes.filter(n => !initialIds.has(n.id));
    const merged = [...initialNodes, ...uniqueTileNodes];

    // Limit to max memory
    if (merged.length > CONFIG.MAX_MEMORY_NODES) {
      console.log(`📊 [V3] Trimming nodes from ${merged.length} to ${CONFIG.MAX_MEMORY_NODES}`);
      return merged.slice(0, CONFIG.MAX_MEMORY_NODES);
    }

    return merged;
  }, [initialNodes, tileNodes]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
    };
  }, []);

  // Context value
  const contextValue = useMemo<PublicGraphDataContextV3Value>(() => ({
    initialNodes,
    tileNodes,
    mergedNodes,
    isInitialLoading,
    isInitialLoaded,
    isTileLoading,
    currentScale,
    currentZoomLevel,
    normalizationBounds,
    labelMap,
    floatingLabels,
    isLabelsLoaded,
    isLabelsLoading,
    fetchInitialNodes,
    fetchLabels,
    onViewportChange,
    clearTileCache,
  }), [
    initialNodes,
    tileNodes,
    mergedNodes,
    isInitialLoading,
    isInitialLoaded,
    isTileLoading,
    currentScale,
    currentZoomLevel,
    normalizationBounds,
    labelMap,
    floatingLabels,
    isLabelsLoaded,
    isLabelsLoading,
    fetchInitialNodes,
    fetchLabels,
    onViewportChange,
    clearTileCache,
  ]);

  return (
    <PublicGraphDataContextV3.Provider value={contextValue}>
      {children}
    </PublicGraphDataContextV3.Provider>
  );
}

export type { FloatingLabel, NormalizationBounds, ZoomLevel };

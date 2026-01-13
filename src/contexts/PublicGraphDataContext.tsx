'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { GraphNode } from '@/lib/types/graph';
import { tableFromIPC } from 'apache-arrow';

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
      if (!globalPublicState.labelsLoaded) {
        try {
          const cached = await publicGraphIDB.load<{ labelMap: Record<string, string>; floatingLabels: FloatingLabel[] }>(CACHE_KEYS.FLOATING_LABELS);
          if (cached && publicGraphIDB.isCacheValid(cached.timestamp)) {
            globalPublicState.labelMap = cached.data.labelMap;
            globalPublicState.floatingLabels = cached.data.floatingLabels;
            globalPublicState.labelsLoaded = true;
            setLabelMapState(cached.data.labelMap);
            setFloatingLabelsState(cached.data.floatingLabels);
            setIsLabelsLoaded(true);
          }
        } catch (err) {
          console.warn('💾 [PublicIDB] Failed to auto-load labels:', err);
        }
      }
    };

    loadCachedData();
  }, [calculateBounds]);

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

        
        // Fetch only public data (no twitter_id)
        const sql = 'SELECT label, x, y, community, degree, tier, node_type FROM postgres_db.public.graph_nodes_03_11_25';
        
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

        
        const response = await fetch('/api/graph/names_labels', {
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
          
          globalPublicState.labelMap = newLabelMap;
          globalPublicState.floatingLabels = newFloatingLabels;
          globalPublicState.labelsLoaded = true;
          setLabelMapState(newLabelMap);
          setFloatingLabelsState(newFloatingLabels);
          setIsLabelsLoaded(true);
                    
          // Save to IndexedDB cache
          publicGraphIDB.save(CACHE_KEYS.FLOATING_LABELS, { labelMap: newLabelMap, floatingLabels: newFloatingLabels }).catch(console.warn);
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
  ]);

  return (
    <PublicGraphDataContext.Provider value={contextValue}>
      {children}
    </PublicGraphDataContext.Provider>
  );
}

export type { FloatingLabel, NormalizationBounds };

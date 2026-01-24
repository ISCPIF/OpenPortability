'use client';

/**
 * PublicGraphDataContext v2 - Tile-based progressive loading
 * 
 * Architecture:
 * - Base nodes (100k top degree) always displayed at zoom out
 * - Detail tiles loaded based on viewport and zoom level
 * - Tiles cached in IndexedDB for instant reload
 * 
 * Like Google Maps:
 * - Zoom out = base layer only
 * - Zoom in = load detail tiles for visible area
 */

import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { GraphNode, BoundingBox } from '@/lib/types/graph';
import { NormalizationBounds, calculateNormalizationBounds } from '@/lib/utils/graphTransformers';
import {
  TileKey,
  TileZoomLevel,
  TileSystemConfig,
  DEFAULT_TILE_SYSTEM_CONFIG,
  scaleToZoomLevel,
  getVisibleTileKeys,
  tileIDB,
  fetchBaseNodes,
  fetchTileNodes,
  fetchFloatingLabels,
} from '@/lib/contexts/graph';

// ============================================
// Types
// ============================================

interface FloatingLabel {
  coord_hash: string;
  x: number;
  y: number;
  text: string;
  priority: number;
  level: number;
}

interface PublicGraphContextValue {
  // Base nodes (always displayed at zoom out)
  baseNodes: GraphNode[];
  isBaseNodesLoaded: boolean;
  isBaseNodesLoading: boolean;
  
  // Tile nodes (displayed when zoomed in)
  tileNodes: GraphNode[];
  isTileLoading: boolean;
  
  // Merged nodes for display
  mergedNodes: GraphNode[];
  
  // Normalization bounds
  normalizationBounds: NormalizationBounds | null;
  
  // Labels
  floatingLabels: FloatingLabel[];
  isLabelsLoading: boolean;
  
  // Tile state
  currentZoomLevel: TileZoomLevel;
  loadedTileKeys: Set<TileKey>;
  
  // Config
  config: TileSystemConfig;
  
  // Actions
  fetchBaseNodes: () => Promise<void>;
  onViewportChange: (bbox: BoundingBox, scale: number) => void;
  clearCache: () => Promise<void>;
}

const PublicGraphContext = createContext<PublicGraphContextValue | null>(null);

// ============================================
// Provider
// ============================================

export function PublicGraphDataProvider({ children }: { children: React.ReactNode }) {
  // Base nodes state
  const [baseNodes, setBaseNodes] = useState<GraphNode[]>([]);
  const [isBaseNodesLoaded, setIsBaseNodesLoaded] = useState(false);
  const [isBaseNodesLoading, setIsBaseNodesLoading] = useState(false);
  const baseNodesMinDegreeRef = useRef<number>(0);
  
  // Tile nodes state
  const [tileNodes, setTileNodes] = useState<GraphNode[]>([]);
  const [isTileLoading, setIsTileLoading] = useState(false);
  
  // In-memory tile cache
  const tileCacheRef = useRef<Map<TileKey, GraphNode[]>>(new Map());
  const [loadedTileKeys, setLoadedTileKeys] = useState<Set<TileKey>>(new Set());
  
  // Normalization bounds
  const [normalizationBounds, setNormalizationBounds] = useState<NormalizationBounds | null>(null);
  
  // Labels
  const [floatingLabels, setFloatingLabels] = useState<FloatingLabel[]>([]);
  const [isLabelsLoading, setIsLabelsLoading] = useState(false);
  
  // Zoom state
  const [currentZoomLevel, setCurrentZoomLevel] = useState<TileZoomLevel>(0);
  const currentScaleRef = useRef<number>(0);
  const currentBboxRef = useRef<BoundingBox | null>(null);
  
  // Progressive loading state - track current degree threshold
  const currentMinDegreeRef = useRef<number>(0);
  
  // Fetch coordination
  const baseNodesPromiseRef = useRef<Promise<void> | null>(null);
  const tilePromiseRef = useRef<Promise<void> | null>(null);
  const viewportDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Config
  const config = DEFAULT_TILE_SYSTEM_CONFIG;

  // ============================================
  // Initialize: Load from cache
  // ============================================
  
  useEffect(() => {
    const loadFromCache = async () => {
      try {
        // Load base nodes from cache
        const cached = await tileIDB.loadBaseNodes();
        if (cached) {
          setBaseNodes(cached.nodes);
          setIsBaseNodesLoaded(true);
          baseNodesMinDegreeRef.current = cached.minDegree;
          
          // Calculate bounds
          if (cached.nodes.length > 0) {
            const bounds = calculateNormalizationBounds(cached.nodes);
            setNormalizationBounds(bounds);
          }
          
          console.log(`💾 [PublicGraph] Loaded ${cached.nodes.length} base nodes from cache`);
        }
        
        // Load cached tile keys
        const cachedTileKeys = await tileIDB.getCachedTileKeys();
        if (cachedTileKeys.length > 0) {
          console.log(`💾 [PublicGraph] Found ${cachedTileKeys.length} cached tiles`);
        }
      } catch (err) {
        console.warn('💾 [PublicGraph] Cache load error:', err);
      }
    };
    
    loadFromCache();
  }, []);

  // ============================================
  // Fetch Base Nodes
  // ============================================
  
  const fetchBaseNodesAction = useCallback(async () => {
    if (baseNodesPromiseRef.current) return baseNodesPromiseRef.current;
    if (isBaseNodesLoaded) return;
    
    setIsBaseNodesLoading(true);
    
    baseNodesPromiseRef.current = (async () => {
      try {
        console.log(`📊 [PublicGraph] Fetching ${config.BASE_NODES_COUNT} base nodes...`);
        
        const { nodes, minDegree } = await fetchBaseNodes(config.BASE_NODES_COUNT);
        
        setBaseNodes(nodes);
        setIsBaseNodesLoaded(true);
        baseNodesMinDegreeRef.current = minDegree;
        
        // Calculate and set bounds
        if (nodes.length > 0) {
          const bounds = calculateNormalizationBounds(nodes);
          setNormalizationBounds(bounds);
        }
        
        // Save to cache
        await tileIDB.saveBaseNodes(nodes, minDegree);
        
        console.log(`📊 [PublicGraph] Loaded ${nodes.length} base nodes, minDegree=${minDegree.toFixed(4)}`);
        
        // Also fetch labels
        fetchLabels();
        
      } catch (error) {
        console.error('❌ [PublicGraph] Error fetching base nodes:', error);
      } finally {
        setIsBaseNodesLoading(false);
        baseNodesPromiseRef.current = null;
      }
    })();
    
    return baseNodesPromiseRef.current;
  }, [isBaseNodesLoaded, config.BASE_NODES_COUNT]);

  // ============================================
  // Fetch Labels
  // ============================================
  
  const fetchLabels = useCallback(async () => {
    if (isLabelsLoading) return;
    
    setIsLabelsLoading(true);
    try {
      const labels = await fetchFloatingLabels();
      setFloatingLabels(labels);
      console.log(`🏷️ [PublicGraph] Loaded ${labels.length} labels`);
    } catch (error) {
      console.error('❌ [PublicGraph] Error fetching labels:', error);
    } finally {
      setIsLabelsLoading(false);
    }
  }, [isLabelsLoading]);

  // ============================================
  // Fetch Detail Nodes (Progressive Loading by Degree)
  // ============================================
  
  /**
   * Degree thresholds based on zoom scale:
   * - Scale < 0.5 (zoomed out): base nodes only (degree >= 2)
   * - Scale 0.5-2: add degree >= 1 in viewport
   * - Scale > 2 (zoomed in): add degree >= 0 in viewport
   */
  const getMinDegreeForScale = (scale: number): number => {
    if (scale < 0.5) return 2;  // Only high degree nodes
    if (scale < 2) return 1;    // Medium zoom: add degree 1
    return 0;                    // Max zoom: all nodes
  };
  
  // Generate a cache key for a viewport region + degree level
  const getViewportCacheKey = (bbox: BoundingBox, minDegree: number): string => {
    // Round bbox to grid cells for cache stability (avoid cache misses on tiny movements)
    const gridSize = 10; // 10 unit grid cells
    const roundedMinX = Math.floor(bbox.minX / gridSize) * gridSize;
    const roundedMaxX = Math.ceil(bbox.maxX / gridSize) * gridSize;
    const roundedMinY = Math.floor(bbox.minY / gridSize) * gridSize;
    const roundedMaxY = Math.ceil(bbox.maxY / gridSize) * gridSize;
    return `d${minDegree}_x${roundedMinX}_${roundedMaxX}_y${roundedMinY}_${roundedMaxY}`;
  };
  
  const fetchDetailNodes = useCallback(async (bbox: BoundingBox, scale: number, batchSize: number = 50000) => {
    if (!isBaseNodesLoaded) {
      console.log(`📦 [Tiles] Skipping: base nodes not loaded yet`);
      return;
    }
    
    if (tilePromiseRef.current) {
      console.log(`📦 [Tiles] Skipping: already loading`);
      return;
    }
    
    // Check if we've reached max nodes
    const currentTotal = baseNodes.length + tileNodes.length;
    if (currentTotal >= config.MAX_MEMORY_NODES) {
      console.log(`📦 [Tiles] Max nodes reached: ${currentTotal}`);
      return;
    }
    
    // Determine min degree based on zoom level
    const minDegree = getMinDegreeForScale(scale);
    
    // Add margin to bbox (20% extra on each side)
    const bboxWidth = bbox.maxX - bbox.minX;
    const bboxHeight = bbox.maxY - bbox.minY;
    const margin = 0.2;
    const expandedBbox = {
      minX: bbox.minX - bboxWidth * margin,
      maxX: bbox.maxX + bboxWidth * margin,
      minY: bbox.minY - bboxHeight * margin,
      maxY: bbox.maxY + bboxHeight * margin,
    };
    
    // Check in-memory cache first
    const cacheKey = getViewportCacheKey(expandedBbox, minDegree);
    const cachedNodes = tileCacheRef.current.get(cacheKey);
    
    if (cachedNodes) {
      // Cache hit - use cached nodes
      const baseIds = new Set(baseNodes.map(n => n.id));
      const uniqueNodes = cachedNodes.filter(n => !baseIds.has(n.id));
      setTileNodes(uniqueNodes);
      console.log(`💾 [Tiles] Cache hit: ${cacheKey} → ${uniqueNodes.length} nodes`);
      return;
    }
    
    setIsTileLoading(true);
    
    tilePromiseRef.current = (async () => {
      try {
        // Try IndexedDB cache first
        const idbCached = await tileIDB.loadTiles([cacheKey]);
        if (idbCached.has(cacheKey)) {
          const nodes = idbCached.get(cacheKey)!;
          tileCacheRef.current.set(cacheKey, nodes);
          
          const baseIds = new Set(baseNodes.map(n => n.id));
          const uniqueNodes = nodes.filter(n => !baseIds.has(n.id));
          setTileNodes(uniqueNodes);
          console.log(`💾 [Tiles] IndexedDB hit: ${cacheKey} → ${uniqueNodes.length} nodes`);
          return;
        }
        
        // Cache miss - fetch from API
        const sql = `
          SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type
          FROM postgres_db.public.graph_nodes_03_11_25 g
          WHERE g.community != 8
            AND g.degree >= ${minDegree}
            AND g.x BETWEEN ${expandedBbox.minX} AND ${expandedBbox.maxX}
            AND g.y BETWEEN ${expandedBbox.minY} AND ${expandedBbox.maxY}
          ORDER BY g.degree DESC
          LIMIT ${batchSize}
        `;
        
        console.log(`📦 [Tiles] scale=${scale.toFixed(2)} → minDegree=${minDegree}, fetching up to ${batchSize} nodes in bbox [${expandedBbox.minX.toFixed(1)},${expandedBbox.maxX.toFixed(1)}]x[${expandedBbox.minY.toFixed(1)},${expandedBbox.maxY.toFixed(1)}]`);
        
        const response = await fetch('/api/mosaic/sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, type: 'arrow' }),
        });
        
        if (!response.ok) {
          console.warn('⚠️ [Tiles] Failed to fetch:', response.statusText);
          return;
        }
        
        const { tableFromIPC } = await import('apache-arrow');
        const buffer = await response.arrayBuffer();
        const arrowTable = tableFromIPC(buffer);
        
        // Parse nodes from Arrow table
        const newNodes: GraphNode[] = [];
        
        for (let i = 0; i < arrowTable.numRows; i++) {
          const row = arrowTable.get(i);
          if (!row) continue;
          
          newNodes.push({
            id: row.label ?? `node_${i}`,
            label: row.label ?? '',
            x: row.x ?? 0,
            y: row.y ?? 0,
            community: row.community ?? null,
            degree: row.degree ?? 0,
            tier: row.tier ?? 'none',
            nodeType: row.node_type ?? undefined,
            size: 1,
            color: '',
          });
        }
        
        console.log(`📦 [Tiles] Fetched ${newNodes.length} nodes from API`);
        
        if (newNodes.length > 0) {
          // Save to caches
          tileCacheRef.current.set(cacheKey, newNodes);
          tileIDB.saveTile(cacheKey, newNodes).catch(console.warn);
          
          // Deduplicate: remove nodes already in baseNodes
          const baseIds = new Set(baseNodes.map(n => n.id));
          const uniqueNewNodes = newNodes.filter(n => !baseIds.has(n.id));
          
          setTileNodes(uniqueNewNodes);
          console.log(`📦 [Tiles] Displaying ${uniqueNewNodes.length} detail nodes (${newNodes.length - uniqueNewNodes.length} already in base)`);
        } else {
          console.log(`📦 [Tiles] No nodes in this area`);
        }
        
      } catch (error) {
        console.error('❌ [Tiles] Error fetching:', error);
      } finally {
        setIsTileLoading(false);
        tilePromiseRef.current = null;
      }
    })();
    
    return tilePromiseRef.current;
  }, [baseNodes, isBaseNodesLoaded, config.MAX_MEMORY_NODES]);

  // ============================================
  // Update Displayed Tiles
  // ============================================
  
  const updateDisplayedTiles = useCallback((tileKeys: TileKey[]) => {
    const allNodes: GraphNode[] = [];
    const baseIds = new Set(baseNodes.map(n => n.id));
    
    for (const key of tileKeys) {
      const nodes = tileCacheRef.current.get(key);
      if (nodes) {
        // Filter out nodes that are in base nodes
        for (const node of nodes) {
          if (!baseIds.has(node.id)) {
            allNodes.push(node);
          }
        }
      }
    }
    
    // Limit to max memory budget
    const maxTileNodes = config.MAX_MEMORY_NODES - baseNodes.length;
    const limitedNodes = allNodes.length > maxTileNodes 
      ? allNodes.slice(0, maxTileNodes)
      : allNodes;
    
    setTileNodes(limitedNodes);
    setLoadedTileKeys(new Set(tileKeys));
    
    console.log(`📦 [Tiles] Displaying ${limitedNodes.length} tile nodes from ${tileKeys.length} tiles`);
  }, [baseNodes, config.MAX_MEMORY_NODES]);

  // ============================================
  // Viewport Change Handler
  // ============================================
  
  const onViewportChange = useCallback((bbox: BoundingBox, scale: number) => {
    currentScaleRef.current = scale;
    currentBboxRef.current = bbox;
    
    const zoomLevel = scaleToZoomLevel(scale, config);
    
    // Update zoom level state
    if (zoomLevel !== currentZoomLevel) {
      setCurrentZoomLevel(zoomLevel);
    }
    
    // Below threshold: only show base nodes
    if (scale < config.MIN_SCALE) {
      if (tileNodes.length > 0) {
        console.log(`📦 [Tiles] Zoom out - hiding ${tileNodes.length} tile nodes`);
        setTileNodes([]);
        currentMinDegreeRef.current = 0; // Reset for next zoom in
      }
      return;
    }
    
    // Debounce detail node loading
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
    }
    
    viewportDebounceRef.current = setTimeout(() => {
      fetchDetailNodes(bbox, scale);
    }, config.DEBOUNCE_MS);
  }, [config, currentZoomLevel, tileNodes.length, fetchDetailNodes]);

  // ============================================
  // Clear Cache
  // ============================================
  
  const clearCache = useCallback(async () => {
    await tileIDB.clearAll();
    tileCacheRef.current.clear();
    setTileNodes([]);
    setLoadedTileKeys(new Set());
    setBaseNodes([]);
    setIsBaseNodesLoaded(false);
    currentMinDegreeRef.current = 0;
    console.log('🗑️ [PublicGraph] Cache cleared');
  }, []);

  // ============================================
  // Merged Nodes
  // ============================================
  
  const mergedNodes = useMemo(() => {
    if (tileNodes.length === 0) {
      return baseNodes;
    }
    
    // Base nodes + tile nodes (already deduplicated in updateDisplayedTiles)
    return [...baseNodes, ...tileNodes];
  }, [baseNodes, tileNodes]);

  // Log merged nodes count
  useEffect(() => {
    if (mergedNodes.length > 0) {
      console.log(`📊 [PublicGraph] mergedNodes: ${mergedNodes.length} (base: ${baseNodes.length}, tiles: ${tileNodes.length})`);
    }
  }, [mergedNodes.length, baseNodes.length, tileNodes.length]);

  // ============================================
  // Context Value
  // ============================================
  
  const contextValue: PublicGraphContextValue = useMemo(() => ({
    baseNodes,
    isBaseNodesLoaded,
    isBaseNodesLoading,
    tileNodes,
    isTileLoading,
    mergedNodes,
    normalizationBounds,
    floatingLabels,
    isLabelsLoading,
    currentZoomLevel,
    loadedTileKeys,
    config,
    fetchBaseNodes: fetchBaseNodesAction,
    onViewportChange,
    clearCache,
  }), [
    baseNodes,
    isBaseNodesLoaded,
    isBaseNodesLoading,
    tileNodes,
    isTileLoading,
    mergedNodes,
    normalizationBounds,
    floatingLabels,
    isLabelsLoading,
    currentZoomLevel,
    loadedTileKeys,
    config,
    fetchBaseNodesAction,
    onViewportChange,
    clearCache,
  ]);

  return (
    <PublicGraphContext.Provider value={contextValue}>
      {children}
    </PublicGraphContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function usePublicGraphData() {
  const context = useContext(PublicGraphContext);
  if (!context) {
    throw new Error('usePublicGraphData must be used within PublicGraphDataProvider');
  }
  return context;
}

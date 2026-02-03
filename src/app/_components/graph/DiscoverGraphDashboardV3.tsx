'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/hooks/useTheme';
import { usePublicGraphDataV3 } from '@/contexts/PublicGraphDataContextV3';
import { ParticulesBackground } from '../layouts/ParticulesBackground';
import { CommunityColorPicker } from './CommunityColorPicker';
import { FloatingLassoSelectionPanelLight } from './panels/FloatingLassoSelectionPanelLight';
import { useCommunityColors } from '@/hooks/useCommunityColors';
import { GraphNode } from '@/lib/types/graph';
import { clearGraphUiState } from '@/lib/utils/graphCookies';

const ReconnectGraphVisualization = dynamic(
  () => import('./ReconnectGraphVisualization').then(mod => mod.ReconnectGraphVisualization),
  { ssr: false }
);

interface DiscoverGraphDashboardProps {
  onLoginClick?: () => void;
}

export function DiscoverGraphDashboard({ onLoginClick }: DiscoverGraphDashboardProps) {
  const t = useTranslations('discoverPage');
  const { isDark, colors } = useTheme();
  const { colors: communityColors } = useCommunityColors();
  const communityColorsHook = useCommunityColors();
  
  const {
    initialNodes,
    tileNodes,
    mergedNodes,
    isInitialLoading,
    isInitialLoaded,
    isTileLoading,
    currentScale,
    currentZoomLevel,
    normalizationBounds,
    floatingLabels,
    labelMap,
    isLabelsLoaded,
    fetchInitialNodes,
    fetchLabels,
    onViewportChange,
    clearTileCache,
  } = usePublicGraphDataV3();
  
  // Threshold for showing "Return to Graph" button (user zoomed out too far)
  // Show warning at scale < 0.01, force reset happens at scale < 0.005 in EmbeddingViewWrapper
  const ZOOM_OUT_WARNING_THRESHOLD = 0.01;
  const isZoomedOutTooFar = currentScale > 0 && currentScale < ZOOM_OUT_WARNING_THRESHOLD;
  
  const loaderContrastColor = isDark 
    ? (communityColors[9] || communityColors[8] || '#fad541')
    : (communityColors[0] || communityColors[1] || '#011959');
  
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isGraphRendered, setIsGraphRendered] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(() => t('loadingGraph'));
  const [viewResetKey, setViewResetKey] = useState(0);
  const [addedLabelsCount, setAddedLabelsCount] = useState(0);
  const previousLabelKeysRef = useRef<Set<string> | null>(null);
  const addedLabelsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [lassoSelectedMembers, setLassoSelectedMembers] = useState<GraphNode[]>([]);
  
  const [highlightedSearchNode, setHighlightedSearchNode] = useState<{
    x: number;
    y: number;
    label: string;
    description: string | null;
    community: number | null;
  } | null>(null);
  
  const [globalStats, setGlobalStats] = useState<{
    users?: { total: number; onboarded: number };
    connections?: { followers: number; following: number; followedOnBluesky: number; followedOnMastodon: number };
  } | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  useEffect(() => {
    fetchInitialNodes();
    fetchLabels();
    
    const fetchGlobalStats = async () => {
      setIsStatsLoading(true);
      try {
        const response = await fetch('/api/stats/public');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setGlobalStats(data.stats);
          }
        }
      } catch (error) {
        console.error('Failed to fetch global stats:', error);
      } finally {
        setIsStatsLoading(false);
      }
    };
    fetchGlobalStats();
  }, [fetchInitialNodes, fetchLabels]);

  useEffect(() => {
    if (isInitialLoading) {
      setLoadingMessage(t('loadingInitialNodes'));
    } else if (initialNodes.length > 0 && !isGraphRendered) {
      setLoadingMessage(t('initializingGraph'));
    }
  }, [isInitialLoading, initialNodes.length, isGraphRendered, t]);

  useEffect(() => {
    const updateSize = () => {
      const container = document.getElementById('discover-v3-graph-container');
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    };

    updateSize();
    const timeoutId1 = setTimeout(updateSize, 100);
    const timeoutId2 = setTimeout(updateSize, 500);
    
    window.addEventListener('resize', updateSize);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    if (initialNodes.length > 0 && containerSize.width === 0) {
      const container = document.getElementById('discover-v3-graph-container');
      if (container) {
        setContainerSize({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    }
  }, [initialNodes.length, containerSize.width]);

  useEffect(() => {
    if (!isLabelsLoaded) {
      setAddedLabelsCount(0);
      if (addedLabelsTimeoutRef.current) {
        clearTimeout(addedLabelsTimeoutRef.current);
        addedLabelsTimeoutRef.current = null;
      }
      return;
    }

    const currentKeys = new Set(Object.keys(labelMap));

    if (!previousLabelKeysRef.current) {
      previousLabelKeysRef.current = currentKeys;
      return;
    }

    let addedCount = 0;
    currentKeys.forEach((key) => {
      if (!previousLabelKeysRef.current?.has(key)) {
        addedCount += 1;
      }
    });

    if (addedCount > 0) {
      setAddedLabelsCount(addedCount);
      if (addedLabelsTimeoutRef.current) {
        clearTimeout(addedLabelsTimeoutRef.current);
      }
      addedLabelsTimeoutRef.current = setTimeout(() => {
        setAddedLabelsCount(0);
      }, 10000);
    }

    previousLabelKeysRef.current = currentKeys;
  }, [labelMap, isLabelsLoaded]);

  useEffect(() => {
    return () => {
      if (addedLabelsTimeoutRef.current) {
        clearTimeout(addedLabelsTimeoutRef.current);
      }
    };
  }, []);

  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleMosaicNodesReady = useCallback((nodes: GraphNode[]) => {
    setLoadingMessage(t('initializingGraph'));
  }, [t]);

  const handleGraphReady = useCallback(() => {
    setIsGraphRendered(true);
  }, []);

  const handleResetView = useCallback(() => {
    clearGraphUiState();
    setHighlightedSearchNode(null);
    clearTileCache();
    setViewResetKey(prev => prev + 1);
  }, [clearTileCache]);

  const handleClearSearchHighlight = useCallback(() => {
    setHighlightedSearchNode(null);
  }, []);

  const handleTileViewportChange = useCallback((boundingBox: { minX: number; maxX: number; minY: number; maxY: number }, zoomLevel: number) => {
    onViewportChange(boundingBox, zoomLevel);
  }, [onViewportChange]);

  const displayNodes = useMemo(() => {
    const result = mergedNodes.length > 0 ? mergedNodes : initialNodes;
    console.log(`📊 [V3 Dashboard] displayNodes: ${result.length} (initial: ${initialNodes.length}, tiles: ${tileNodes.length}, merged: ${mergedNodes.length})`);
    return result;
  }, [initialNodes, tileNodes, mergedNodes]);

  const emptySet = useMemo(() => new Set<string>(), []);
  const emptyMap = useMemo(() => new Map<string, { hasBlueskyFollow: boolean; hasMastodonFollow: boolean; hasMatching: boolean }>(), []);

  const headerHeight = 40;
  const [footerHeight, setFooterHeight] = useState(84);
  
  useEffect(() => {
    const updateFooterHeight = () => {
      const isMobile = window.innerWidth < 768;
      setFooterHeight(isMobile ? 40 : 84);
    };
    updateFooterHeight();
    window.addEventListener('resize', updateFooterHeight);
    return () => window.removeEventListener('resize', updateFooterHeight);
  }, []);

  const isGraphReady = initialNodes.length > 0;

  const communityLabels = useMemo(() => ({
    0: t('communities.gamingEsports'),
    1: t('communities.scienceEnvironment'),
    2: t('communities.sportsBusiness'),
    3: t('communities.journalismInternational'),
    4: t('communities.entertainmentLgbtq'),
    5: t('communities.spanishMedia'),
    6: t('communities.frenchMedia'),
    7: t('communities.scienceResearch'),
    8: t('communities.adultContent'),
    9: t('communities.musicArt'),
  }), [t]);

  return (
    <div 
      className="relative w-full overflow-hidden" 
      style={{ 
        backgroundColor: colors.background,
        height: '100vh',
        paddingTop: `${headerHeight}px`,
        paddingBottom: `${footerHeight}px`,
      }}
    >
      {/* Loading Overlay */}
      {!isGraphRendered && (
        <div className="absolute inset-0 z-50" style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px` }}>
          <ParticulesBackground />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div 
                className="w-10 h-10 border-3 rounded-full animate-spin" 
                style={{ 
                  borderLeftColor: loaderContrastColor,
                  borderRightColor: loaderContrastColor,
                  borderBottomColor: loaderContrastColor,
                  borderTopColor: 'transparent'
                }}
              />
              <p 
                className="font-mono tracking-wider text-sm"
                style={{ color: loaderContrastColor }}
              >
                {loadingMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Graph Container */}
      <div id="discover-v3-graph-container" className="absolute left-0 right-0" style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px` }}>
        {containerSize.width > 0 && containerSize.height > 0 && (
          <ReconnectGraphVisualization
            key={`graph-v3-${viewResetKey}`}
            nodes={displayNodes}
            width={containerSize.width}
            height={containerSize.height}
            hasPersonalNetwork={false}
            isPersonalOnlyView={false}
            isMembersView={false}
            isFollowersView={false}
            viewMode="discover"
            userNode={null}
            onNodeSelect={handleNodeSelect}
            onMosaicNodesReady={handleMosaicNodesReady}
            onGraphReady={handleGraphReady}
            communityColors={communityColorsHook.colors}
            userPointSize={communityColorsHook.pointSize}
            onLassoMembers={setLassoSelectedMembers}
            lassoSelectedMembers={lassoSelectedMembers}
            lassoConnectedIds={emptySet}
            lassoActiveTab="found"
            highlightVersion={0}
            highlightMode={null}
            followingHashes={emptyMap}
            followerHashes={emptySet}
            publicFloatingLabels={floatingLabels}
            publicNormalizationBounds={normalizationBounds}
            highlightedSearchNode={highlightedSearchNode}
            onClearSearchHighlight={handleClearSearchHighlight}
            onTileViewportChange={handleTileViewportChange}
          />
        )}
      </div>

      {/* V3 Badge + View Mode Indicator */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 z-40 flex items-center bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
        style={{ top: `${headerHeight + 16}px` }}
      >
  
        <div className="relative px-4 py-2 text-[11px] font-medium tracking-wide text-white bg-slate-800">
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500" />
          {t('title')}
        </div>
        
        {onLoginClick && (
          <>
            <div className="w-px h-4 bg-slate-700/50" />
            <button
              onClick={onLoginClick}
              className="px-4 py-2 text-[11px] font-medium tracking-wide text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"
            >
              {t('loginForMore')}
            </button>
          </>
        )}
      </div>

      {/* Stats Panel - V3 specific info */}
      <div 
        className="absolute right-4 z-40 bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-700/50 shadow-xl p-4 min-w-[200px]"
        style={{ top: `${headerHeight + 16}px` }}
      >
        <div className="text-xs text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
          {t('stats')}
        </div>

        {addedLabelsCount > 0 && (
          <div className="mb-3 rounded border border-emerald-500/20 bg-emerald-900/20 px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-emerald-300">
              {t('labelsRefresh.title')}
            </div>
            <div className="text-[11px] text-emerald-100 font-medium">
              {t('labelsRefresh.added', { count: addedLabelsCount })}
            </div>
          </div>
        )}
        
        
        {/* Node counts */}
        <div className="mb-3">
          <div className="text-xs text-slate-500">{t('displayedNodes')}</div>
          <div className="text-lg font-mono text-white flex items-center gap-2">
            {mergedNodes.length.toLocaleString()}
            {isTileLoading && (
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" title={t('loadingTiles')} />
            )}
          </div>
        </div>
      
        
        {/* Global stats from API */}
        {globalStats && (
          <>
            <div className="border-t border-slate-700/50 my-3" />
            
            <div className="mb-2">
              <div className="text-xs text-slate-500">{t('users')}</div>
              <div className="text-sm font-mono text-white">
                {globalStats.users?.total?.toLocaleString() || '—'}
              </div>
            </div>
            
            <div className="mb-2">
              <div className="text-xs text-slate-500">{t('registeredLinks')}</div>
              <div className="text-sm font-mono text-white">
                {((globalStats.connections?.followers || 0) + (globalStats.connections?.following || 0)).toLocaleString()}
              </div>
            </div>
            
            <div className="mb-2">
              <div className="text-xs text-slate-500">{t('recreatedLinks')}</div>
              <div className="text-sm font-mono text-white">
                {((globalStats.connections?.followedOnBluesky || 0) + (globalStats.connections?.followedOnMastodon || 0)).toLocaleString()}
              </div>
            </div>
          </>
        )}
        
        {lassoSelectedMembers.length > 0 && (
          <>
            <div className="border-t border-slate-700/50 my-3" />
            <div className="text-sm text-amber-400">
              {t('selected', { count: lassoSelectedMembers.length })}
            </div>
          </>
        )}
        
        <button
          onClick={handleResetView}
          className="mt-3 w-full px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
        >
          {t('resetView')}
        </button>
      </div>

      {/* Lasso Selection Panel Light */}
      <FloatingLassoSelectionPanelLight
        lassoMembers={lassoSelectedMembers}
        onClearSelection={() => setLassoSelectedMembers([])}
        communityColors={communityColorsHook.colors}
        onLoginClick={onLoginClick}
        onHighlightNode={setHighlightedSearchNode}
      />

      {/* Zoom Out Warning - Return to Graph Button */}
      {isZoomedOutTooFar && isGraphRendered && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 z-50 animate-pulse"
          style={{ top: `${headerHeight + 80}px` }}
        >
          <button
            onClick={handleResetView}
            className="flex items-center gap-3 px-6 py-3 bg-amber-500/95 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg shadow-xl backdrop-blur-sm border border-amber-400/50 transition-all hover:scale-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
            </svg>
            <span>{t('returnToGraph')}</span>
          </button>
          <p className="text-center text-xs text-amber-300 mt-2">
            {t('zoomedOutTooFar')}
          </p>
        </div>
      )}

      {/* Community Color Picker */}
      <div className="absolute left-6 z-40" style={{ bottom: `${footerHeight + 16}px` }}>
        <CommunityColorPicker
          communityLabels={communityLabels}
          colorHook={communityColorsHook}
          className="max-w-xs"
          currentNodeCount={mergedNodes.length}
          maxMemoryNodes={600_000}
        />
      </div>
    </div>
  );
}

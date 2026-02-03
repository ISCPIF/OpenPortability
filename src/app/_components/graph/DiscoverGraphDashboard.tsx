// 'use client';

// import { useEffect, useState, useMemo, useCallback } from 'react';
// import dynamic from 'next/dynamic';
// import { useTranslations } from 'next-intl';
// import { useTheme } from '@/hooks/useTheme';
// import { usePublicGraphDataV3 } from '@/contexts/PublicGraphDataContextV3';
// import { ParticulesBackground } from '../layouts/ParticulesBackground';
// import { CommunityColorPicker } from './CommunityColorPicker';
// import { FloatingLassoSelectionPanelLight } from './panels/FloatingLassoSelectionPanelLight';
// import { useCommunityColors } from '@/hooks/useCommunityColors';
// import { GraphNode } from '@/lib/types/graph';
// import { clearGraphUiState } from '@/lib/utils/graphCookies';

// // Dynamic import to avoid SSR issues with embedding-atlas WASM
// const ReconnectGraphVisualization = dynamic(
//   () => import('./ReconnectGraphVisualization').then(mod => mod.ReconnectGraphVisualization),
//   { ssr: false }
// );

// interface DiscoverGraphDashboardProps {
//   onLoginClick?: () => void;
// }

// /**
//  * Simplified graph dashboard for non-authenticated users.
//  * Shows only the discover mode with labels - no personal network features.
//  */
// export function DiscoverGraphDashboard({ onLoginClick }: DiscoverGraphDashboardProps) {
//   const t = useTranslations('discoverPage');
//   const { isDark, colors } = useTheme();
//   const { colors: communityColors } = useCommunityColors();
//   const communityColorsHook = useCommunityColors();
  
//   // Public graph data (no auth required) with tile-based loading
//   const {
//     initialNodes,
//     isInitialLoading,
//     fetchInitialNodes,
//     fetchLabels,
//     floatingLabels,
//     normalizationBounds,
//     // Tile-based progressive loading
//     mergedNodes,
//     onViewportChange,
//     isTileLoading,
//   } = usePublicGraphDataV3();
  
//   // Loader contrast color
//   const loaderContrastColor = isDark 
//     ? (communityColors[9] || communityColors[8] || '#fad541')
//     : (communityColors[0] || communityColors[1] || '#011959');
  
//   const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
//   const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
//   const [isGraphRendered, setIsGraphRendered] = useState(false);
//   const [loadingMessage, setLoadingMessage] = useState('Chargement du graphe...');
//   const [viewResetKey, setViewResetKey] = useState(0);
  
//   // Lasso selection (discover mode feature)
//   const [lassoSelectedMembers, setLassoSelectedMembers] = useState<GraphNode[]>([]);
  
//   // Highlighted search node (from lasso panel search)
//   const [highlightedSearchNode, setHighlightedSearchNode] = useState<{
//     x: number;
//     y: number;
//     label: string;
//     description: string | null;
//     community: number | null;
//   } | null>(null);
  
//   // Global stats from public API
//   const [globalStats, setGlobalStats] = useState<{
//     users?: { total: number; onboarded: number };
//     connections?: { followers: number; following: number; followedOnBluesky: number; followedOnMastodon: number };
//   } | null>(null);
//   const [isStatsLoading, setIsStatsLoading] = useState(false);

//   // Fetch data on mount
//   useEffect(() => {
//     fetchInitialNodes();
//     fetchLabels();
    
//     // Fetch global stats
//     const fetchGlobalStats = async () => {
//       setIsStatsLoading(true);
//       try {
//         const response = await fetch('/api/stats/public');
//         if (response.ok) {
//           const data = await response.json();
//           if (data.success) {
//             setGlobalStats(data.stats);
//           }
//         }
//       } catch (error) {
//         console.error('Failed to fetch global stats:', error);
//       } finally {
//         setIsStatsLoading(false);
//       }
//     };
//     fetchGlobalStats();
//   }, [fetchInitialNodes, fetchLabels]);

//   // Update loading message
//   useEffect(() => {
//     if (isInitialLoading) {
//       setLoadingMessage('Chargement des nœuds...');
//     } else if (initialNodes.length > 0 && !isGraphRendered) {
//       setLoadingMessage('Initialisation du graphe...');
//     }
//   }, [isInitialLoading, initialNodes.length, isGraphRendered]);

//   // Handle container resize
//   useEffect(() => {
//     const updateSize = () => {
//       const container = document.getElementById('discover-graph-container');
//       if (container) {
//         const width = container.clientWidth;
//         const height = container.clientHeight;
//         if (width > 0 && height > 0) {
//           setContainerSize({ width, height });
//         }
//       }
//     };

//     updateSize();
//     const timeoutId1 = setTimeout(updateSize, 100);
//     const timeoutId2 = setTimeout(updateSize, 500);
    
//     window.addEventListener('resize', updateSize);

//     return () => {
//       clearTimeout(timeoutId1);
//       clearTimeout(timeoutId2);
//       window.removeEventListener('resize', updateSize);
//     };
//   }, []);

//   // Recalculate when nodes are loaded
//   useEffect(() => {
//     if (initialNodes.length > 0 && containerSize.width === 0) {
//       const container = document.getElementById('discover-graph-container');
//       if (container) {
//         setContainerSize({
//           width: container.clientWidth,
//           height: container.clientHeight,
//         });
//       }
//     }
//   }, [initialNodes.length, containerSize.width]);

//   const handleNodeSelect = useCallback((node: GraphNode | null) => {
//     setSelectedNode(node);
//   }, []);

//   const handleMosaicNodesReady = useCallback((nodes: GraphNode[]) => {
//     setLoadingMessage('Initialisation du graphe...');
//   }, []);

//   const handleGraphReady = useCallback(() => {
//     setIsGraphRendered(true);
//   }, []);

//   // Callback to reset the graph view (forces remount of EmbeddingView)
//   const handleResetView = useCallback(() => {
//     // Clear all graph UI cookies so the view resets to default position
//     clearGraphUiState();
//     setHighlightedSearchNode(null);
//     setViewResetKey(prev => prev + 1);
//   }, []);

//   const handleClearSearchHighlight = useCallback(() => {
//     setHighlightedSearchNode(null);
//   }, []);

//   // Callback for tile-based viewport changes (progressive loading)
//   const handleTileViewportChange = useCallback((boundingBox: { minX: number; maxX: number; minY: number; maxY: number }, zoomLevel: number) => {
//     if (onViewportChange) {
//       onViewportChange(boundingBox, zoomLevel);
//     }
//   }, [onViewportChange]);

//   // Use mergedNodes (baseNodes + tileNodes) when available
//   const displayNodes = useMemo(() => {
//     const result = (mergedNodes && mergedNodes.length > initialNodes.length) ? mergedNodes : initialNodes;
//     console.log(`📊 [DiscoverDashboard] displayNodes: ${result.length} (initialNodes: ${initialNodes.length}, mergedNodes: ${mergedNodes?.length ?? 0})`);
//     return result;
//   }, [initialNodes, mergedNodes]);

//   // Empty sets/maps for non-authenticated mode
//   const emptySet = useMemo(() => new Set<string>(), []);
//   const emptyMap = useMemo(() => new Map<string, { hasBlueskyFollow: boolean; hasMastodonFollow: boolean; hasMatching: boolean }>(), []);

//   // Header/Footer heights
//   const headerHeight = 40;
//   const [footerHeight, setFooterHeight] = useState(84);
  
//   useEffect(() => {
//     const updateFooterHeight = () => {
//       const isMobile = window.innerWidth < 768;
//       setFooterHeight(isMobile ? 40 : 84);
//     };
//     updateFooterHeight();
//     window.addEventListener('resize', updateFooterHeight);
//     return () => window.removeEventListener('resize', updateFooterHeight);
//   }, []);

//   const isGraphReady = initialNodes.length > 0;

//   return (
//     <div 
//       className="relative w-full overflow-hidden" 
//       style={{ 
//         backgroundColor: colors.background,
//         height: '100vh',
//         paddingTop: `${headerHeight}px`,
//         paddingBottom: `${footerHeight}px`,
//       }}
//     >
//       {/* Loading Overlay */}
//       {!isGraphRendered && (
//         <div className="absolute inset-0 z-50" style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px` }}>
//           <ParticulesBackground />
//           <div className="absolute inset-0 flex items-center justify-center">
//             <div className="flex flex-col items-center gap-4">
//               <div 
//                 className="w-10 h-10 border-3 rounded-full animate-spin" 
//                 style={{ 
//                   borderLeftColor: loaderContrastColor,
//                   borderRightColor: loaderContrastColor,
//                   borderBottomColor: loaderContrastColor,
//                   borderTopColor: 'transparent'
//                 }}
//               />
//               <p 
//                 className="font-mono tracking-wider text-sm"
//                 style={{ color: loaderContrastColor }}
//               >
//                 {loadingMessage}
//               </p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Graph Container */}
//       <div id="discover-graph-container" className="absolute left-0 right-0" style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px` }}>
//         {containerSize.width > 0 && containerSize.height > 0 && (
//           <ReconnectGraphVisualization
//             key={`graph-${viewResetKey}`}
//             nodes={displayNodes}
//             width={containerSize.width}
//             height={containerSize.height}
//             hasPersonalNetwork={false}
//             isPersonalOnlyView={false}
//             isMembersView={false}
//             isFollowersView={false}
//             viewMode="discover"
//             userNode={null}
//             onNodeSelect={handleNodeSelect}
//             onMosaicNodesReady={handleMosaicNodesReady}
//             onGraphReady={handleGraphReady}
//             communityColors={communityColorsHook.colors}
//             userPointSize={communityColorsHook.pointSize}
//             onLassoMembers={setLassoSelectedMembers}
//             lassoSelectedMembers={lassoSelectedMembers}
//             lassoConnectedIds={emptySet}
//             lassoActiveTab="found"
//             highlightVersion={0}
//             highlightMode={null}
//             followingHashes={emptyMap}
//             followerHashes={emptySet}
//             publicFloatingLabels={floatingLabels}
//             publicNormalizationBounds={normalizationBounds}
//             highlightedSearchNode={highlightedSearchNode}
//             onClearSearchHighlight={handleClearSearchHighlight}
//             onTileViewportChange={handleTileViewportChange}
//           />
//         )}
//       </div>

//       {/* View Mode Indicator - Discover Only */}
//       <div 
//         className="absolute left-1/2 -translate-x-1/2 z-40 flex items-center bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
//         style={{ top: `${headerHeight + 16}px` }}
//       >
//         <div className="relative px-4 py-2 text-[11px] font-medium tracking-wide text-white bg-slate-800">
//           <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500" />
//           {t('title')}
//         </div>
        
//         {onLoginClick && (
//           <>
//             <div className="w-px h-4 bg-slate-700/50" />
//             <button
//               onClick={onLoginClick}
//               className="px-4 py-2 text-[11px] font-medium tracking-wide text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"
//             >
//               {t('loginForMore')}
//             </button>
//           </>
//         )}
//       </div>

//       {/* Stats Panel - With global stats */}
//       <div 
//         className="absolute right-4 z-40 bg-slate-900/95 backdrop-blur-sm rounded-lg border border-slate-700/50 shadow-xl p-4 min-w-[180px]"
//         style={{ top: `${headerHeight + 16}px` }}
//       >
//         <div className="text-xs text-slate-400 mb-3 uppercase tracking-wider">{t('stats')}</div>
        
//         {/* Graph nodes - show mergedNodes (real-time count) */}
//         <div className="mb-3">
//           <div className="text-xs text-slate-500">{t('graphNodes')}</div>
//           <div className="text-lg font-mono text-white flex items-center gap-2">
//             {mergedNodes.length.toLocaleString()}
//             {isTileLoading && (
//               <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" title="Loading..." />
//             )}
//           </div>
//           {mergedNodes.length > initialNodes.length && (
//             <div className="text-[10px] text-slate-500">
//               {initialNodes.length.toLocaleString()} base + {(mergedNodes.length - initialNodes.length).toLocaleString()} detail
//             </div>
//           )}
//         </div>
        
//         {/* Global stats from API */}
//         {globalStats && (
//           <>
//             <div className="border-t border-slate-700/50 my-3" />
            
//             {/* Users */}
//             <div className="mb-2">
//               <div className="text-xs text-slate-500">{t('users')}</div>
//               <div className="text-sm font-mono text-white">
//                 {globalStats.users?.total?.toLocaleString() || '—'}
//               </div>
//             </div>
            
//             {/* Registered links (followers + following) */}
//             <div className="mb-2">
//               <div className="text-xs text-slate-500">{t('registeredLinks')}</div>
//               <div className="text-sm font-mono text-white">
//                 {((globalStats.connections?.followers || 0) + (globalStats.connections?.following || 0)).toLocaleString()}
//               </div>
//             </div>
            
//             {/* Recreated links (followedOnBluesky + followedOnMastodon) */}
//             <div className="mb-2">
//               <div className="text-xs text-slate-500">{t('recreatedLinks')}</div>
//               <div className="text-sm font-mono text-white">
//                 {((globalStats.connections?.followedOnBluesky || 0) + (globalStats.connections?.followedOnMastodon || 0)).toLocaleString()}
//               </div>
//             </div>
//           </>
//         )}
        
//         {lassoSelectedMembers.length > 0 && (
//           <>
//             <div className="border-t border-slate-700/50 my-3" />
//             <div className="text-sm text-amber-400">
//               {t('selected', { count: lassoSelectedMembers.length })}
//             </div>
//           </>
//         )}
        
//         <button
//           onClick={handleResetView}
//           className="mt-3 w-full px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
//         >
//           {t('resetView')}
//         </button>
//       </div>

//       {/* Lasso Selection Panel Light - for non-authenticated users */}
//       <FloatingLassoSelectionPanelLight
//         lassoMembers={lassoSelectedMembers}
//         onClearSelection={() => setLassoSelectedMembers([])}
//         communityColors={communityColorsHook.colors}
//         onLoginClick={onLoginClick}
//         onHighlightNode={setHighlightedSearchNode}
//       />

//       {/* Community Color Picker with Node Limit Slider */}
//       <div className="absolute left-6 z-40" style={{ bottom: `${footerHeight + 16}px` }}>
//         <CommunityColorPicker
//           communityLabels={{
//             0: 'Gaming / Esports',
//             1: 'Science / Environment',
//             2: 'Sports / Business',
//             3: 'Journalism / International',
//             4: 'Entertainment / LGBTQ+',
//             5: 'Spanish Media',
//             6: 'French Media',
//             7: 'Science / Research',
//             8: 'Adult Content',
//             9: 'Music / Art',
//           }}
//           colorHook={communityColorsHook}
//           className="max-w-xs"
//           currentNodeCount={mergedNodes.length}
//           maxMemoryNodes={600_000}
//         />
//       </div>
//     </div>
//   );
// }

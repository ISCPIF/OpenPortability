// 'use client'

// import { useState, useCallback, useEffect, useMemo } from 'react';
// import { useTranslations } from 'next-intl';
// import { useGraphData } from '@/app/_components/graph/hooks/useGraphData';
// import { 
//   searchNodes,
//   focusOnNode,
//   filterDataByCommunities,
//   extractAvailableCommunities,
//   createResetHandler,
//   createSearchHandler,
//   createSearchResultHandler,
//   createCommunityHandlers,
// } from '@/lib/graph-utils';
// import type { GraphNode, GraphData } from '@/lib/types/graph';

// // Nouveaux composants
// import { GraphModeProvider, useGraphMode, type GraphMode } from '@/app/_components/graph/GraphModeProvider';
// import Header from '@/app/_components/Header';
// import { HamburgerMenu } from '@/app/_components/graph/HamburgerMenu';
// import { StatsLegendCombined } from '@/app/_components/graph/StatsLegendCombined';
// import { SigmaGraphContainer } from '@/app/_components/graph/SigmaGraphContainer';
// import { WaveAnimation } from '@/app/_components/graph/WaveAnimation';

// export default function GraphPage() {
//   const t = useTranslations('graph');
  
//   // Utiliser le hook useGraphData avec toutes les fonctionnalités d'overlay
//   const {
//     staticGraphData,
//     loading,
//     error,
//     fetchStaticGraphData,
//     userNetworkData,
//     userNetworkLoading,
//     userNetworkError,
//     showUserNetwork,
//     fetchUserNetwork,
//     toggleUserNetwork,
//     createGraphWithOverlay,
//     session,
//     globalStats,
//     globalStatsLoading,
//     globalStatsError,
//     fetchGlobalStats,
//     top100EdgesData,
//     top100EdgesLoading,
//     top100EdgesError,
//     fetchTop100EdgesData
//   } = useGraphData();
  
//   // Handler pour les changements de mode depuis le HamburgerMenu
//   const handleModeChange = useCallback((mode: GraphMode) => {
//     console.log('Changement de mode vers:', mode);
    
//     switch (mode) {
//       case 'anonyme':
//         // Mode vue d'ensemble - masquer l'overlay utilisateur
//         if (showUserNetwork) {
//           toggleUserNetwork();
//         }
//         break;
        
//       case 'connexions':
//         // Mode connexions - afficher l'overlay utilisateur
//         if (!showUserNetwork && session?.user) {
//           toggleUserNetwork();
//         }
//         break;
        
//       case 'migrations':
//         // Mode migrations - pour l'instant, même comportement que connexions
//         // TODO: implémenter la logique spécifique aux migrations
//         if (!showUserNetwork && session?.user) {
//           toggleUserNetwork();
//         }
//         break;
//     }
//   }, [showUserNetwork, toggleUserNetwork, session]);

//   const [filteredGraphData, setFilteredGraphData] = useState<GraphData | null>(null);
//   const [searchQuery, setSearchQuery] = useState<string>('');
//   const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
//   const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
//   const [showSearchResults, setShowSearchResults] = useState(false);
//   const [selectedCommunities, setSelectedCommunities] = useState<Set<number>>(new Set());
//   const [availableCommunities, setAvailableCommunities] = useState<number[]>([]);
//   const [showCommunityFilter, setShowCommunityFilter] = useState(false);

//   // Créer les handlers avec les utilitaires existants
//   const resetHandler = createResetHandler();
//   const searchHandler = createSearchHandler();
//   const searchResultHandler = createSearchResultHandler();
//   const communityHandlers = createCommunityHandlers();

//   // Charger les données automatiquement au montage du composant
//   useEffect(() => {
//     fetchStaticGraphData();
//   }, [fetchStaticGraphData]);

//   // Mettre à jour les données filtrées quand staticGraphData ou l'overlay change
//   useEffect(() => {
//     if (staticGraphData) {
//       // Utiliser createGraphWithOverlay pour appliquer l'overlay si nécessaire
//       const graphWithOverlay = createGraphWithOverlay(staticGraphData);
//       setFilteredGraphData(graphWithOverlay);
      
//       // Extraire les communautés disponibles (seulement au premier chargement)
//       if (availableCommunities.length === 0) {
//         const communityList = extractAvailableCommunities(staticGraphData);
//         setAvailableCommunities(communityList);
//         setSelectedCommunities(new Set(communityList));
//       }
//     }
//   }, [staticGraphData, availableCommunities.length, showUserNetwork, userNetworkData, createGraphWithOverlay]);

//   // Handler pour reset
//   const handleReset = useCallback(() => {
//     resetHandler.resetFilters({
//       setFilteredGraphData,
//       setSearchQuery,
//       setSearchResults,
//       setSelectedNodeId,
//       setShowSearchResults,
//       setSelectedCommunities,
//       setAvailableCommunities,
//       setShowCommunityFilter
//     });
//   }, [resetHandler]);

//   // Handler pour la recherche avec debounce
//   useEffect(() => {
//     const timeoutId = setTimeout(() => {
//       searchHandler.searchNodes(
//         filteredGraphData,
//         searchQuery,
//         setSearchResults,
//         setShowSearchResults
//       );
//     }, 300); // Debounce de 300ms

//     return () => clearTimeout(timeoutId);
//   }, [searchQuery, filteredGraphData, searchHandler]);

//   // Handler pour focus sur un nœud
//   const handleFocusOnNode = useCallback((nodeId: string) => {
//     setSelectedNodeId(nodeId);
//     setShowSearchResults(false);
//   }, []);

//   // Handler pour sélectionner un résultat de recherche
//   const handleSelectSearchResult = useCallback((node: GraphNode) => {
//     searchResultHandler.selectSearchResult(node, setSearchQuery, handleFocusOnNode);
//   }, [searchResultHandler, handleFocusOnNode]);

//   // Effet pour filtrer les données quand les communautés sélectionnées changent
//   useEffect(() => {
//     if (!staticGraphData) return;

//     const filtered = filterDataByCommunities(
//       staticGraphData,
//       selectedCommunities,
//       availableCommunities
//     );
    
//     if (filtered) {
//       setFilteredGraphData(filtered);
//     }
//   }, [staticGraphData, selectedCommunities, availableCommunities]);

//   // Handlers pour les communautés
//   const handleToggleCommunity = useCallback((communityId: number) => {
//     communityHandlers.toggleCommunity(
//       communityId,
//       selectedCommunities,
//       setSelectedCommunities
//     );
//   }, [selectedCommunities, communityHandlers]);

//   const handleSelectAllCommunities = useCallback(() => {
//     communityHandlers.selectAllCommunities(
//       availableCommunities,
//       setSelectedCommunities
//     );
//   }, [availableCommunities, communityHandlers]);

//   const handleDeselectAllCommunities = useCallback(() => {
//     communityHandlers.deselectAllCommunities(setSelectedCommunities);
//   }, [communityHandlers]);

//   // Handler pour la sélection de nœud
//   const handleNodeSelect = useCallback((nodeId: string | null) => {
//     setSelectedNodeId(nodeId);
//   }, []);

//   return (
//     <GraphModeProvider initialMode="anonyme">
//       <Header />
//       <ModeHandler onModeChange={handleModeChange} />
//       <div className="h-screen w-screen relative overflow-hidden">
        
//         {/* Container du graphe Sigma - Prend toute la page */}
//         <div className="absolute inset-0 w-full h-full">
//           <SigmaGraphContainer
//             graphData={filteredGraphData}
//             loading={loading}
//             selectedNodeId={selectedNodeId}
//             onNodeSelect={handleNodeSelect}
//           />
//         </div>

//         {/* Header transparent - Position absolue */}
//         {/* <div className="absolute top-0 left-0 right-0 z-50">
//           <Header />
//         </div> */}

//         {/* Menu hamburger vertical - Position absolue */}
//         {/* <div className="absolute top-0 left-0 z-40">
//           <HamburgerMenu />
//         </div> */}

//         {/* Stats overlay - Position absolue */}
//         <div className="absolute top-0 right-0 z-40">
//           <StatsLegendCombined 
//             graphData={filteredGraphData}
//             userNetworkData={userNetworkData}
//             showUserNetwork={showUserNetwork}
//             globalStats={globalStats}
//             globalStatsLoading={globalStatsLoading}
//           />
//         </div>

//         {/* Légende - Position absolue */}
//         <div className="absolute bottom-4 left-4 z-30">
//           {/* <GraphLegendNew /> */}
//         </div>

//         {/* Loading State - Position absolue centrée */}
//         {loading && (
//           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
//             <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p className="text-white text-lg">Chargement des données du graphe...</p>
//             </div>
//           </div>
//         )}

//         {/* Error State - Position absolue centrée */}
//         {error && (
//           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
//             <div className="bg-red-500/10 backdrop-blur-lg rounded-xl p-6 border border-red-500/20 max-w-md">
//               <div className="flex items-center space-x-3">
//                 <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
//                   <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                   </svg>
//                 </div>
//                 <div>
//                   <h3 className="text-red-400 font-semibold">Erreur de chargement</h3>
//                   <p className="text-red-300">{error}</p>
//                 </div>
//               </div>
//               <button
//                 onClick={() => fetchStaticGraphData()}
//                 className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
//               >
//                 Réessayer
//               </button>
//             </div>
//           </div>
//         )}


//         {/* Vagues animées */}
//         {/* <WaveAnimation /> */}
//       </div>
//     </GraphModeProvider>
//   );
// }

// // Composant pour gérer la connexion entre le context et la logique métier
// function ModeHandler({ onModeChange }: { onModeChange: (mode: GraphMode) => void }) {
//   const { setModeChangeHandler } = useGraphMode();
  
//   useEffect(() => {
//     setModeChangeHandler(onModeChange);
//   }, [onModeChange, setModeChangeHandler]);
  
//   return null;
// }
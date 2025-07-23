'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useGraphData } from '@/app/_components/graph/hooks/useGraphData';
import { 
  searchNodes,
  focusOnNode,
  centerGraph,
  getContainerDimensions,
  filterDataByCommunities,
  extractAvailableCommunities,
  createResetHandler,
  createSearchHandler,
  createSearchResultHandler,
  createCommunityHandlers,
  createSigmaGraph,
  createCenterGraphEffect
} from '@/lib/graph-utils';
import type { GraphNode, GraphData } from './types/graph';

// Import dynamique de Sigma.js pour éviter les problèmes SSR
const SigmaContainer = dynamic(
  () => import('@react-sigma/core').then(mod => mod.SigmaContainer),
  { ssr: false }
);

const ControlsContainer = dynamic(
  () => import('@react-sigma/core').then(mod => mod.ControlsContainer),
  { ssr: false }
);

const ZoomControl = dynamic(
  () => import('@react-sigma/core').then(mod => mod.ZoomControl),
  { ssr: false }
);

const FullScreenControl = dynamic(
  () => import('@react-sigma/core').then(mod => mod.FullScreenControl),
  { ssr: false }
);

export default function GraphPage() {
  const t = useTranslations('graph');
  
  // Utiliser le hook useGraphData avec toutes les fonctionnalités d'overlay
  const {
    staticGraphData,
    loading,
    error,
    fetchStaticGraphData,
    userNetworkData,
    userNetworkLoading,
    userNetworkError,
    showUserNetwork,
    fetchUserNetwork,
    toggleUserNetwork,
    createGraphWithOverlay,
    session
  } = useGraphData();
  
  const [filteredGraphData, setFilteredGraphData] = useState<GraphData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedCommunities, setSelectedCommunities] = useState<Set<number>>(new Set());
  const [availableCommunities, setAvailableCommunities] = useState<number[]>([]);
  const [showCommunityFilter, setShowCommunityFilter] = useState(false);
  
  const sigmaRef = useRef<any>(null);

  // Créer les handlers avec les utilitaires
  const resetHandler = createResetHandler();
  const searchHandler = createSearchHandler();
  const searchResultHandler = createSearchResultHandler();
  const communityHandlers = createCommunityHandlers();
  const centerGraphEffectHandler = createCenterGraphEffect();

  // Charger les données automatiquement au montage du composant
  useEffect(() => {
    fetchStaticGraphData();
  }, [fetchStaticGraphData]);

  // console.log("SESSION FROM PAGE IS --->", session);

  // Mettre à jour les données filtrées quand staticGraphData ou l'overlay change
  useEffect(() => {
    if (staticGraphData) {
      // Utiliser createGraphWithOverlay pour appliquer l'overlay si nécessaire
      const graphWithOverlay = createGraphWithOverlay(staticGraphData);
      setFilteredGraphData(graphWithOverlay);
      
      // Extraire les communautés disponibles (seulement au premier chargement)
      if (availableCommunities.length === 0) {
        const communityList = extractAvailableCommunities(staticGraphData);
        setAvailableCommunities(communityList);
        setSelectedCommunities(new Set(communityList));
      }
    }
  }, [staticGraphData, availableCommunities.length, showUserNetwork, userNetworkData]);

  // Nettoyer les contextes WebGL au démontage
  useEffect(() => {
    return () => {
      if (sigmaRef.current) {
        try {
          sigmaRef.current.kill();
        } catch (e) {
          // Ignore les erreurs de nettoyage
        }
      }
    };
  }, []);

  // Handler pour reset
  const handleReset = useCallback(() => {
    resetHandler.resetFilters({
      setFilteredGraphData,
      setSearchQuery,
      setSearchResults,
      setSelectedNodeId,
      setShowSearchResults,
      setSelectedCommunities,
      setAvailableCommunities,
      setShowCommunityFilter
    });
  }, [resetHandler]);

  // Handler pour la recherche avec debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchHandler.searchNodes(
        filteredGraphData,
        searchQuery,
        setSearchResults,
        setShowSearchResults
      );
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filteredGraphData, searchHandler]);

  // Handler pour focus sur un nœud
  const handleFocusOnNode = useCallback((nodeId: string) => {
    focusOnNode(sigmaRef.current, nodeId, selectedNodeId, setSelectedNodeId);
    setShowSearchResults(false);
  }, [selectedNodeId]);

  // Handler pour sélectionner un résultat de recherche
  const handleSelectSearchResult = useCallback((node: GraphNode) => {
    searchResultHandler.selectSearchResult(node, setSearchQuery, handleFocusOnNode);
  }, [searchResultHandler, handleFocusOnNode]);

  // Effet pour filtrer les données quand les communautés sélectionnées changent
  useEffect(() => {
    if (!staticGraphData) return;

    const filtered = filterDataByCommunities(
      staticGraphData,
      selectedCommunities,
      availableCommunities
    );
    
    if (filtered) {
      setFilteredGraphData(filtered);
    }
  }, [staticGraphData, selectedCommunities, availableCommunities]);

  // Handlers pour les communautés
  const handleToggleCommunity = useCallback((communityId: number) => {
    communityHandlers.toggleCommunity(
      communityId,
      selectedCommunities,
      setSelectedCommunities
    );
  }, [selectedCommunities, communityHandlers]);

  const handleSelectAllCommunities = useCallback(() => {
    communityHandlers.selectAllCommunities(
      availableCommunities,
      setSelectedCommunities
    );
  }, [availableCommunities, communityHandlers]);

  const handleDeselectAllCommunities = useCallback(() => {
    communityHandlers.deselectAllCommunities(setSelectedCommunities);
  }, [communityHandlers]);

  // Créer le graphe avec l'utilitaire
  const graph = useMemo(() => {
    return createSigmaGraph(filteredGraphData);
  }, [filteredGraphData]);

  // Obtenir les dimensions du container
  const containerDimensions = useMemo(() => {
    return getContainerDimensions(filteredGraphData);
  }, [filteredGraphData]);

  // Effet pour centrer et ajuster le zoom du graphe au chargement
  // useEffect(() => {
  //   centerGraphEffectHandler.centerGraphWithDelay(
  //     sigmaRef.current,
  //     filteredGraphData,
  //     200
  //   );
  // }, [filteredGraphData, centerGraphEffectHandler]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Visualisation de Graphe Social
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Explorez les connexions et communautés dans les réseaux sociaux
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-lg">Chargement des données du graphe...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-red-500/10 backdrop-blur-lg rounded-xl p-6 border border-red-500/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-red-400 font-semibold">Erreur de chargement</h3>
                  <p className="text-red-300">{error}</p>
                </div>
              </div>
              <button
                onClick={() => fetchStaticGraphData()}
                className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Success State - Graph Info */}
        {staticGraphData && !loading && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Graphe social chargé</p>
                    <p className="text-slate-300 text-sm">
                      {filteredGraphData?.nodes.length || 0} nœuds • {filteredGraphData?.edges.length || 0} arêtes
                      {availableCommunities.length > 0 && (
                        <span className="ml-2">• {availableCommunities.length} communautés</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Bouton pour afficher/masquer le réseau utilisateur */}
                  {session?.user && (
                    <button
                      onClick={toggleUserNetwork}
                      disabled={userNetworkLoading}
                      className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                        showUserNetwork
                          ? 'bg-purple-500 hover:bg-purple-600 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      } ${userNetworkLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {userNetworkLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Chargement...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{showUserNetwork ? 'Masquer mon réseau' : 'Mon réseau'}</span>
                        </div>
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Recharger
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contrôles du graphe */}
        {staticGraphData && !loading && (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Section Mon réseau */}
              {session?.user && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-semibold text-slate-800">Mon réseau</h3>
                  <div className="flex flex-col gap-3">
                    {/* Bouton toggle réseau utilisateur */}
                    <button
                      onClick={toggleUserNetwork}
                      disabled={userNetworkLoading}
                      className={`
                        flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                        ${showUserNetwork 
                          ? 'bg-blue-500 text-white hover:bg-blue-600' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }
                        ${userNetworkLoading ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {userNetworkLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          Chargement...
                        </>
                      ) : (
                        <>
                          {showUserNetwork ? '👁️ Masquer mon réseau' : '👥 Afficher mon réseau'}
                        </>
                      )}
                    </button>

                    {/* Informations sur le réseau */}
                    {userNetworkData && showUserNetwork && (
                      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                        <p><strong>Following:</strong> {userNetworkData.stats.totalFollowing}</p>
                        <p><strong>Followers:</strong> {userNetworkData.stats.totalFollowers}</p>
                        <p><strong>Trouvés dans le graphe:</strong> {userNetworkData.stats.foundInGraph}</p>
                      </div>
                    )}

                    {userNetworkError && (
                      <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        Erreur: {userNetworkError}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section Filtres de communauté */}
              {availableCommunities.length > 0 && (
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-800">Filtrer par communauté</h3>
                    <button
                      onClick={() => setShowCommunityFilter(!showCommunityFilter)}
                      className="text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      <svg 
                        className={`w-5 h-5 transform transition-transform ${showCommunityFilter ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {showCommunityFilter && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={handleSelectAllCommunities}
                          className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg transition-colors"
                        >
                          Tout sélectionner
                        </button>
                        <button
                          onClick={handleDeselectAllCommunities}
                          className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg transition-colors"
                        >
                          Tout désélectionner
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {availableCommunities.map(communityId => (
                          <label
                            key={communityId}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCommunities.has(communityId)}
                              onChange={() => handleToggleCommunity(communityId)}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-slate-700">Communauté {communityId}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Section Recherche */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Rechercher un nœud</h3>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom ou ID..."
                    className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  />
                  <svg 
                    className="absolute right-3 top-2.5 w-5 h-5 text-slate-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  
                  {/* Résultats de recherche */}
                  {showSearchResults && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 max-h-60 overflow-y-auto">
                      {searchResults.map(node => (
                        <button
                          key={node.id}
                          onClick={() => handleSelectSearchResult(node)}
                          className="w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors flex items-center justify-between"
                        >
                          <span className="font-medium text-slate-800">{node.label}</span>
                          <span className="text-xs text-slate-500">{node.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Graph container */}
        {staticGraphData && !loading && (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            <div 
              className="w-full relative"
              style={{
                aspectRatio: containerDimensions.aspectRatio,
                height: containerDimensions.height,
                minHeight: '400px',
                maxHeight: '90vh',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
              }}
            >
              <SigmaContainer
                ref={sigmaRef}
                graph={graph}
                settings={{
                  allowInvalidContainer: true,
                  renderLabels: true,
                  renderEdgeLabels: false,
                  defaultNodeColor: '#ec4899',
                  defaultEdgeColor: '#e2e8f0',
                  labelFont: 'Inter, system-ui, sans-serif',
                  labelSize: 12,
                  labelWeight: '500',
                  labelColor: { color: '#333' },
                  zIndex: true,
                  minCameraRatio: 0.05,
                  maxCameraRatio: 20,
                  labelDensity: 0.07,
                  labelGridCellSize: 60,
                  labelRenderedSizeThreshold: 8,
                  defaultEdgeType: 'line',
                  hideEdgesOnMove: true,
                  hideLabelsOnMove: true,
                }}
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '100%', 
                  width: '100%' 
                }}
              >
                {/* Contrôles Sigma - maintenant à l'intérieur du SigmaContainer */}
                <ControlsContainer position="bottom-right">
                  <ZoomControl />
                  <FullScreenControl />
                </ControlsContainer>
              </SigmaContainer>
            </div>
          </div>
        )}

        {/* Instructions */}
        {staticGraphData && !loading && (
          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              Cliquez et faites glisser pour naviguer • Utilisez la molette pour zoomer • Recherchez un username pour le localiser
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
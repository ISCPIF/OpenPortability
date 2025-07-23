'use client'

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useGraphData } from '@/app/_components/graph/hooks/useGraphData';
import { 
  searchNodes,
  focusOnNode,
  filterDataByCommunities,
  extractAvailableCommunities,
  createResetHandler,
  createSearchHandler,
  createSearchResultHandler,
  createCommunityHandlers,
} from '@/lib/graph-utils';
import type { GraphNode, GraphData } from '@/lib/types/graph';

// Nouveaux composants
import { GraphModeProvider } from '@/app/_components/graph/GraphModeProvider';
import Header from '@/app/_components/Header';
import { HamburgerMenu } from '@/app/_components/graph/HamburgerMenu';
import { StatsOverlay } from '@/app/_components/graph/StatsOverlay';
import { GraphLegendNew } from '@/app/_components/graph/GraphLegendNew';
import { SigmaGraphContainer } from '@/app/_components/graph/SigmaGraphContainer';
import { WaveAnimation } from '@/app/_components/graph/WaveAnimation';

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

  // Créer les handlers avec les utilitaires existants
  const resetHandler = createResetHandler();
  const searchHandler = createSearchHandler();
  const searchResultHandler = createSearchResultHandler();
  const communityHandlers = createCommunityHandlers();

  // Charger les données automatiquement au montage du composant
  useEffect(() => {
    fetchStaticGraphData();
  }, [fetchStaticGraphData]);

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
  }, [staticGraphData, availableCommunities.length, showUserNetwork, userNetworkData, createGraphWithOverlay]);

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
    setSelectedNodeId(nodeId);
    setShowSearchResults(false);
  }, []);

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

  // Handler pour la sélection de nœud
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  return (
    <GraphModeProvider>
      {/* Background avec dégradé archipel */}
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900 overflow-hidden">
        
        {/* Header transparent */}
        <Header />

        {/* Menu hamburger vertical */}
        <HamburgerMenu />

        {/* Stats overlay */}
        <StatsOverlay 
          graphData={filteredGraphData}
          userNetworkData={userNetworkData}
          showUserNetwork={showUserNetwork}
        />

        {/* Container principal du graphe */}
        <div className="pt-20 pb-32 px-4 md:px-8">
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

          {/* Contrôles du graphe - Version simplifiée pour le nouveau design */}
          {staticGraphData && !loading && (
            <div className="max-w-6xl mx-auto mb-8">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  
                  {/* Info du graphe */}
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">Archipel des connexions chargé</p>
                      <p className="text-slate-300 text-sm">
                        {filteredGraphData?.nodes.length || 0} îlots • {filteredGraphData?.edges.length || 0} liaisons
                        {availableCommunities.length > 0 && (
                          <span className="ml-2">• {availableCommunities.length} communautés</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Contrôles principaux */}
                  <div className="flex items-center space-x-3 ml-auto">
                    {/* Bouton réseau utilisateur */}
                    {session?.user && (
                      <button
                        onClick={toggleUserNetwork}
                        disabled={userNetworkLoading}
                        className={`px-4 py-2 rounded-full transition-colors font-medium ${
                          showUserNetwork
                            ? 'bg-pink-500 hover:bg-pink-600 text-white'
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
                            <span>⚓</span>
                            <span>{showUserNetwork ? 'Masquer mes amarres' : 'Mes amarres'}</span>
                          </div>
                        )}
                      </button>
                    )}

                    {/* Recherche rapide */}
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un îlot..."
                        className="w-64 px-4 py-2 pr-10 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                      />
                      <svg 
                        className="absolute right-3 top-2.5 w-5 h-5 text-white/60" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      
                      {/* Résultats de recherche */}
                      {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-lg rounded-lg shadow-lg border border-white/20 max-h-60 overflow-y-auto">
                          {searchResults.map(node => (
                            <button
                              key={node.id}
                              onClick={() => handleSelectSearchResult(node)}
                              className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                            >
                              <span className="font-medium text-slate-800">{node.label}</span>
                              <span className="text-xs text-slate-500">{node.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleReset}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors"
                    >
                      🔄 Recharger
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Container du graphe Sigma */}
          <div className="max-w-7xl mx-auto">
            <SigmaGraphContainer
              graphData={filteredGraphData}
              loading={loading}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
            />
          </div>

          {/* Instructions */}
          {staticGraphData && !loading && (
            <div className="mt-8 text-center">
              <p className="text-white/60 text-sm">
                🧭 Naviguez dans l'archipel des connexions • 🔍 Utilisez la recherche pour localiser un îlot • ⚓ Découvrez vos amarres
              </p>
            </div>
          )}
        </div>

        {/* Légende */}
        <GraphLegendNew />

        {/* Vagues animées */}
        <WaveAnimation />
      </div>
    </GraphModeProvider>
  );
}
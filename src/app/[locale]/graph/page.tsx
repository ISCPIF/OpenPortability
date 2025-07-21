'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useGraphData } from '@/app/_components/graph/hooks/useGraphData';

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

const useSigma = dynamic(
  () => import('@react-sigma/core').then(mod => mod.useSigma),
  { ssr: false }
);

import { MultiDirectedGraph } from 'graphology';

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  community?: number;
  degree?: number;
  language?: string;
  popularity?: number;
  name?: string;
}

interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  size?: number;
  color?: string;
  weight?: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function GraphPage() {
  // const t = useTranslations('Graph');
  
  // Utiliser le hook useGraphData avec toutes les fonctionnalités d'overlay
  const { 
    staticGraphData, 
    loading, 
    error, 
    fetchStaticGraphData,
    // Fonctionnalités overlay réseau utilisateur
    userNetworkData,
    userNetworkLoading,
    userNetworkError,
    showUserNetwork,
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

  // Charger les données automatiquement au montage du composant
  useEffect(() => {
    fetchStaticGraphData();
  }, [fetchStaticGraphData]);

  // Mettre à jour les données filtrées quand staticGraphData change
  useEffect(() => {
    if (staticGraphData) {
      setFilteredGraphData(staticGraphData);
      
      // Extraire les communautés disponibles
      const communities = new Set<number>();
      staticGraphData.nodes?.forEach((node: GraphNode) => {
        if (typeof node.community === 'number') {
          communities.add(node.community);
        }
      });
      const communityList = Array.from(communities).sort((a, b) => a - b);
      setAvailableCommunities(communityList);
      setSelectedCommunities(new Set(communityList));
    }
  }, [staticGraphData]);

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

  const handleReset = useCallback(() => {
    setFilteredGraphData(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedNodeId(null);
    setShowSearchResults(false);
    setSelectedCommunities(new Set());
    setAvailableCommunities([]);
    setShowCommunityFilter(false);
  }, []);


  const searchNodes = useCallback((query: string) => {
    if (!filteredGraphData || !query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const results = filteredGraphData.nodes.filter(node => 
      node.label.toLowerCase().includes(lowercaseQuery) ||
      node.id.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 10); // Limiter à 10 résultats

    setSearchResults(results);
    setShowSearchResults(results.length > 0);
  }, [filteredGraphData]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchNodes(searchQuery);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchNodes]);

  const focusOnNode = useCallback((nodeId: string) => {
    if (!sigmaRef.current) return;

    const sigma = sigmaRef.current;
    const graph = sigma.getGraph();
    
    // Réinitialiser tous les nœuds à leur état normal
    if (selectedNodeId) {
      try {
        const previousNode = graph.getNodeAttributes(selectedNodeId);
        graph.setNodeAttribute(selectedNodeId, 'size', previousNode.originalSize || previousNode.size / 2);
        graph.setNodeAttribute(selectedNodeId, 'color', previousNode.originalColor || previousNode.color);
        graph.setNodeAttribute(selectedNodeId, 'zIndex', 1);
      } catch (e) {
        // Le nœud précédent n'existe plus
      }
    }
    
    const node = graph.getNodeAttributes(nodeId);
    if (node) {
      // Sauvegarder les attributs originaux
      if (!node.originalSize) {
        graph.setNodeAttribute(nodeId, 'originalSize', node.size);
        graph.setNodeAttribute(nodeId, 'originalColor', node.color);
      }
      
      // Modifier les attributs du nœud sélectionné
      graph.setNodeAttribute(nodeId, 'size', node.originalSize * 2);
      graph.setNodeAttribute(nodeId, 'color', '#FFD700');
      graph.setNodeAttribute(nodeId, 'zIndex', 10);
      
      // Centrer la caméra
      sigma.getCamera().animate(
        { x: node.x, y: node.y, ratio: 0.5 },
        { duration: 1000 }
      );
      
      setSelectedNodeId(nodeId);
      setShowSearchResults(false);
      
      // Réinitialiser après 3 secondes
      setTimeout(() => {
        if (graph.hasNode(nodeId)) {
          graph.setNodeAttribute(nodeId, 'size', node.originalSize);
          graph.setNodeAttribute(nodeId, 'color', node.originalColor);
          graph.setNodeAttribute(nodeId, 'zIndex', 1);
        }
        setSelectedNodeId(null);
      }, 3000);
    }
  }, [selectedNodeId]);

  const selectSearchResult = useCallback((node: GraphNode) => {
    setSearchQuery(node.label);
    focusOnNode(node.id);
  }, [focusOnNode]);

  // Effet pour filtrer les données quand les communautés sélectionnées changent
// {{ ... }}

  // Mettre à jour les données filtrées quand staticGraphData ou l'overlay change
  useEffect(() => {
    if (staticGraphData) {
      // Utiliser createGraphWithOverlay pour appliquer l'overlay si nécessaire
      const graphWithOverlay = createGraphWithOverlay(staticGraphData);
      setFilteredGraphData(graphWithOverlay);
      
      // Extraire les communautés disponibles (seulement au premier chargement)
      if (availableCommunities.length === 0) {
        const communities = new Set<number>();
        staticGraphData.nodes?.forEach((node: GraphNode) => {
          if (typeof node.community === 'number') {
            communities.add(node.community);
          }
        });
        const communityList = Array.from(communities).sort((a, b) => a - b);
        setAvailableCommunities(communityList);
        setSelectedCommunities(new Set(communityList));
      }
    }
  }, [staticGraphData, createGraphWithOverlay, availableCommunities.length]);

  const toggleCommunity = useCallback((communityId: number) => {
    setSelectedCommunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(communityId)) {
        newSet.delete(communityId);
      } else {
        newSet.add(communityId);
      }
      return newSet;
    });
  }, []);

  const selectAllCommunities = useCallback(() => {
    setSelectedCommunities(new Set(availableCommunities));
  }, [availableCommunities]);

  const deselectAllCommunities = useCallback(() => {
    setSelectedCommunities(new Set());
  }, []);

  // {{ ... }}

  // Mettre à jour les données filtrées quand staticGraphData ou l'overlay change
  useEffect(() => {
    if (staticGraphData) {
      // Utiliser createGraphWithOverlay pour appliquer l'overlay si nécessaire
      const graphWithOverlay = createGraphWithOverlay(staticGraphData);
      setFilteredGraphData(graphWithOverlay);
      
      // Extraire les communautés disponibles (seulement au premier chargement)
      if (availableCommunities.length === 0) {
        const communities = new Set<number>();
        staticGraphData.nodes?.forEach((node: GraphNode) => {
          if (typeof node.community === 'number') {
            communities.add(node.community);
          }
        });
        const communityList = Array.from(communities).sort((a, b) => a - b);
        setAvailableCommunities(communityList);
        setSelectedCommunities(new Set(communityList));
      }
    }
  }, [staticGraphData, createGraphWithOverlay, availableCommunities.length]);


  // Créer le graphe (simplifié car l'overlay est géré dans le hook)
  const createGraph = useMemo(() => {
    if (!filteredGraphData) return new MultiDirectedGraph();

    const graph = new MultiDirectedGraph();
    
    // Ajouter tous les nœuds (avec overlay déjà appliqué)
    filteredGraphData.nodes.forEach(node => {
      // Filtrer l'attribut 'type' qui peut causer des problèmes avec Sigma.js
      const { type, ...nodeAttributes } = node as any;
      
      graph.addNode(node.id, {
        ...nodeAttributes,
        originalSize: node.size,
        originalColor: node.color,
        zIndex: node.zIndex || 1
      });
    });

    // Ajouter les arêtes si disponibles
    if (filteredGraphData.edges) {
      filteredGraphData.edges.forEach(edge => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            size: edge.size || 0.5,
            color: edge.color || '#E0E0E0',
            zIndex: 0
          });
        }
      });
    }

    return graph;
  }, [filteredGraphData]);

  const CommunityFilter = () => (
    <div className="mb-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium flex items-center">
            Filtrer par communautés
            <span className="ml-2 text-sm text-slate-300">
              ({selectedCommunities.size}/{availableCommunities.length} sélectionnées)
            </span>
          </h3>
          <button
            onClick={() => setShowCommunityFilter(!showCommunityFilter)}
            className="text-white hover:text-blue-300 transition-colors"
          >
            {showCommunityFilter ? '▼' : '▶'}
          </button>
        </div>
        
        {showCommunityFilter && (
          <div className="space-y-4">
            {/* Boutons de contrôle */}
            <div className="flex space-x-2">
              <button
                onClick={selectAllCommunities}
                className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm transition-colors"
              >
                Tout sélectionner
              </button>
              <button
                onClick={deselectAllCommunities}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
              >
                Tout désélectionner
              </button>
            </div>
            
            {/* Liste des communautés */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {availableCommunities.map(communityId => {
                const isSelected = selectedCommunities.has(communityId);
                const communityNodes = staticGraphData?.nodes.filter(n => n.community === communityId) || [];
                const communityColor = communityNodes[0]?.color || '#808080';
                
                return (
                  <button
                    key={communityId}
                    onClick={() => toggleCommunity(communityId)}
                    className={`p-2 rounded-lg border transition-all ${
                      isSelected 
                        ? 'border-white/40 bg-white/20' 
                        : 'border-white/20 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-white/30"
                        style={{ backgroundColor: communityColor }}
                      />
                      <div className="text-left">
                        <div className="text-white text-sm font-medium">
                          C{communityId}
                        </div>
                        <div className="text-slate-300 text-xs">
                          {communityNodes.length} nœuds
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Statistiques */}
            {filteredGraphData && (
              <div className="pt-2 border-t border-white/20">
                <div className="text-slate-300 text-sm">
                  Affichage: {filteredGraphData.nodes.length} nœuds, {filteredGraphData.edges.length} arêtes
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const SearchBar = () => (
    <div className="relative mb-6">
      <div className="relative">
        <input
          type="text"
          placeholder="Rechercher un username ou un ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 pl-12 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl text-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-300">
          🔍
        </div>
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowSearchResults(false);
              setSelectedNodeId(null);
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-300 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {showSearchResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 max-h-60 overflow-y-auto z-50">
          {searchResults.map((node, index) => (
            <button
              key={node.id}
              onClick={() => selectSearchResult(node)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{node.label}</div>
                  <div className="text-sm text-gray-500">ID: {node.id}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: node.color }}
                  ></div>
                  <span className="text-xs text-gray-400">
                    Taille: {node.size}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showSearchResults && searchResults.length === 0 && searchQuery.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/20 p-4 z-50">
          <div className="text-gray-500 text-center">
            Aucun résultat trouvé pour "{searchQuery}"
          </div>
        </div>
      )}
    </div>
  );

  // Effet pour centrer et ajuster le zoom du graphe au chargement
  useEffect(() => {
    if (!sigmaRef.current || !filteredGraphData || filteredGraphData.nodes.length === 0) return;

    const sigma = sigmaRef.current;
    
    // Attendre que le graphe soit rendu
    setTimeout(() => {
      try {
        // Centrer la caméra sur le graphe
        const camera = sigma.getCamera();
        
        // Calculer les bounds du graphe
        const nodes = filteredGraphData.nodes;
        if (nodes.length === 0) return;
        
        const bounds = nodes.reduce((acc, node) => ({
          minX: Math.min(acc.minX, node.x),
          maxX: Math.max(acc.maxX, node.x),
          minY: Math.min(acc.minY, node.y),
          maxY: Math.max(acc.maxY, node.y)
        }), {
          minX: nodes[0].x,
          maxX: nodes[0].x,
          minY: nodes[0].y,
          maxY: nodes[0].y
        });
        
        // Calculer le centre
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        // Calculer les dimensions du graphe
        const graphWidth = bounds.maxX - bounds.minX;
        const graphHeight = bounds.maxY - bounds.minY;
        
        // Obtenir les dimensions du container
        const container = sigma.getContainer();
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        
        // Calculer les ratios nécessaires pour chaque dimension
        const ratioX = graphWidth > 0 ? (graphWidth * 1.3) / containerWidth : 1;
        const ratioY = graphHeight > 0 ? (graphHeight * 1.3) / containerHeight : 1;
        
        // Prendre le ratio le plus grand pour s'assurer que tout est visible
        const finalRatio = Math.max(ratioX, ratioY, 0.05);
        
        console.log('Auto-zoom:', {
          graphWidth, graphHeight,
          containerWidth, containerHeight,
          ratioX, ratioY, finalRatio
        });
        
        // Animer vers la position centrée
        camera.animate(
          { x: centerX, y: centerY, ratio: finalRatio },
          { duration: 1500, easing: 'quadraticOut' }
        );
      } catch (error) {
        console.warn('Erreur lors du centrage automatique:', error);
      }
    }, 200);
  }, [filteredGraphData]);

  const getContainerDimensions = useMemo(() => {
    if (!filteredGraphData || filteredGraphData.nodes.length === 0) {
      return { height: '600px', aspectRatio: 'auto' };
    }

    const nodes = filteredGraphData.nodes;
    const bounds = nodes.reduce((acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      maxX: Math.max(acc.maxX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxY: Math.max(acc.maxY, node.y)
    }), {
      minX: nodes[0].x,
      maxX: nodes[0].x,
      minY: nodes[0].y,
      maxY: nodes[0].y
    });

    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;
    
    // Calculer l'aspect ratio du graphe
    const graphAspectRatio = graphWidth > 0 && graphHeight > 0 ? graphWidth / graphHeight : 1;
    
    // Limiter l'aspect ratio pour éviter des containers trop extrêmes
    const clampedAspectRatio = Math.max(0.5, Math.min(2.5, graphAspectRatio));
    
    console.log('Container dimensions:', {
      graphWidth, graphHeight, 
      graphAspectRatio, 
      clampedAspectRatio
    });

    return {
      aspectRatio: clampedAspectRatio,
      height: 'auto'
    };
  }, [filteredGraphData]);

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
                <button
                  onClick={handleReset}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  🔄 Recharger
                </button>
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
                aspectRatio: getContainerDimensions.aspectRatio,
                height: getContainerDimensions.height,
                minHeight: '400px',
                maxHeight: '90vh',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
              }}
            >
              <SigmaContainer
                ref={sigmaRef}
                graph={createGraph}
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
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        {staticGraphData && !loading && (
          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              🖱️ Cliquez et faites glisser pour naviguer • 🔍 Utilisez la molette pour zoomer • 🔍 Recherchez un username pour le localiser
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
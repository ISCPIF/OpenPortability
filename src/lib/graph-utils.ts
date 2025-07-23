import { GraphNode, GraphData } from './types/graph';

// Utilitaires pour la recherche de nœuds
export const searchNodes = (graphData: GraphData | null, query: string): GraphNode[] => {
  if (!graphData || !query.trim()) {
    return [];
  }

  const lowercaseQuery = query.toLowerCase();
  return graphData.nodes.filter(node => 
    node.label.toLowerCase().includes(lowercaseQuery) ||
    node.id.toLowerCase().includes(lowercaseQuery)
  ).slice(0, 10); // Limiter à 10 résultats
};

// Utilitaires pour le focus sur un nœud
export const focusOnNode = (
  sigma: any,
  nodeId: string,
  selectedNodeId: string | null,
  onNodeSelect: (nodeId: string | null) => void
) => {
  if (!sigma) return;

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
    
    onNodeSelect(nodeId);
    
    // Réinitialiser après 3 secondes
    setTimeout(() => {
      if (graph.hasNode(nodeId)) {
        graph.setNodeAttribute(nodeId, 'size', node.originalSize);
        graph.setNodeAttribute(nodeId, 'color', node.originalColor);
        graph.setNodeAttribute(nodeId, 'zIndex', 1);
      }
      onNodeSelect(null);
    }, 3000);
  }
};

// Utilitaires pour le centrage automatique du graphe
export const centerGraph = (sigma: any, graphData: GraphData | null) => {
  if (!sigma || !graphData || graphData.nodes.length === 0) return;

  try {
    const camera = sigma.getCamera();
    
    // Approche simple : centrer sur le point (0,0) avec un zoom par défaut
    // Cela devrait fonctionner de manière similaire à focusOnNode
    camera.animate(
      { x: 0, y: 0, ratio: 1 },
      { duration: 1500, easing: 'quadraticOut' }
    );
  } catch (error) {
    console.warn('Erreur lors du centrage automatique:', error);
  }
};

// Utilitaires pour les dimensions du container
export const getContainerDimensions = (graphData: GraphData | null) => {
  if (!graphData || graphData.nodes.length === 0) {
    return { height: '600px', aspectRatio: 'auto' };
  }

  const nodes = graphData.nodes;
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

  return {
    aspectRatio: clampedAspectRatio,
    height: 'auto'
  };
};

// Utilitaires pour filtrer les données par communauté
export const filterDataByCommunities = (
  staticGraphData: GraphData | null,
  selectedCommunities: Set<number>,
  availableCommunities: number[]
): GraphData | null => {
  if (!staticGraphData) return null;

  if (selectedCommunities.size === 0 || selectedCommunities.size === availableCommunities.length) {
    // Aucune communauté sélectionnée ou toutes sélectionnées = afficher tout
    return staticGraphData;
  }

  // Filtrer les nœuds selon les communautés sélectionnées
  const filteredNodes = staticGraphData.nodes.filter(node => {
    return typeof node.community === 'number' && selectedCommunities.has(node.community);
  });

  // Filtrer les arêtes pour ne garder que celles entre nœuds visibles
  const visibleNodeIds = new Set(filteredNodes.map(node => node.id));
  const filteredEdges = staticGraphData.edges.filter(edge => 
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges
  };
};

// Utilitaires pour extraire les communautés disponibles
export const extractAvailableCommunities = (graphData: GraphData | null): number[] => {
  if (!graphData) return [];

  const communities = new Set<number>();
  graphData.nodes?.forEach((node: GraphNode) => {
    if (typeof node.community === 'number') {
      communities.add(node.community);
    }
  });
  
  return Array.from(communities).sort((a, b) => a - b);
};

// Utilitaires pour la gestion des états (callbacks)
export const createResetHandler = () => {
  return {
    resetFilters: (setState: {
      setFilteredGraphData: (data: GraphData | null) => void;
      setSearchQuery: (query: string) => void;
      setSearchResults: (results: GraphNode[]) => void;
      setSelectedNodeId: (id: string | null) => void;
      setShowSearchResults: (show: boolean) => void;
      setSelectedCommunities: (communities: Set<number>) => void;
      setAvailableCommunities: (communities: number[]) => void;
      setShowCommunityFilter: (show: boolean) => void;
    }) => {
      setState.setFilteredGraphData(null);
      setState.setSearchQuery('');
      setState.setSearchResults([]);
      setState.setSelectedNodeId(null);
      setState.setShowSearchResults(false);
      setState.setSelectedCommunities(new Set());
      setState.setAvailableCommunities([]);
      setState.setShowCommunityFilter(false);
    }
  };
};

// Utilitaires pour la recherche avec debounce
export const createSearchHandler = () => {
  return {
    searchNodes: (
      graphData: GraphData | null, 
      query: string,
      setSearchResults: (results: GraphNode[]) => void,
      setShowSearchResults: (show: boolean) => void
    ) => {
      if (!graphData || !query.trim()) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      const lowercaseQuery = query.toLowerCase();
      const results = graphData.nodes.filter(node => 
        node.label.toLowerCase().includes(lowercaseQuery) ||
        node.id.toLowerCase().includes(lowercaseQuery)
      ).slice(0, 10); // Limiter à 10 résultats

      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    }
  };
};

// Utilitaires pour la sélection de résultats de recherche
export const createSearchResultHandler = () => {
  return {
    selectSearchResult: (
      node: GraphNode,
      setSearchQuery: (query: string) => void,
      focusCallback: (nodeId: string) => void
    ) => {
      setSearchQuery(node.label);
      focusCallback(node.id);
    }
  };
};

// Utilitaires pour la gestion des communautés
export const createCommunityHandlers = () => {
  return {
    toggleCommunity: (
      communityId: number,
      selectedCommunities: Set<number>,
      setSelectedCommunities: (communities: Set<number>) => void
    ) => {
      const newSet = new Set(selectedCommunities);
      if (newSet.has(communityId)) {
        newSet.delete(communityId);
      } else {
        newSet.add(communityId);
      }
      setSelectedCommunities(newSet);
    },

    selectAllCommunities: (
      availableCommunities: number[],
      setSelectedCommunities: (communities: Set<number>) => void
    ) => {
      setSelectedCommunities(new Set(availableCommunities));
    },

    deselectAllCommunities: (
      setSelectedCommunities: (communities: Set<number>) => void
    ) => {
      setSelectedCommunities(new Set());
    }
  };
};

// Utilitaires pour créer le graphe Sigma
export const createSigmaGraph = (filteredGraphData: GraphData | null) => {
  // Import dynamique pour éviter les problèmes SSR
  const { MultiDirectedGraph } = require('graphology');
  
  if (!filteredGraphData) return new MultiDirectedGraph();

  const graph = new MultiDirectedGraph();
  
  // Ajouter tous les nœuds (avec overlay déjà appliqué)
  filteredGraphData.nodes.forEach(node => {
    const { type, ...nodeAttributes } = node as any;
    
    graph.addNode(node.id, {
      ...nodeAttributes,
      // Ne pas inclure de type du tout
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
};

// Utilitaires pour l'effet de centrage automatique
export const createCenterGraphEffect = () => {
  return {
    centerGraphWithDelay: (
      sigma: any,
      filteredGraphData: GraphData | null,
      delay: number = 200
    ) => {
      if (!sigma || !filteredGraphData || filteredGraphData.nodes.length === 0) return;
      
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
          
          // console.log('Auto-zoom:', {
          //   graphWidth, graphHeight,
          //   containerWidth, containerHeight,
          //   ratioX, ratioY, finalRatio
          // });
          
          // Animer vers la position centrée
          camera.animate(
            { x: centerX, y: centerY, ratio: finalRatio },
            { duration: 1500, easing: 'quadraticOut' }
          );
        } catch (error) {
          console.warn('Erreur lors du centrage automatique:', error);
        }
      }, delay);
    }
  };
};

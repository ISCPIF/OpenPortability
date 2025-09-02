// src/components/graph/ConnectionGraph.tsx
'use client';

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Graph from 'graphology';
import { circular } from 'graphology-layout';

// Components
import GraphControls from './GraphControls';
import AdvancedControls from './AdvancedControls';
import NodeDetails from './NodeDetails';
import GraphLegend from './GraphLegend';
import CommunityAnalysisPanel from './CommunityAnalysisPanel';
import { LoadingSpinner, ErrorDisplay, EmptyState, AuthRequired } from './LoadingStates';

// Hooks
import { useGraphData } from './hooks/useGraphData';
import { useSigma } from './hooks/useSigma';
import { useGraphSettings } from './hooks/useGraphSettings';

// Utils
import { 
  processGraphData, 
  applyForceLayout, 
  detectCommunities,
  setupSigmaPolyfill 
} from './utils/graphUtils';

// Types & Constants
import { GraphData, GraphNode, LayoutType } from './types';
import { COMMUNITY_COLORS, NODE_COLORS, EDGE_COLORS } from './constants';

// Initialiser le polyfill
setupSigmaPolyfill();

export default function ConnectionGraph() {
  const t = useTranslations('graph');
  
  // Hooks personnalisés
  const {
    session,
    graphData,
    setGraphData,
    anonymousData,
    personalData,
    loading,
    error,
    setError,
    fetchData,
    fetchAnonymousData
  } = useGraphData();

  const {
    selectedNode,
    setSelectedNode,
    sigmaReady,
    setSigmaReady,
    containerRef,
    sigmaInstance,
    initializingRef,
    cleanup
  } = useSigma();

  const {
    connectionType,
    limit,
    layoutType,
    showOnlyConnections,
    minConnections,
    hideUserNode,
    graphMode,
    setGraphMode,
    handleTypeChange,
    handleLimitChange,
    setLayoutType,
    setShowOnlyConnections,
    setMinConnections,
    setHideUserNode
  } = useGraphSettings();

  // État pour le toggle d'analyse des communautés - défini sur community_analysis par défaut
  const [analysisType, setAnalysisType] = useState<'basic' | 'community_analysis'>('community_analysis');
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  
  // Nouveaux états pour contrôler la lisibilité
  const [showLabels, setShowLabels] = useState(false); // Désactivé par défaut pour la lisibilité
  const [labelDensity, setLabelDensity] = useState(0.02); // Très faible par défaut
  const [nodeOpacity, setNodeOpacity] = useState(0.8);

  // Traiter les données pour supprimer les labels et créer processedData
  const processedData = useMemo(() => {
    if (!graphData) return null;
    
    // Traitement des nœuds - supprimer les labels "Utilisateur [code]"
    const nodes = graphData.nodes.map((node: any) => ({
      ...node,
      label: '', // Supprimer complètement les labels
      size: Math.max(8, Math.min(20, Math.sqrt(node.connections || 1) * 3)),
    }));

    // Traitement des communautés si elles existent
    const communities = graphData.community_analysis || [];

    return {
      nodes,
      edges: graphData.edges || [],
      communities,
      metadata: graphData.metadata || {}
    };
  }, [graphData]);

  // Mettre à jour graphData quand les données changent
  useEffect(() => {
    if (session?.user && personalData) {
      setGraphData(personalData);
    } else if (!session?.user && anonymousData) {
      setGraphData(anonymousData);
    }
  }, [session?.user, personalData, anonymousData, setGraphData]);

  // Gestionnaire de layout
  const applyLayout = useCallback((graph: Graph, layout: LayoutType, actualWidth: number, actualHeight: number) => {
    if (graph.order === 0) return;

    try {
      switch (layout) {
        case 'force':
          applyForceLayout(graph, 80);
          break;
        case 'community':
          applyCommunityLayout(graph, actualWidth, actualHeight);
          break;
        default:
          circular.assign(graph);
      }
    } catch (e) {
      console.warn("Layout error:", e);
      circular.assign(graph);
    }
  }, []);

  // Layout par communautés avec espacement drastiquement amélioré
  const applyCommunityLayout = useCallback((graph: Graph, actualWidth: number, actualHeight: number) => {
    const communities = new Map<number, GraphNode[]>();
    
    if (!processedData) return;
    
    processedData.nodes.forEach(node => {
      const community = node.community || 0;
      if (!communities.has(community)) {
        communities.set(community, []);
      }
      communities.get(community)?.push(node);
    });
    
    const numCommunities = communities.size;
    const centerX = actualWidth / 2;
    const centerY = actualHeight / 2;
    
    // ÉNORMÉMENT plus d'espace entre les communautés
    const majorRadius = Math.min(actualWidth, actualHeight) * 0.45; // Augmenté de 0.35 à 0.45
    const minCommunityDistance = 150; // Distance minimale entre communautés
    
    let communityIndex = 0;
    communities.forEach((nodes, communityId) => {
      // Disposition avec BEAUCOUP plus d'espace
      let communityCenterX, communityCenterY;
      
      if (numCommunities <= 4) {
        // Disposition aux 4 coins pour 4 communautés ou moins
        const positions = [
          [centerX - majorRadius, centerY - majorRadius], // Top-left
          [centerX + majorRadius, centerY - majorRadius], // Top-right
          [centerX - majorRadius, centerY + majorRadius], // Bottom-left
          [centerX + majorRadius, centerY + majorRadius]  // Bottom-right
        ];
        const pos = positions[communityIndex % 4];
        communityCenterX = pos[0];
        communityCenterY = pos[1];
      } else if (numCommunities <= 8) {
        // Disposition octogonale pour plus de communautés
        const angle = (2 * Math.PI * communityIndex) / numCommunities;
        communityCenterX = centerX + majorRadius * Math.cos(angle);
        communityCenterY = centerY + majorRadius * Math.sin(angle);
      } else {
        // Disposition en grille avec plus d'espace
        const cols = Math.ceil(Math.sqrt(numCommunities));
        const rows = Math.ceil(numCommunities / cols);
        const col = communityIndex % cols;
        const row = Math.floor(communityIndex / cols);
        
        const cellWidth = actualWidth / cols;
        const cellHeight = actualHeight / rows;
        
        communityCenterX = cellWidth * (col + 0.5);
        communityCenterY = cellHeight * (row + 0.5);
      }
      
      // Radius adaptatif BEAUCOUP plus grand pour éviter les superpositions
      const baseRadius = Math.sqrt(nodes.length) * 25; // Augmenté de 15 à 25
      const minorRadius = Math.max(50, Math.min(baseRadius, 200)); // Min 50, max 200
      
      nodes.forEach((node, nodeIndex) => {
        let x, y;
        
        if (nodes.length === 1) {
          // Nœud seul au centre de sa zone
          x = communityCenterX;
          y = communityCenterY;
        } else if (nodes.length <= 6) {
          // Disposition circulaire avec PLUS d'espace pour petites communautés
          const nodeAngle = (2 * Math.PI * nodeIndex) / nodes.length;
          x = communityCenterX + minorRadius * Math.cos(nodeAngle);
          y = communityCenterY + minorRadius * Math.sin(nodeAngle);
        } else if (nodes.length <= 20) {
          // Disposition en double cercle pour communautés moyennes
          const innerRadius = minorRadius * 0.5;
          const outerRadius = minorRadius;
          const isOuter = nodeIndex % 2 === 0;
          const radius = isOuter ? outerRadius : innerRadius;
          const angleOffset = isOuter ? 0 : Math.PI / nodes.length;
          const nodeAngle = (2 * Math.PI * nodeIndex) / nodes.length + angleOffset;
          
          x = communityCenterX + radius * Math.cos(nodeAngle);
          y = communityCenterY + radius * Math.sin(nodeAngle);
        } else {
          // Disposition en spirale ÉLARGIE pour grandes communautés
          const spiralAngle = nodeIndex * 0.8; // Plus d'espacement dans la spirale
          const spiralRadius = minorRadius * Math.sqrt(nodeIndex / nodes.length) * 1.5;
          x = communityCenterX + spiralRadius * Math.cos(spiralAngle);
          y = communityCenterY + spiralRadius * Math.sin(spiralAngle);
        }
        
        // PLUS de variation aléatoire pour éviter les alignements parfaits
        x += (Math.random() - 0.5) * 40; // Augmenté de 20 à 40
        y += (Math.random() - 0.5) * 40;
        
        // S'assurer que les nœuds restent dans les limites avec plus de marge
        x = Math.max(80, Math.min(actualWidth - 80, x)); // Augmenté de 50 à 80
        y = Math.max(80, Math.min(actualHeight - 80, y));
        
        if (graph.hasNode(node.id)) {
          graph.setNodeAttribute(node.id, 'x', x);
          graph.setNodeAttribute(node.id, 'y', y);
        }
      });
      communityIndex++;
    });
  }, [processedData]);

  // Initialisation de Sigma
  const initSigma = useCallback(async () => {
    if (initializingRef.current || !graphData || !containerRef.current) {
      return;
    }

    initializingRef.current = true;
    cleanup();

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!containerRef.current || !graphData) {
        initializingRef.current = false;
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const actualHeight = rect.height;
      const actualWidth = rect.width;
      
      if (actualHeight < 300 || actualWidth < 200) {
        initializingRef.current = false;
        setTimeout(() => initSigma(), 500);
        return;
      }

      const processedGraphData = processGraphData(graphData, showOnlyConnections, minConnections, hideUserNode);
      const graph = new Graph({ type: 'undirected' });
      
      // Ajouter les nœuds
      const addedNodes = new Set<string>();
      processedGraphData.nodes.forEach(node => {
        if (!addedNodes.has(node.id)) {
          addedNodes.add(node.id);
          
          // Calcul plus intelligent de la taille des nœuds
          const baseSize = node.type === 'user' ? 40 : 15;
          const connectionBonus = Math.min(25, Math.log(node.connection_count + 1) * 5);
          const finalSize = baseSize + connectionBonus;
          
          // Couleurs améliorées pour les communautés
          const nodeColor = node.community !== undefined 
            ? getCommunityColor(node.community)
            : node.type === 'user' 
              ? '#8b5cf6' 
              : '#64748b';
          
          graph.addNode(node.id, {
            label: node.label,
            size: finalSize,
            color: nodeColor,
            x: Math.random() * actualWidth,
            y: Math.random() * actualHeight,
            community: node.community,
            connection_count: node.connection_count,
            // Propriétés pour le rendu amélioré
            borderColor: node.type === 'user' ? '#ffffff' : 'rgba(255,255,255,0.3)',
            borderSize: node.type === 'user' ? 3 : 1
          });
        }
      });
      
      // Ajouter les arêtes
      const addedEdges = new Set<string>();
      processedGraphData.edges.forEach(edge => {
        const edgeKey = `${edge.source}-${edge.target}`;
        const reverseEdgeKey = `${edge.target}-${edge.source}`;
        
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target) && 
            !addedEdges.has(edgeKey) && !addedEdges.has(reverseEdgeKey)) {
          try {
            graph.addEdge(edge.source, edge.target, {
              color: edge.color || EDGE_COLORS[edge.type],
              size: edge.color === EDGE_COLORS.mutual ? 2.5 : 1.5
            });
            addedEdges.add(edgeKey);
          } catch (e) {
            console.warn(`Cannot add edge ${edge.source} -> ${edge.target}:`, e);
          }
        }
      });
      
      // Appliquer le layout
      applyLayout(graph, layoutType, actualWidth, actualHeight);

      const SigmaModule = await import('sigma');
      const Sigma = SigmaModule.default || SigmaModule;
      
      if (!containerRef.current) {
        initializingRef.current = false;
        return;
      }

      // Configuration Sigma SIMPLIFIÉE - pas de labels utilisateur
      sigmaInstance.current = new Sigma(graph, containerRef.current, {
        renderEdgeLabels: false,
        defaultNodeColor: '#e5e7eb',
        defaultEdgeColor: '#f3f4f6',
        allowInvalidContainer: true,
        enableEdgeEvents: true,
        // PAS DE LABELS pour éviter l'encombrement
        labelDensity: 0, // Complètement désactivé
        labelRenderedSizeThreshold: 999, // Jamais afficher les labels
        minCameraRatio: 0.1,
        maxCameraRatio: 10,
        // Réduire l'épaisseur des edges
        defaultEdgeType: 'line',
        edgeReducer: (edge: any, data: any) => ({
          ...data,
          size: data.size * 0.3 // Très fins pour ne pas encombrer
        }),
      });
      
      // Event listeners
      sigmaInstance.current.on('clickNode', (event: any) => {
        const nodeId = event.node;
        const nodeData = processedGraphData.nodes.find(n => n.id === nodeId);
        if (nodeData) {
          setSelectedNode(nodeData);
        }
      });
      
      sigmaInstance.current.on('clickStage', () => {
        setSelectedNode(null);
      });

      setSigmaReady(true);
      initializingRef.current = false;
      
    } catch (e) {
      console.error("Sigma initialization error:", e);
      setError("Erreur d'initialisation: " + (e instanceof Error ? e.message : String(e)));
      initializingRef.current = false;
    }
  }, [graphData, layoutType, showOnlyConnections, minConnections, hideUserNode, cleanup, applyLayout, setSelectedNode, setSigmaReady, setError]);

  // Fonction pour charger les données avec le type d'analyse spécifié
  const loadGraphData = useCallback((type: 'basic' | 'community_analysis') => {
    setAnalysisType(type);
    if (graphMode === 'anonymous') {
      fetchAnonymousData(limit, minConnections, type);
    } else {
      fetchData(connectionType, limit);
    }
  }, [graphMode, fetchAnonymousData, fetchData, limit, minConnections, connectionType]);

  // Effet pour charger les données initiales - UNE SEULE FOIS
  useEffect(() => {
    // Chargement initial des données
    if (session?.user) {
      console.log('Loading personal data for authenticated user');
      fetchData(connectionType, limit);
    } else {
      console.log('Loading anonymous data with analysis type:', analysisType);
      fetchAnonymousData(limit, minConnections, analysisType);
    }
  }, [session?.user]); // Seulement quand l'état d'authentification change

  // Effet pour initialiser Sigma quand les données sont prêtes
  useEffect(() => {
    if (graphData && !loading && !error) {
      console.log('Initializing Sigma with graph data');
      initSigma();
    }
  }, [graphData, loading, error, initSigma]);

  // Effet pour actualiser les données quand les paramètres changent (avec debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (session?.user) {
        console.log('Updating personal data due to parameter change');
        fetchData(connectionType, limit);
      } else {
        console.log('Updating anonymous data due to parameter change');
        fetchAnonymousData(limit, minConnections, analysisType);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [connectionType, limit, minConnections, analysisType]); // Quand les paramètres changent

  // Gestionnaires d'événements
  const handleRetry = useCallback(() => {
    setError(null);
    initSigma();
  }, [setError, initSigma]);

  const handleNodeSelectionReset = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleSelectCommunity = useCallback((communityId: number | null) => {
    setSelectedCommunity(communityId);
    
    // Si une communauté est sélectionnée, mettre en évidence les nœuds correspondants
    if (communityId !== null && sigmaInstance.current) {
      sigmaInstance.current.graph.forEachNode((node, attributes) => {
        const nodeSize = attributes.size || 5;
        const isInSelectedCommunity = attributes.community === communityId;
        
        sigmaInstance.current.graph.setNodeAttribute(node, 'size', isInSelectedCommunity ? nodeSize * 1.5 : nodeSize);
        sigmaInstance.current.graph.setNodeAttribute(node, 'highlighted', isInSelectedCommunity);
        sigmaInstance.current.graph.setNodeAttribute(
          node, 
          'color', 
          isInSelectedCommunity 
            ? getCommunityColor(communityId)
            : attributes.community !== undefined 
              ? getCommunityColor(attributes.community) 
              : '#d6356f'
        );
      });
      
      // Mettre à jour les arêtes pour mettre en évidence celles dans la communauté
      sigmaInstance.current.graph.forEachEdge((edge, attributes, source, target) => {
        const sourceAttrs = sigmaInstance.current.graph.getNodeAttributes(source);
        const targetAttrs = sigmaInstance.current.graph.getNodeAttributes(target);
        const isInSelectedCommunity = 
          sourceAttrs.community === communityId && 
          targetAttrs.community === communityId;
        
        sigmaInstance.current.graph.setEdgeAttribute(edge, 'color', isInSelectedCommunity ? getCommunityColor(communityId) : '#e2e8f0');
        sigmaInstance.current.graph.setEdgeAttribute(edge, 'size', isInSelectedCommunity ? 2 : 1);
      });
    } else if (sigmaInstance.current) {
      // Réinitialiser les attributs si aucune communauté n'est sélectionnée
      sigmaInstance.current.graph.forEachNode((node, attributes) => {
        const nodeSize = 5 + (attributes.connection_count || 0) / 10;
        sigmaInstance.current.graph.setNodeAttribute(node, 'size', nodeSize);
        sigmaInstance.current.graph.setNodeAttribute(node, 'highlighted', false);
        sigmaInstance.current.graph.setNodeAttribute(
          node, 
          'color', 
          attributes.community !== undefined 
            ? getCommunityColor(attributes.community) 
            : '#d6356f'
        );
      });
      
      sigmaInstance.current.graph.forEachEdge((edge) => {
        sigmaInstance.current.graph.setEdgeAttribute(edge, 'color', '#e2e8f0');
        sigmaInstance.current.graph.setEdgeAttribute(edge, 'size', 1);
      });
    }
  }, [sigmaInstance]);

  function getCommunityColor(communityId: number): string {
    // Palette de couleurs plus harmonieuse et moderne
    const colors = [
      '#6366f1', // Indigo vibrant
      '#ec4899', // Rose vif
      '#10b981', // Émeraude
      '#f59e0b', // Ambre
      '#8b5cf6', // Violet
      '#06b6d4', // Cyan
      '#ef4444', // Rouge corail
      '#84cc16', // Lime
      '#f97316', // Orange
      '#14b8a6', // Teal
      '#a855f7', // Pourpre
      '#3b82f6', // Bleu royal
      '#22c55e', // Vert
      '#eab308', // Jaune
      '#d946ef', // Fuchsia
      '#0ea5e9'  // Bleu ciel
    ];
    
    return colors[communityId % colors.length];
  }

  const hasCommunityAnalysis = graphData?.metadata?.analysis_type === 'community_analysis' && 
                              graphData?.community_analysis && 
                              graphData?.community_analysis.length > 0;

  return (
    <div className="space-y-6">
      {/* Interface simplifiée - juste le toggle d'analyse */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Visualisation des Communautés
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Analyse des communautés</span>
          <button
            onClick={() => setAnalysisType(analysisType === 'basic' ? 'community_analysis' : 'basic')}
            className={`w-12 h-6 rounded-full transition-colors ${
              analysisType === 'community_analysis' ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
              analysisType === 'community_analysis' ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Juste le graphe et la légende */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="graph-container relative" style={{ height: '600px' }}>
            <div ref={containerRef} className="w-full h-full" />
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Chargement du graphe...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Légende simplifiée */}
        <div className="lg:col-span-1">
          <GraphLegend
            communities={processedData?.communities || []}
            totalNodes={processedData?.nodes?.length || 0}
            selectedCommunity={selectedCommunity}
            onCommunitySelect={setSelectedCommunity}
          />
        </div>
      </div>
    </div>
  );
}
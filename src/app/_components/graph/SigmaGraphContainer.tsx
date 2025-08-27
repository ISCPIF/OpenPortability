'use client'

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGraphMode } from './GraphModeProvider';
import { useGraphData } from './hooks/useGraphData';
import { 
  createSigmaGraph,
  getContainerDimensions,
  focusOnNode,
  centerGraph,
  calculateTopInfluencers,
  createInfluencerNetwork
} from '@/lib/graph-utils';
import type { GraphData, GraphNode } from '@/lib/types/graph';

// Debug: vérifier si le module est chargé et les données JSON accessibles
console.log('🔥 SigmaGraphContainer module chargé !');

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

interface SigmaGraphContainerProps {
  graphData: GraphData | null;
  loading?: boolean;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  className?: string;
}

export function SigmaGraphContainer({
  graphData,
  loading = false,
  selectedNodeId,
  onNodeSelect,
  className = ''
}: SigmaGraphContainerProps) {
  const sigmaRef = useRef<any>(null);
  const { currentMode, showLabels, setResetZoomHandler } = useGraphMode();
  const { top100EdgesData } = useGraphData();
  
  // Debug: vérifier si top100EdgesData est chargé
  console.log('🔍 Rendu SigmaGraphContainer - top100EdgesData chargé?', !!top100EdgesData, 'length:', top100EdgesData?.edges?.length || 0);
  
  // State pour forcer la recréation du graphe
  const [graphKey, setGraphKey] = useState(0);
  // State pour tracker le nœud sélectionné pour la coloration du réseau
  const [highlightedNetworkNode, setHighlightedNetworkNode] = useState<string | null>(null);
  // State pour le mode influencer network
  const [selectedInfluencer, setSelectedInfluencer] = useState<string | null>(null);
  const [topInfluencers, setTopInfluencers] = useState<Set<string>>(new Set());
  const [influencerNetworkData, setInfluencerNetworkData] = useState<GraphData | null>(null);

  // Calculer les top 100 influenceurs au chargement des données
  useEffect(() => {
    console.log('🚀 useEffect calculateTopInfluencers déclenché');
    console.log('📊 graphData existe?', !!graphData);
    console.log('📊 graphData.nodes?', graphData?.nodes?.length || 0);
    console.log('📊 top100EdgesData.edges?', top100EdgesData?.edges?.length || 0);
    
    if (!graphData || !graphData.nodes) {
      console.log('❌ Pas de nœuds dans graphData, arrêt du useEffect');
      return;
    }
    
    if (!top100EdgesData?.edges || top100EdgesData.edges.length === 0) {
      console.log('❌ Pas d\'edges dans top100EdgesData.edges, arrêt du useEffect');
      return;
    }
    
    console.log('✅ Calcul des influenceurs depuis top_100_edges.json...');
    // Créer un graphData temporaire avec les edges pour le calcul
    const tempGraphData = {
      nodes: graphData.nodes,
      edges: top100EdgesData.edges
    };
    
    const influencers = calculateTopInfluencers(tempGraphData, 100);
    setTopInfluencers(influencers);
    console.log('🌟 Top 100 influenceurs calculés depuis top_100_edges.json:', influencers.size);
  }, [graphData, top100EdgesData]);

  // Créer le réseau de l'influenceur sélectionné
  useEffect(() => {
    if (!selectedInfluencer) {
      setInfluencerNetworkData(null);
      return;
    }

    console.log('🔍 Création du réseau pour influenceur:', selectedInfluencer);
    const networkData = createInfluencerNetwork(selectedInfluencer, top100EdgesData.edges, graphData);
    setInfluencerNetworkData(networkData);
  }, [selectedInfluencer, graphData]);

  // Créer le graphe avec l'utilitaire existant - NOUVELLE INSTANCE SIGMA
  const graph = useMemo(() => {
    // Si on affiche le réseau d'un influenceur, utiliser les données spécifiques
    if (currentMode === 'influencers' && selectedInfluencer && influencerNetworkData) {
      console.log('🎨 Création du graphe influenceur avec:', influencerNetworkData.nodes.length, 'nœuds');
      return createSigmaGraph(influencerNetworkData);
    }
    // Sinon, utiliser les données normales
    return createSigmaGraph(graphData);
  }, [graphData, currentMode, selectedInfluencer, influencerNetworkData]);

  // Obtenir les dimensions du container
  const containerDimensions = useMemo(() => {
    return getContainerDimensions(graphData);
  }, [graphData]);

  // Fonction de reset/recentrage par recréation du graphe
  const handleResetZoom = useCallback(() => {
    // Incrémenter la key pour forcer la recréation complète du SigmaContainer
    setGraphKey(prev => prev + 1);
  }, []); // Pas de dépendances pour éviter la récursion

  // Enregistrer la fonction de reset dans le context
  useEffect(() => {
    setResetZoomHandler(handleResetZoom);
  }, [handleResetZoom, setResetZoomHandler]);

  // Focus sur un nœud sélectionné
  useEffect(() => {
    if (selectedNodeId && sigmaRef.current) {
      focusOnNode(sigmaRef.current, selectedNodeId, null, onNodeSelect);
    }
  }, [selectedNodeId, onNodeSelect]);

  // Centrage automatique au chargement initial
  useEffect(() => {
    console.log("useEffect centrage automatique - graphData:", !!graphData, "sigmaRef:", !!sigmaRef.current);
    
    if (!graphData) return;

    // Fonction pour vérifier si Sigma est prêt et centrer
    const attemptCenter = (attempt = 1) => {
      console.log(`Tentative de centrage #${attempt}, sigmaRef:`, !!sigmaRef.current);
      
      if (sigmaRef.current) {
        console.log('Sigma trouvé ! Centrage du graphe...');
        centerGraph(sigmaRef.current, graphData);
        return;
      }
      
      // Si Sigma n'est pas encore prêt, réessayer jusqu'à 10 fois
      if (attempt < 10) {
        setTimeout(() => attemptCenter(attempt + 1), 200);
      } else {
        console.warn('Impossible de centrer le graphe : Sigma non trouvé après 10 tentatives');
      }
    };

    // Commencer les tentatives avec un petit délai initial
    const timer = setTimeout(() => attemptCenter(), 100);

    return () => clearTimeout(timer);
  }, [graphData, graphKey]); // Se déclenche à chaque nouveau graphe

  // Appliquer les changements de mode
  useEffect(() => {
    if (!sigmaRef.current || !graphData) return;

    const sigma = sigmaRef.current;
    const graph = sigma.getGraph();
    
    try {
      // Appliquer les changements visuels selon le mode
      switch (currentMode) {
        case 'anonyme':
          // Mode par défaut - afficher toutes les connexions avec couleurs par communauté
          graphData.nodes.forEach(node => {
            graph.setNodeAttribute(node.id, 'hidden', false);
            // Restaurer la couleur originale basée sur la communauté
            graph.setNodeAttribute(node.id, 'color', node.color || '#ec4899');
          });
          break;

        case 'connexions':
          // Mettre en évidence les connexions de l'utilisateur
          graphData.nodes.forEach(node => {
            const isUserConnection = (node as any).isDirectConnection || (node as any).isUserConnection;
            if (isUserConnection) {
              graph.setNodeAttribute(node.id, 'color', '#3b82f6'); // Bleu pour les connexions
              graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 1.5);
            } else {
              graph.setNodeAttribute(node.id, 'color', '#e2e8f0'); // Gris pour les autres
              graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 0.7);
            }
            graph.setNodeAttribute(node.id, 'hidden', false);
          });
          break;

        case 'migrations':
          // Mettre en évidence les reconnexions
          graphData.nodes.forEach(node => {
            const isReconnected = node.isReconnected || (node as any).reconnected;
            if (isReconnected) {
              graph.setNodeAttribute(node.id, 'color', '#10b981'); // Vert pour les migrations
              graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 1.3);
            } else {
              graph.setNodeAttribute(node.id, 'color', '#e2e8f0'); // Gris pour les autres
              graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 0.8);
            }
            graph.setNodeAttribute(node.id, 'hidden', false);
          });
          break;

        case 'influencers':
          // Mode influenceurs - mettre en évidence les top 100
          graphData.nodes.forEach(node => {
            if (topInfluencers.has(node.id)) {
              graph.setNodeAttribute(node.id, 'color', '#f59e0b'); // Orange pour les influenceurs
              graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 1.8);
            } else {
              graph.setNodeAttribute(node.id, 'color', '#e2e8f0'); // Gris pour les autres
              graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 0.6);
            }
            graph.setNodeAttribute(node.id, 'hidden', false);
          });
          break;
      }

      // Rafraîchir l'affichage
      sigma.refresh();
    } catch (error) {
      console.error('Erreur lors de l\'application du mode:', error);
    }
  }, [currentMode, graphData, topInfluencers]);

  // Gérer l'affichage des labels
  useEffect(() => {
    if (!sigmaRef.current) return;

    const sigma = sigmaRef.current;
    sigma.setSetting('renderLabels', showLabels);
    sigma.refresh();
  }, [showLabels]);

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

  // Log quand sigmaRef change et gérer les clics
  useEffect(() => {
    console.log('🔗 SigmaRef changé:', !!sigmaRef.current);
    if (sigmaRef.current) {
      console.log('✅ Sigma instance disponible');
      
      try {
        const sigma = sigmaRef.current;
        console.log('🎪 Sigma settings:', sigma.getSettings());
        
        // Handler de clic pour le mode normal
        const normalClickHandler = (e: any) => {
          console.log('🚨 CLIC DÉTECTÉ - listener Sigma !', e);
          const nodeId = e.node;
          console.log('🔥 Clic sur nœud:', nodeId, 'Mode:', currentMode, 'Labels:', showLabels);
          
          // Vérifier si les labels sont réellement visibles dans Sigma
          const sigmaSettings = sigma.getSettings();
          const labelsVisible = sigmaSettings.renderLabels;
          console.log('👁️ Labels réellement visibles dans Sigma:', labelsVisible);
          
          // Permettre la coloration si les labels sont visibles (peu importe le mode)
          if (labelsVisible) {
            console.log('✅ Conditions remplies pour coloration réseau (labels visibles)');
            // Toggle : si on clique sur le même nœud, désélectionner
            if (highlightedNetworkNode === nodeId) {
              console.log('🔄 Désélection du nœud:', nodeId);
              setHighlightedNetworkNode(null);
            } else {
              console.log('🎯 Sélection du nœud:', nodeId);
              setHighlightedNetworkNode(nodeId);
            }
          } else {
            console.log('❌ Conditions non remplies - Labels non visibles');
          }
          
          if (onNodeSelect) {
            onNodeSelect(nodeId);
          }
        };

        // Handler de clic pour le mode influencer
        const influencerClickHandler = (e: any) => {
          const nodeId = e.node;
          console.log('🎯 Clic influencer sur nœud:', nodeId, 'Mode:', currentMode);
          
          if (currentMode === 'influencers' && topInfluencers.has(nodeId)) {
            console.log('✅ Clic sur un influenceur valide');
            // Toggle : si on clique sur le même influenceur, désélectionner
            if (selectedInfluencer === nodeId) {
              console.log('🔄 Désélection de l\'influenceur:', nodeId);
              setSelectedInfluencer(null);
            } else {
              console.log('🌟 Sélection de l\'influenceur:', nodeId);
              setSelectedInfluencer(nodeId);
            }
          }
          
          if (onNodeSelect) {
            onNodeSelect(nodeId);
          }
        };
        
        // Utiliser le bon handler selon le mode
        const activeHandler = currentMode === 'influencers' ? influencerClickHandler : normalClickHandler;
        sigma.on('clickNode', activeHandler);
        
        // Nettoyer le listener au démontage
        return () => {
          try {
            sigma.off('clickNode', activeHandler);
          } catch (e) {
            // Ignore les erreurs de nettoyage
          }
        };
      } catch (error) {
        console.error('❌ Erreur lors de l\'attachement manuel:', error);
      }
    }
  }, [sigmaRef.current, currentMode, showLabels, highlightedNetworkNode, selectedInfluencer, topInfluencers, onNodeSelect]);

  // Effet pour colorer le réseau du nœud sélectionné (mode normal)
  useEffect(() => {
    console.log('🎨 useEffect coloration - highlightedNetworkNode:', highlightedNetworkNode, 'Mode:', currentMode, 'Labels:', showLabels);
    
    if (!sigmaRef.current || !graphData || !showLabels || currentMode === 'influencers') {
      console.log('❌ Conditions non remplies pour coloration');
      return;
    }

    const sigma = sigmaRef.current;
    const graph = sigma.getGraph();
    
    try {
      if (highlightedNetworkNode) {
        console.log('🌟 Début coloration réseau pour nœud:', highlightedNetworkNode);
        
        // Trouver les connexions du nœud sélectionné
        const connectedNodes = new Set<string>();
        connectedNodes.add(highlightedNetworkNode); // Inclure le nœud lui-même
        
        // Parcourir les arêtes pour trouver les connexions
        graphData.edges?.forEach(edge => {
          if (edge.source === highlightedNetworkNode) {
            connectedNodes.add(edge.target);
          } else if (edge.target === highlightedNetworkNode) {
            connectedNodes.add(edge.source);
          }
        });

        console.log('🔗 Nœuds connectés trouvés:', connectedNodes.size, Array.from(connectedNodes));

        // Appliquer la coloration
        graphData.nodes.forEach(node => {
          if (node.id === highlightedNetworkNode) {
            // Nœud principal : couleur distinctive
            graph.setNodeAttribute(node.id, 'color', '#f59e0b'); // Orange/ambre
            graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 2);
          } else if (connectedNodes.has(node.id)) {
            // Connexions directes : couleur secondaire
            graph.setNodeAttribute(node.id, 'color', '#3b82f6'); // Bleu
            graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 1.3);
          } else {
            // Autres nœuds : très atténués pour le contraste
            graph.setNodeAttribute(node.id, 'color', '#d1d5db'); // Gris très clair
            graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 0.3);
          }
        });

        // Mettre en évidence les arêtes connectées
        graphData.edges?.forEach(edge => {
          if (edge.source === highlightedNetworkNode || edge.target === highlightedNetworkNode) {
            graph.setEdgeAttribute(edge.id, 'color', '#f59e0b'); // Orange pour les arêtes du réseau
            graph.setEdgeAttribute(edge.id, 'size', 2);
          } else {
            graph.setEdgeAttribute(edge.id, 'color', '#f3f4f6'); // Gris très clair pour les autres
            graph.setEdgeAttribute(edge.id, 'size', 0.3);
          }
        });
        
        console.log('✅ Coloration appliquée avec succès');
      } else {
        console.log('🔄 Restauration affichage normal mode connexions');
        
        // Restaurer l'affichage normal du mode connexions
        graphData.nodes.forEach(node => {
          const isUserConnection = (node as any).isDirectConnection || (node as any).isUserConnection;
          if (isUserConnection) {
            graph.setNodeAttribute(node.id, 'color', '#3b82f6'); // Bleu pour les connexions
            graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 1.5);
          } else {
            graph.setNodeAttribute(node.id, 'color', '#e2e8f0'); // Gris pour les autres
            graph.setNodeAttribute(node.id, 'size', (node.size || 5) * 0.7);
          }
        });

        // Restaurer les arêtes
        graphData.edges?.forEach(edge => {
          graph.setEdgeAttribute(edge.id, 'color', '#e2e8f0');
          graph.setEdgeAttribute(edge.id, 'size', 1);
        });
      }

      // Rafraîchir l'affichage
      sigma.refresh();
      console.log('🔄 Affichage rafraîchi');
    } catch (error) {
      console.error('💥 Erreur lors de la coloration du réseau:', error);
    }
  }, [highlightedNetworkNode, currentMode, showLabels, graphData]);

  // Reset de la sélection lors du changement de mode
  useEffect(() => {
    setHighlightedNetworkNode(null);
    setSelectedInfluencer(null);
  }, [currentMode, showLabels]);

  // Configuration Sigma.js
  const sigmaSettings = useMemo(() => ({
    allowInvalidContainer: true,
    renderLabels: showLabels,
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
    defaultEdgeType: 'line' as const,
    hideEdgesOnMove: true,
    hideLabelsOnMove: true,
  }), [showLabels]);

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-slate-50 to-slate-200 rounded-3xl shadow-2xl border border-white/20 overflow-hidden ${className}`}>
        <div 
          className="w-full flex items-center justify-center"
          style={{
            aspectRatio: containerDimensions.aspectRatio,
            height: containerDimensions.height,
            minHeight: '400px',
            maxHeight: '90vh'
          }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement du graphe...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className={`bg-gradient-to-br from-slate-50 to-slate-200 rounded-3xl shadow-2xl border border-white/20 overflow-hidden ${className}`}>
        <div 
          className="w-full flex items-center justify-center"
          style={{
            aspectRatio: containerDimensions.aspectRatio,
            height: containerDimensions.height,
            minHeight: '400px',
            maxHeight: '90vh'
          }}
        >
          <div className="text-center text-slate-600">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Archipel des Connexions</h2>
            <p>Aucune donnée de graphe disponible</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-slate-50 to-slate-200 rounded-3xl shadow-2xl border border-white/20 overflow-hidden ${className}`}>
      <div 
        className="w-full relative"
        style={{
          aspectRatio: containerDimensions.aspectRatio,
          height: containerDimensions.height,
          minHeight: '400px',
          maxHeight: '90vh'
        }}
      >
        <SigmaContainer
          key={graphKey}
          ref={sigmaRef}
          graph={graph}
          settings={sigmaSettings}
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
          {/* Contrôles Sigma - à l'intérieur du SigmaContainer */}
          <ControlsContainer position="bottom-right">
            <ZoomControl />
            <FullScreenControl />
          </ControlsContainer>
        </SigmaContainer>
      </div>
    </div>
  );
}
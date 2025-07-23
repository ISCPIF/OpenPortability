'use client'

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useGraphMode } from './GraphModeProvider';
import { 
  createSigmaGraph,
  getContainerDimensions,
  focusOnNode,
  centerGraph
} from '@/lib/graph-utils';
import type { GraphData, GraphNode } from '@/lib/types/graph';

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

  // Créer le graphe avec l'utilitaire existant
  const graph = useMemo(() => {
    return createSigmaGraph(graphData);
  }, [graphData]);

  // Obtenir les dimensions du container
  const containerDimensions = useMemo(() => {
    return getContainerDimensions(graphData);
  }, [graphData]);

  // Fonction de reset/recentrage
  const handleResetZoom = useCallback(() => {
    if (sigmaRef.current && graphData) {
      centerGraph(sigmaRef.current);
    }
  }, [graphData]);

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
      }

      // Rafraîchir l'affichage
      sigma.refresh();
    } catch (error) {
      console.error('Erreur lors de l\'application du mode:', error);
    }
  }, [currentMode, graphData]);

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

  // Gestion des clics sur les nœuds
  const handleNodeClick = useCallback((event: any) => {
    const nodeId = event.node;
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    }
  }, [onNodeSelect]);

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
          onClickNode={handleNodeClick}
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

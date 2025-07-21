'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { GraphData, ConnectionType } from '../types';

interface NetworkNode {
  id: string;
  type: 'following' | 'follower' | 'mutual';
  color: string;
  size: number;
  zIndex: number;
  x?: number;
  y?: number;
  label?: string;
  community?: number;
}

interface UserNetworkData {
  nodes: NetworkNode[];
  userTwitterId: string | null;
  stats: {
    totalFollowing: number;
    totalFollowers: number;
    foundInGraph: number;
    mutualConnections: number;
  };
}

export function useGraphData() {
  const { data: session } = useSession();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [anonymousData, setAnonymousData] = useState<GraphData | null>(null);
  const [personalData, setPersonalData] = useState<GraphData | null>(null);
  const [staticGraphData, setStaticGraphData] = useState<any | null>(null); // Pour le fichier JSON statique
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // États pour l'overlay du réseau utilisateur
  const [userNetworkData, setUserNetworkData] = useState<UserNetworkData | null>(null);
  const [userNetworkLoading, setUserNetworkLoading] = useState(false);
  const [userNetworkError, setUserNetworkError] = useState<string | null>(null);
  const [showUserNetwork, setShowUserNetwork] = useState(false);
  
  // Référence pour suivre les requêtes en cours et éviter les doublons
  const pendingRequestRef = useRef<{
    personal: string | null;
    anonymous: string | null;
    static: boolean;
    userNetwork: boolean;
  }>({
    personal: null,
    anonymous: null,
    static: false,
    userNetwork: false
  });

  // Nouvelle fonction pour récupérer le fichier JSON statique via l'API
  const fetchStaticGraphData = useCallback(async () => {
    // Vérifier si une requête est déjà en cours
    if (pendingRequestRef.current.static) {
      console.log('Skipping duplicate static graph data request');
      return;
    }
    
    // Marquer cette requête comme en cours
    pendingRequestRef.current.static = true;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching static graph data from API...');
      
      const response = await fetch('/api/connections/graph/anonyme');
      
      if (!response.ok) {
        throw new Error(`Error fetching static graph: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('Static graph data loaded successfully:', {
        nodesCount: data.nodes?.length || 0,
        edgesCount: data.edges?.length || 0,
        hasNodes: !!data.nodes,
        hasEdges: !!data.edges
      });
      
      setStaticGraphData(data);
      setLoading(false);
      
      return data;
      
    } catch (error: any) {
      setLoading(false);
      setError(error.message || 'Failed to load static graph data');
      console.error('Error fetching static graph data:', error);
      throw error;
    } finally {
      // Marquer la requête comme terminée
      pendingRequestRef.current.static = false;
    }
  }, []);

  // Utilisation de useCallback pour mémoriser la fonction fetchData
  const fetchData = useCallback(async (connectionType: ConnectionType, limit: number) => {
    // Créer une clé unique pour cette requête
    const requestKey = `${connectionType}-${limit}`;
    
    // Vérifier si une requête identique est déjà en cours
    if (pendingRequestRef.current.personal === requestKey) {
      console.log('Skipping duplicate personal data request:', requestKey);
      return;
    }
    
    // Marquer cette requête comme en cours
    pendingRequestRef.current.personal = requestKey;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/connections/graph?type=${connectionType}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPersonalData(data);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
    } finally {
      setLoading(false);
      // Marquer la requête comme terminée
      pendingRequestRef.current.personal = null;
    }
  }, []);
  
  // Utilisation de useCallback pour mémoriser la fonction fetchAnonymousData
  const fetchAnonymousData = useCallback(async (
    limit: number, 
    min_connections: number = 3, 
    analysis_type: 'basic' | 'community_analysis' = 'community_analysis'
  ) => {
    // Créer une clé unique pour cette requête avec le vrai analysis_type
    const requestKey = `${limit}-${min_connections}-${analysis_type}`;
    
    // Vérifier si une requête identique est déjà en cours
    if (pendingRequestRef.current.anonymous === requestKey) {
      console.log('Skipping duplicate anonymous data request:', requestKey);
      return;
    }
    
    // Marquer cette requête comme en cours
    pendingRequestRef.current.anonymous = requestKey;
    
    try {
      setLoading(true);
      setError(null);
      
      // Log pour voir les paramètres reçus
      console.log('fetchAnonymousData called with:', { 
        limit, 
        min_connections, 
        analysis_type
      });
      
      // Construire l'URL avec les paramètres corrects
      const url = `/api/connections/graph/anonyme?limit=${limit}&min_connections=${min_connections}&analysis_type=${analysis_type}`;
      console.log('Fetching URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error fetching anonymous graph: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Logs pour debug - chercher les propriétés aux bons endroits
      console.log('Received anonymous data:', { 
        analysis_type: data.analysis_type, // Directement dans data
        hasCommunityAnalysis: data.hasCommunityAnalysis, // Directement dans data
        metadata_analysis_type: data.metadata?.analysis_type, // Aussi dans metadata
        nodesCount: data.nodes?.length,
        edgesCount: data.edges?.length,
        communityAnalysisCount: data.community_analysis?.length
      });
      
      setAnonymousData(data);
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      setError(error.message || 'Failed to load anonymous graph data');
      console.error('Error fetching anonymous graph data:', error);
    } finally {
      // Marquer la requête comme terminée
      pendingRequestRef.current.anonymous = null;
    }
  }, []);

  // Fonction pour charger le réseau utilisateur
  const fetchUserNetwork = useCallback(async () => {
    if (!session?.user) {
      setUserNetworkError('Vous devez être connecté pour voir votre réseau');
      return;
    }

    // Vérifier si une requête est déjà en cours
    if (pendingRequestRef.current.userNetwork) {
      console.log('Skipping duplicate user network request');
      return;
    }

    // Marquer cette requête comme en cours
    pendingRequestRef.current.userNetwork = true;

    setUserNetworkLoading(true);
    setUserNetworkError(null);

    try {
      console.log('Fetching user network from API...');
      
      const response = await fetch('/api/connections/graph/user-network');
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUserNetworkData(data.userNetwork);
      
      console.log('User network loaded successfully:', {
        nodesCount: data.userNetwork.nodes.length,
        stats: data.userNetwork.stats
      });
      
    } catch (error) {
      console.error('Error fetching user network:', error);
      setUserNetworkError(error instanceof Error ? error.message : 'Erreur lors du chargement du réseau');
    } finally {
      setUserNetworkLoading(false);
      // Marquer la requête comme terminée
      pendingRequestRef.current.userNetwork = false;
    }
  }, [session]);

  // Toggle pour afficher/masquer le réseau utilisateur
  const toggleUserNetwork = useCallback(async () => {
    if (!showUserNetwork) {
      // Activer l'overlay - charger les données si nécessaire
      if (!userNetworkData) {
        await fetchUserNetwork();
      }
      setShowUserNetwork(true);
    } else {
      // Désactiver l'overlay
      setShowUserNetwork(false);
    }
  }, [showUserNetwork, userNetworkData, fetchUserNetwork]);

  // Fonction pour créer le graphe avec overlay
  const createGraphWithOverlay = useCallback((baseGraphData: any) => {
    if (!baseGraphData) return null;

    // Si l'overlay n'est pas activé, retourner les données de base
    if (!showUserNetwork || !userNetworkData) {
      return baseGraphData;
    }

    // Créer une copie des données de base
    const graphWithOverlay = {
      ...baseGraphData,
      nodes: [...baseGraphData.nodes]
    };

    // Appliquer l'overlay sur les nœuds existants
    const overlayNodeIds = new Set(userNetworkData.nodes.map(node => node.id));
    
    graphWithOverlay.nodes = graphWithOverlay.nodes.map((node: any) => {
      if (overlayNodeIds.has(node.id)) {
        // Trouver les données d'overlay pour ce nœud
        const overlayNode = userNetworkData.nodes.find(n => n.id === node.id);
        if (overlayNode) {
          return {
            ...node,
            color: overlayNode.color,
            size: overlayNode.size,
            zIndex: overlayNode.zIndex,
            // Marquer comme faisant partie du réseau utilisateur
            isUserNetwork: true,
            networkType: overlayNode.type
          };
        }
      }
      return node;
    });

    return graphWithOverlay;
  }, [showUserNetwork, userNetworkData]);

  return {
    session,
    graphData,
    setGraphData,
    anonymousData,
    personalData,
    staticGraphData, // Nouvelle donnée statique
    loading,
    error,
    setError,
    fetchData,
    fetchAnonymousData,
    fetchStaticGraphData, // Nouvelle fonction
    
    // Nouvelles propriétés et fonctions pour l'overlay utilisateur
    userNetworkData,
    userNetworkLoading,
    userNetworkError,
    showUserNetwork,
    fetchUserNetwork,
    toggleUserNetwork,
    createGraphWithOverlay
  };
}
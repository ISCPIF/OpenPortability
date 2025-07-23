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

// Interface pour les données RGPD-friendly
interface RGPDGraphData extends GraphData {
  isAuthenticated: boolean;
  userConnections?: {
    following: string[];
    followers: string[];
  };
}

export function useGraphData() {
  const { data: session } = useSession();
  
  // État unifié pour les données du graphe (remplace staticGraphData et personalData)
  const [graphData, setGraphData] = useState<RGPDGraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // États pour l'overlay du réseau utilisateur (conservés pour compatibilité)
  const [userNetworkData, setUserNetworkData] = useState<UserNetworkData | null>(null);
  const [userNetworkLoading, setUserNetworkLoading] = useState(false);
  const [userNetworkError, setUserNetworkError] = useState<string | null>(null);
  const [showUserNetwork, setShowUserNetwork] = useState(false);

  const [userNetworkIds, setUserNetworkIds] = useState<{
    following: string[];
    followers: string[];
  } | null>(null);
  
  // Référence pour suivre les requêtes en cours et éviter les doublons
  const pendingRequestRef = useRef<{
    graph: boolean;
    userNetwork: boolean;
  }>({
    graph: false,
    userNetwork: false
  });

  // Fonction unifiée pour récupérer les données du graphe (RGPD-compliant)
  const fetchGraphData = useCallback(async () => {
    // Vérifier si une requête est déjà en cours
    if (pendingRequestRef.current.graph) {
      console.log('Skipping duplicate graph data request');
      return;
    }
    
    // Marquer cette requête comme en cours
    pendingRequestRef.current.graph = true;
    
    try {
      setLoading(true);
      setError(null);
      
      const isAuthenticated = !!session?.user?.id;
      console.log(`Fetching graph data - Mode: ${isAuthenticated ? 'authenticated' : 'public'}`);
      
      const response = await fetch('/api/connections/graph/anonyme', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Les cookies de session sont automatiquement inclus
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching graph: ${response.status} ${response.statusText}`);
      }
      
      const data: RGPDGraphData = await response.json();
      
      console.log('Graph data loaded successfully:', {
        mode: data.isAuthenticated ? 'authenticated' : 'public',
        nodesCount: data.nodes?.length || 0,
        edgesCount: data.edges?.length || 0,
        hasUserConnections: !!data.userConnections
      });
      
      console.log(' [DEBUG] Setting graph data in state...', {
        timestamp: new Date().toISOString(),
        dataExists: !!data,
        nodesLength: data.nodes?.length,
        edgesLength: data.edges?.length
      });
      
      setGraphData(data);
      
      console.log(' [DEBUG] Graph data set in state successfully');
      
      // Si authentifié, stocker les connexions utilisateur pour l'overlay
      if (data.isAuthenticated && data.userConnections) {
        console.log(' [DEBUG] Setting user network IDs...', {
          following: data.userConnections.following?.length || 0,
          followers: data.userConnections.followers?.length || 0
        });
        setUserNetworkIds(data.userConnections);
      }
      
      setLoading(false);
      return data;
      
    } catch (error: any) {
      console.error('Error fetching graph data:', error);
      setError(error.message || 'Failed to load graph data');
      setLoading(false);
      throw error;
    } finally {
      // Marquer la requête comme terminée
      pendingRequestRef.current.graph = false;
    }
  }, [session?.user?.id]);

  // Fonction pour charger le réseau utilisateur
  const fetchUserNetwork = useCallback(async () => {

    console.log("About to fetch UserNetwork")
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
      
      // Stocker les IDs bruts pour le mode focus
      setUserNetworkIds({
        following: data.following?.map((conn: any) => conn.twitter_id) || [],
        followers: data.followers?.map((conn: any) => conn.twitter_id) || []
      });
      
      // Adapter les données au format attendu par le composant
      // La nouvelle API retourne { following: [], followers: [], stats: {...} }
      // On utilise les vrais totaux depuis stats, pas les longueurs des tableaux
      const adaptedData: UserNetworkData = {
        nodes: [], // Pas de nœuds dans le nouveau format, juste les listes d'IDs
        userTwitterId: session.user.twitter_id || null,
        stats: {
          totalFollowing: data.stats?.followingCount || 0,  // Vrai total depuis cache
          totalFollowers: data.stats?.followersCount || 0,  // Vrai total depuis cache
          foundInGraph: 0, // Plus utilisé avec le nouveau format
          mutualConnections: 0 // Plus calculé côté client
        }
      };
      
      setUserNetworkData(adaptedData);
      
      console.log('User network loaded successfully:', {
        followingCount: data.stats?.followingCount || 0,
        followersCount: data.stats?.followersCount || 0,
        following: data.following,
        followers: data.followers
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

  // Fonction pour créer le graphe avec overlay (adaptée pour les nouvelles données)
  const createGraphWithOverlay = useCallback((baseData: RGPDGraphData | null) => {
    if (!baseData) return null;
    
    // Si pas d'overlay actif, retourner les données de base
    if (!showUserNetwork || !baseData.isAuthenticated || !userNetworkIds) {
      return baseData;
    }
    
    // Si overlay actif et utilisateur authentifié, appliquer les modifications visuelles
    console.log('Applying user network overlay with connections:', {
      following: userNetworkIds.following.length,
      followers: userNetworkIds.followers.length
    });
    
    // Créer une copie des données de base
    const graphWithOverlay = {
      ...baseData,
      nodes: [...baseData.nodes],
      edges: [...baseData.edges]
    };

    // Créer des sets pour un accès rapide
    const followingSet = new Set(userNetworkIds.following);
    const followersSet = new Set(userNetworkIds.followers);
    const userTwitterId = session?.user?.twitter_id;
    
    // Set de tous les nœuds du réseau utilisateur
    const userNetworkSet = new Set([
      ...userNetworkIds.following,
      ...userNetworkIds.followers,
      ...(userTwitterId ? [userTwitterId] : [])
    ]);

    // Appliquer l'overlay : couleurs originales pour le réseau, gris pour les autres
    graphWithOverlay.nodes = graphWithOverlay.nodes.map((node: any) => {
      // Vérifier si le nœud fait partie du réseau utilisateur
      const isInUserNetwork = userNetworkSet.has(node.id) || 
                             userNetworkSet.has(node.twitter_id) ||
                             node.id === userTwitterId ||
                             node.twitter_id === userTwitterId;
      const isUser = node.id === userTwitterId || node.twitter_id === userTwitterId;

      if (isInUserNetwork) {
        // Nœuds du réseau utilisateur : garder les couleurs originales mais les agrandir
        const size = (node.originalSize || node.size) * 3; // 3x plus gros pour tout le réseau
        
        return {
          ...node,
          color: '#d6356f', // Couleur principale pour le réseau
          size: size + 2,
          opacity: 1,
          zIndex: isUser ? 10 : 5, // Utilisateur au premier plan
          isUserNetwork: true,
          originalSize: node.originalSize || node.size // Sauvegarder la taille originale
        };
      } else {
        // Nœuds hors réseau : griser
        return {
          ...node,
          color: '#9ca3af', // Gris
          size: (node.originalSize || node.size) * 0.8, // Légèrement plus petit
          opacity: 0.6, // Légèrement transparent
          zIndex: 1,
          isUserNetwork: false,
          originalSize: node.originalSize || node.size // Sauvegarder la taille originale
        };
      }
    });

    console.log('User network overlay applied:', {
      totalNodes: graphWithOverlay.nodes.length,
      networkNodes: graphWithOverlay.nodes.filter((n: any) => n.isUserNetwork).length,
      grayedNodes: graphWithOverlay.nodes.filter((n: any) => !n.isUserNetwork).length
    });

    return graphWithOverlay;
  }, [showUserNetwork, userNetworkIds, session?.user?.twitter_id]);

  // Fonction pour basculer l'overlay du réseau utilisateur
  const toggleUserNetwork = useCallback(async () => {
    if (!graphData?.isAuthenticated) {
      console.log('User network overlay only available for authenticated users');
      return;
    }
    
    setShowUserNetwork(prev => !prev);
    
    // Si on active l'overlay et qu'on n'a pas encore les données détaillées
    if (!showUserNetwork && !userNetworkData) {
      await fetchUserNetwork();
    }
  }, [graphData?.isAuthenticated, showUserNetwork, userNetworkData]);

  return {
    // Données unifiées (remplace staticGraphData et personalData)
    graphData,
    loading,
    error,
    fetchGraphData, // Remplace fetchStaticGraphData
    
    // Compatibilité avec l'ancien API (pour éviter de casser le frontend)
    staticGraphData: graphData,
    fetchStaticGraphData: fetchGraphData,
    
    // Overlay du réseau utilisateur
    userNetworkData,
    userNetworkLoading,
    userNetworkError,
    showUserNetwork,
    fetchUserNetwork,
    toggleUserNetwork,
    createGraphWithOverlay,
    
    // Informations de session
    session,
    isAuthenticated: !!session?.user?.id,
    
    // Connexions utilisateur (si disponibles)
    userNetworkIds
  };
}
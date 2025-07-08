'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { GraphData, ConnectionType } from '../types';

export function useGraphData() {
  const { data: session } = useSession();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [anonymousData, setAnonymousData] = useState<GraphData | null>(null);
  const [personalData, setPersonalData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Référence pour suivre les requêtes en cours et éviter les doublons
  const pendingRequestRef = useRef<{
    personal: string | null;
    anonymous: string | null;
  }>({
    personal: null,
    anonymous: null
  });
  
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

  return {
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
  };
}
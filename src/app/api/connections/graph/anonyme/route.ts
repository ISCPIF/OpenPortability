// /api/connections/graph/anonyme/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { withValidation } from '@/lib/validation/middleware';

// Définir d'abord les types pour la validation
type AnonymousGraphQueryParams = {
  limit: number;
  min_connections: number;
  analysis_type?: 'basic' | 'community_analysis';
};

// Schéma de validation pour les paramètres de requête
const AnonymousGraphQueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  min_connections: z.coerce.number().int().min(1).max(100).default(2),
  analysis_type: z.enum(['basic', 'community_analysis']).optional(),
}).strict() as z.ZodType<AnonymousGraphQueryParams>;

// Mapper les paramètres vers les caches pré-calculés
const getCacheKey = (limit: number, min_connections: number): string => {
  if (limit <= 100 && min_connections <= 2) return 'graph_100_2';
  if (limit <= 200 && min_connections <= 3) return 'graph_200_3';
  if (limit <= 500 && min_connections <= 5) return 'graph_500_5';
  return 'graph_100_2'; // Fallback
};

// Cache en mémoire pour les résultats complets
const memoryCache: Record<string, {
  data: any;
  timestamp: number;
  expiresAt: number;
}> = {};

// Durée de validité du cache en millisecondes (30 minutes)
const CACHE_TTL = 30 * 60 * 1000;

// Fonction pour récupérer les données par lots (batching)
async function fetchDataInBatches(tableName: string, columns: string, batchSize = 1000) {
  console.log(`Récupération des données de ${tableName} par lots`, {
    context: 'api/connections/graph/anonyme',
    function: 'fetchDataInBatches',
    tableName,
    batchSize
  });
  
  let allData: any[] = [];
  let lastId: string | number | null = null;
  let hasMore = true;
  let batchCount = 0;
  
  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(columns)
      .order('twitter_id', { ascending: true })
      .limit(batchSize);
    
    // Si nous avons un dernier ID, commencer après celui-ci
    if (lastId) {
      query = query.gt('twitter_id', lastId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.log(`Erreur lors de la récupération du lot ${batchCount} de ${tableName}`, {
        context: 'api/connections/graph/anonyme',
        error,
        batchCount
      });
      throw new Error(`Erreur lors de la récupération des données de ${tableName}: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = [...allData, ...data];
      lastId = data[data.length - 1].twitter_id;
      batchCount++;
      
      console.log(`Lot ${batchCount} récupéré pour ${tableName}`, {
        context: 'api/connections/graph/anonyme',
        recordCount: data.length,
        totalSoFar: allData.length
      });
      
      // Si le lot n'est pas complet, c'est qu'on a tout récupéré
      if (data.length < batchSize) {
        hasMore = false;
      }
    }
  }
  
  console.log(`Récupération terminée pour ${tableName}`, {
    context: 'api/connections/graph/anonyme',
    totalRecords: allData.length,
    batchCount
  });
  
  return allData;
}

// Fonction pour récupérer les méta-communautés (pas besoin de batching car généralement peu nombreuses)
async function fetchMetaCommunities() {
  const { data, error } = await supabase
    .from('graph_meta_communities')
    .select('community_id, size, x, y');
    
  if (error) {
    throw new Error(`Erreur lors de la récupération des méta-communautés: ${error.message}`);
  }
  
  return data || [];
}

// Fonction pour construire un graphe à partir des données des tables
async function buildGraphFromTables(limit: number = 500) {
  console.log('Construction du graphe à partir des tables d\'analyse', {
    context: 'api/connections/graph/anonyme',
    function: 'buildGraphFromTables',
    limit
  });
  
  try {
    // 1. Récupérer les communautés par lots
    const communityData = await fetchDataInBatches('graph_communities', 'twitter_id, community_id');
    
    // 2. Récupérer les positions par lots
    const positionsData = await fetchDataInBatches('graph_positions', 'twitter_id, x, y');
    
    // 3. Récupérer les méta-communautés (généralement peu nombreuses)
    const metaCommunityData = await fetchMetaCommunities();
    
    // 4. Construire les nœuds et les arêtes à partir des données
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map();
    
    // Créer un nœud pour chaque ID Twitter unique
    const twitterIds = new Set([
      ...communityData.map((item: any) => item.twitter_id),
      ...positionsData.map((item: any) => item.twitter_id)
    ]);
    
    console.log('Construction des nœuds du graphe', {
      context: 'api/connections/graph/anonyme',
      uniqueNodesCount: twitterIds.size
    });
    
    // Créer un mapping des communautés
    const communityMap = new Map();
    communityData.forEach((item: any) => {
      communityMap.set(item.twitter_id, item.community_id);
    });
    
    // Créer un mapping des positions
    const positionMap = new Map();
    positionsData.forEach((item: any) => {
      positionMap.set(item.twitter_id, { x: item.x, y: item.y });
    });
    
    // Limiter le nombre de nœuds selon le paramètre limit
    const limitedTwitterIds = Array.from(twitterIds).slice(0, limit);
    
    console.log(`Limitation du nombre de nœuds à ${limit}`, {
      context: 'api/connections/graph/anonyme',
      totalAvailable: twitterIds.size,
      limitApplied: limit,
      actualNodesCount: limitedTwitterIds.length
    });
    
    // Créer les nœuds
    let nodeId = 0;
    limitedTwitterIds.forEach(twitterId => {
      const communityId = communityMap.get(twitterId);
      const position = positionMap.get(twitterId);
      
      // Ne créer que des nœuds qui ont au moins une communauté ou une position
      if (communityId !== undefined || position) {
        const node = {
          id: twitterId,
          label: `User ${nodeId}`, // On garde une étiquette anonyme
          type: 'anonymous',
          // N'inclure que les propriétés qui existent réellement
          ...(communityId !== undefined && { community: communityId }),
          ...(position?.x !== undefined && { x: position.x }),
          ...(position?.y !== undefined && { y: position.y })
        };
        
        nodes.push(node);
        nodeMap.set(twitterId, node);
        nodeId++;
      }
    });
    
    console.log('Création des arêtes du graphe', {
      context: 'api/connections/graph/anonyme',
      nodesCount: nodes.length
    });
    
    // Créer des arêtes entre les nœuds de la même communauté de manière plus efficace
    // Regrouper les nœuds par communauté
    const communitiesNodes = new Map<number, string[]>();
    
    // N'utiliser que les nœuds qui ont été inclus dans notre liste limitée
    const includedNodeIds = new Set(nodes.map(node => node.id));
    
    communityData.forEach((item: any) => {
      // Ne traiter que les nœuds qui sont dans notre liste limitée
      if (!includedNodeIds.has(item.twitter_id)) {
        return;
      }
      
      const communityId = item.community_id;
      if (!communitiesNodes.has(communityId)) {
        communitiesNodes.set(communityId, []);
      }
      communitiesNodes.get(communityId)?.push(item.twitter_id);
    });
    
    // Pour chaque communauté, créer des arêtes entre un sous-ensemble de nœuds
    // pour éviter une explosion du nombre d'arêtes
    const processedEdges = new Set();
    const maxEdgesPerCommunity = 1000; // Réduire le nombre d'arêtes par communauté
    const maxEdgesTotal = 5000; // Limiter le nombre total d'arêtes
    let totalEdges = 0;
    
    communitiesNodes.forEach((nodeIds, communityId) => {
      // Si nous avons atteint la limite totale d'arêtes, ne pas continuer
      if (totalEdges >= maxEdgesTotal) {
        return;
      }
      
      // Si la communauté est trop grande, échantillonner les nœuds
      const maxNodesToProcess = Math.min(nodeIds.length, 50); // Réduire le nombre de nœuds par communauté
      const nodesToProcess = nodeIds.length <= maxNodesToProcess 
        ? nodeIds 
        : nodeIds.slice(0, maxNodesToProcess);
      
      let edgesCount = 0;
      
      // Créer des arêtes entre les nœuds de la communauté
      for (let i = 0; i < nodesToProcess.length && edgesCount < maxEdgesPerCommunity && totalEdges < maxEdgesTotal; i++) {
        for (let j = i + 1; j < nodesToProcess.length && edgesCount < maxEdgesPerCommunity && totalEdges < maxEdgesTotal; j++) {
          const edgeId = [nodesToProcess[i], nodesToProcess[j]].sort().join('-');
          
          if (!processedEdges.has(edgeId)) {
            edges.push({
              id: edgeId,
              source: nodesToProcess[i],
              target: nodesToProcess[j],
              type: 'follower' // Type par défaut
            });
            processedEdges.add(edgeId);
            edgesCount++;
            totalEdges++;
          }
        }
      }
      
      console.log(`Arêtes créées pour la communauté ${communityId}`, {
        context: 'api/connections/graph/anonyme',
        communityId,
        nodesInCommunity: nodeIds.length,
        edgesCreated: edgesCount
      });
    });
    
    console.log('Graphe construit avec succès', {
      context: 'api/connections/graph/anonyme',
      nodesCount: nodes.length,
      edgesCount: edges.length,
      communitiesCount: metaCommunityData.length
    });
    
    // Construire les métadonnées
    const metadata = {
      total_nodes: nodes.length,
      total_edges: edges.length,
      limit_used: limit,
      min_connections_used: 1,
      analysis_type: 'community_analysis',
      anonymous: true,
      communities_count: metaCommunityData.length
    };
    
    // Filtrer les données de communauté pour n'inclure que les nœuds présents
    const filteredCommunityAssignments = communityData.filter(
      (item: any) => includedNodeIds.has(item.twitter_id)
    );
    
    // Filtrer les données de position pour n'inclure que les nœuds présents
    const filteredNodePositions = positionsData.filter(
      (item: any) => includedNodeIds.has(item.twitter_id)
    );
    
    return {
      data: {
        nodes,
        edges,
        metadata,
        community_assignments: filteredCommunityAssignments,
        node_positions: filteredNodePositions,
        meta_communities: metaCommunityData
      },
      error: null
    };
    
  } catch (error) {
    console.log('Erreur lors de la construction du graphe', {
      context: 'api/connections/graph/anonyme',
      error
    });
    return { data: null, error };
  }
}

// Handler pour la méthode GET
export const GET = withValidation(AnonymousGraphQueryParamsSchema, async (req: NextRequest, data: z.infer<typeof AnonymousGraphQueryParamsSchema>) => {
  try {
    const { limit, min_connections } = data;
    
    // Si analysis_type n'est pas spécifié, utiliser community_analysis par défaut
    const analysis_type = data.analysis_type ?? 'community_analysis';
    
    // Générer une clé de cache unique pour cette requête
    const fullCacheKey = `${getCacheKey(limit, min_connections)}_${analysis_type}`;
    
    // Vérifier si nous avons un résultat en cache
    const now = Date.now();
    if (memoryCache[fullCacheKey] && memoryCache[fullCacheKey].expiresAt > now) {
      console.log('Utilisation du cache en mémoire', {
        context: 'api/connections/graph/anonyme',
        cacheKey: fullCacheKey,
        cacheAge: (now - memoryCache[fullCacheKey].timestamp) / 1000,
        remainingTtl: (memoryCache[fullCacheKey].expiresAt - now) / 1000
      });
      
      // Définir les en-têtes de cache pour le client
      const response = NextResponse.json(memoryCache[fullCacheKey].data);
      response.headers.set('Cache-Control', 'public, max-age=1800'); // 30 minutes
      response.headers.set('X-Cache', 'HIT');
      return response;
    }
    
    // Pas de cache en mémoire, récupérer les données
    console.log('Récupération des données pour le graphe social anonymisé', {
      context: 'api/connections/graph/anonyme',
      limit,
      min_connections,
      analysis_type
    });
    
    // Construire le graphe à partir des tables d'analyse
    const result = await buildGraphFromTables(limit);
    
    if (result.error) {
      console.log('Erreur lors de la récupération des données', {
        context: 'api/connections/graph/anonyme',
        error: result.error
      });
      
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    
    // Mettre en cache le résultat
    memoryCache[fullCacheKey] = {
      data: result.data,
      timestamp: now,
      expiresAt: now + CACHE_TTL
    };
    
    // Retourner le résultat avec les en-têtes de cache appropriés
    const response = NextResponse.json(result.data);
    response.headers.set('Cache-Control', 'public, max-age=1800'); // 30 minutes
    response.headers.set('X-Cache', 'MISS');
    
    return response;
    
  } catch (error: any) {
    console.log('Erreur inattendue lors de la récupération du graphe social anonymisé', {
      context: 'api/connections/graph/anonyme',
      error
    });
    
    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue lors de la récupération du graphe' },
      { status: 500 }
    );
  }
}, {
  requireAuth: false,
});
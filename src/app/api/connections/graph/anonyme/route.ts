// /api/connections/graph/anonyme/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withValidation } from '@/lib/validation/middleware';
import { EmptySchema } from '@/lib/validation/schemas';
import { auth } from '@/app/auth';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/log_utils';
import * as fs from 'fs';
import * as path from 'path';

//a faire :
// - changer imporation du fichier static en recuperation depuis la db
// - 

// Configuration - chemin vers le fichier JSON statique
const GRAPH_FILE_PATH = path.join(process.cwd(), 'public/graph-data/fine_tuned_json_nodes_only_opti11_with_usernames_and_sizes.json');

// Cache en mémoire pour éviter de relire le fichier à chaque requête
let cachedGraphData: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Interface pour les données de graphe filtrées
interface FilteredGraphData {
  nodes: any[];
  edges: any[];
  isAuthenticated: boolean;
  userConnections?: {
    following: string[];
    followers: string[];
  };
}

// Fonction pour charger le fichier JSON statique (mode public)
async function loadStaticGraphData(): Promise<any> {
  const now = Date.now();
  
  // Vérifier si le cache est encore valide
  if (cachedGraphData && (now - cacheTimestamp) < CACHE_TTL) {
    logger.logInfo('GraphCache', 'Using cached static graph data', 'Cache hit');
    return cachedGraphData;
  }
  
  try {
    logger.logInfo('GraphFile', 'Loading static graph file', GRAPH_FILE_PATH);
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(GRAPH_FILE_PATH)) {
      throw new Error(`Fichier non trouvé: ${GRAPH_FILE_PATH}`);
    }
    
    // Lire le fichier JSON
    const fileContent = fs.readFileSync(GRAPH_FILE_PATH, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    // Mettre à jour le cache
    cachedGraphData = jsonData;
    cacheTimestamp = now;
    
    logger.logInfo('GraphFile', 'Static graph data loaded successfully', 'File cached', null, {
      nodesCount: jsonData.nodes?.length || 0,
      edgesCount: jsonData.edges?.length || 0
    });
    
    return jsonData;
    
  } catch (error: any) {
    logger.logError('GraphFile', 'Error loading static graph file', 'File read failed', null, error);
    throw new Error(`Erreur lors du chargement du fichier: ${error.message}`);
  }
}

// Fonction pour filtrer les données selon le mode RGPD
async function filterGraphDataForRGPD(rawData: any, session: any): Promise<FilteredGraphData> {
  const isAuthenticated = !!session?.user?.id;
  
  if (!isAuthenticated) {
    // Mode public : supprimer tous les identifiants personnels
    logger.logInfo('GraphFilter', 'Filtering graph data for public mode', 'Removing personal identifiers');
    
    const filteredNodes = rawData.nodes.map((node: any, index: number) => ({
      id: `node_${index}`, // ID anonymisé
      x: node.x,
      y: node.y,
      size: node.size,
      color: node.color,
      type: node.type,
      community: node.community,
      connection_count: typeof node.connection_count === 'bigint' ? Number(node.connection_count) : node.connection_count,
      // Supprimer : twitter_id, label, username, name, etc.
    }));
    
    const filteredEdges = rawData.edges.map((edge: any, index: number) => ({
      id: `edge_${index}`, // ID anonymisé
      source: `node_${rawData.nodes.findIndex((n: any) => n.id === edge.source)}`,
      target: `node_${rawData.nodes.findIndex((n: any) => n.id === edge.target)}`,
      size: edge.size,
      color: edge.color,
      type: edge.type,
      // Supprimer les identifiants personnels
    }));
    
    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      isAuthenticated: false
    };
  } else {
    // Mode authentifié : récupérer les connexions de l'utilisateur
    logger.logInfo('GraphFilter', 'Filtering graph data for authenticated mode', 'Getting user connections', session.user.id);
    
    try {
      // Récupérer les connexions directes de l'utilisateur
      const { data: userConnections, error } = await supabase
        .rpc('get_user_network_ids', { user_id: session.user.id });
      
      if (error) {
        logger.logWarning('GraphFilter', 'Failed to get user connections', 'Using fallback mode', session.user.id, error);
      }
      
      const userFollowing = userConnections?.following || [];
      const userFollowers = userConnections?.followers || [];
      const userDirectConnections = [...userFollowing, ...userFollowers];
      
      // Mode authentifié : garder les twitter_id mais masquer les noms sauf pour les connexions directes
      const filteredNodes = rawData.nodes.map((node: any) => {
        const isDirectConnection = userDirectConnections.includes(node.twitter_id) || 
                                  userDirectConnections.includes(node.id) ||
                                  node.twitter_id === session.user.twitter_id ||
                                  node.id === session.user.twitter_id;
        
        return {
          ...node,
          connection_count: typeof node.connection_count === 'bigint' ? Number(node.connection_count) : node.connection_count,
          // Révéler le label/nom uniquement pour les connexions directes
          label: isDirectConnection ? (node.label || node.name || node.username) : undefined,
          username: isDirectConnection ? node.username : undefined,
          name: isDirectConnection ? node.name : undefined,
          // Garder twitter_id en interne mais ne pas l'exposer dans l'interface
          twitter_id: node.twitter_id || node.id,
          isDirectConnection: isDirectConnection
        };
      });
      
      return {
        nodes: filteredNodes,
        edges: rawData.edges,
        isAuthenticated: true,
        userConnections: {
          following: userFollowing,
          followers: userFollowers
        }
      };
    } catch (error) {
      logger.logError('GraphFilter', 'Error filtering authenticated data', 'Falling back to public mode', session.user.id, error);
      // En cas d'erreur, revenir au mode public
      return filterGraphDataForRGPD(rawData, null);
    }
  }
}

// Handler GET pour l'API RGPD-friendly
export const GET = withValidation(EmptySchema, async (req: NextRequest, data: {}) => {
  try {
    // Détecter le mode d'authentification
    const session = await auth();
    const isAuthenticated = !!session?.user?.id;
    
    logger.logInfo('GraphAPI', 'GET /api/connections/graph/anonyme', `Mode: ${isAuthenticated ? 'authenticated' : 'public'}`, session?.user?.id || 'anonymous');
    
    // Toujours charger le même fichier statique
    const rawData = await loadStaticGraphData();
    
    // Filtrer les données selon le mode RGPD
    const filteredData = await filterGraphDataForRGPD(rawData, session);
    
    logger.logInfo('GraphAPI', 'Graph data processed successfully', `Nodes: ${filteredData.nodes.length}, Edges: ${filteredData.edges.length}`, session?.user?.id || 'anonymous');
    
    // Retourner les données JSON
    const response = NextResponse.json(filteredData);
    
    // Headers de cache adaptés selon le mode
    if (isAuthenticated) {
      // Mode authentifié : pas de cache (données personnalisées)
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('X-Response-Type', 'authenticated-live');
    } else {
      // Mode public : cache long (données statiques)
      response.headers.set('Cache-Control', 'public, max-age=1800'); // 30 minutes
      response.headers.set('X-Response-Type', 'public-static');
    }
    
    response.headers.set('X-Data-Source', isAuthenticated ? 'database' : 'file');
    response.headers.set('X-RGPD-Mode', isAuthenticated ? 'authenticated' : 'public');
    
    return response;
    
  } catch (error: any) {
    logger.logError('GraphAPI', 'Error processing graph request', 'Request failed', null, error);
    
    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue lors de la récupération du graphe' },
      { status: 500 }
    );
  }
}, {
  requireAuth: false, // Endpoint accessible aux deux modes
  applySecurityChecks: false, // GET sans body sensible
  skipRateLimit: false // Appliquer le rate limiting standard
});
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { MatchingRepository } from '@/lib/repositories/matchingRepository';
import fs from 'fs';
import path from 'path';

const GRAPH_FILE_PATH = path.join(process.cwd(), 'social-graph', 'cache', 'graph_complete_workflow_20250716_172957.json');

interface NetworkNode {
  id: string;
  type: 'following' | 'follower' | 'mutual';
  color: string;
  size: number;
  zIndex: number;
  // Propriétés du graphe anonyme
  x?: number;
  y?: number;
  label?: string;
  community?: number;
}

interface UserNetworkResponse {
  userNetwork: {
    nodes: NetworkNode[];
    userTwitterId: string | null;
    stats: {
      totalFollowing: number;
      totalFollowers: number;
      foundInGraph: number;
      mutualConnections: number;
    };
  };
}

// Cache pour éviter de relire le fichier à chaque requête
let graphNodesCache: Map<string, any> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function loadGraphNodes(): Promise<Map<string, any>> {
  const now = Date.now();
  
  // Utiliser le cache si valide
  if (graphNodesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return graphNodesCache;
  }

  console.log('Loading graph nodes from file...');
  
  if (!fs.existsSync(GRAPH_FILE_PATH)) {
    throw new Error('Graph file not found');
  }

  // Lire et parser le fichier JSON
  const fileContent = fs.readFileSync(GRAPH_FILE_PATH, 'utf8');
  const graphData = JSON.parse(fileContent);
  
  // Créer un Map pour un accès rapide par ID
  const nodesMap = new Map();
  if (graphData.nodes && Array.isArray(graphData.nodes)) {
    graphData.nodes.forEach((node: any) => {
      nodesMap.set(node.id, node);
    });
  }

  graphNodesCache = nodesMap;
  cacheTimestamp = now;
  
  console.log(`Loaded ${nodesMap.size} nodes into cache`);
  return nodesMap;
}

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userTwitterId = session.user.twitter_id || null;

    console.log(`Fetching user network for user ${userId} (twitter_id: ${userTwitterId})`);

    // Récupérer le réseau utilisateur
    const matchingRepo = new MatchingRepository();
    const userNetwork = await matchingRepo.getUserNetwork(userId);

    // Charger les nœuds du graphe anonyme
    const graphNodes = await loadGraphNodes();

    // Identifier les connexions mutuelles
    const followingSet = new Set(userNetwork.following);
    const followersSet = new Set(userNetwork.followers);
    const mutualConnections = userNetwork.following.filter(id => followersSet.has(id));

    // Faire l'intersection avec le graphe anonyme
    const networkNodes: NetworkNode[] = [];
    const OVERLAY_COLOR = '#FF6B6B'; // Rouge pour l'overlay
    const OVERLAY_SIZE_MULTIPLIER = 1.5;

    // Traiter les following
    userNetwork.following.forEach(twitterId => {
      const graphNode = graphNodes.get(twitterId);
      if (graphNode) {
        const isMutual = followersSet.has(twitterId);
        networkNodes.push({
          id: twitterId,
          type: isMutual ? 'mutual' : 'following',
          color: OVERLAY_COLOR,
          size: (graphNode.size || 10) * OVERLAY_SIZE_MULTIPLIER,
          zIndex: 10,
          // Propriétés du graphe original
          x: graphNode.x,
          y: graphNode.y,
          label: graphNode.label,
          community: graphNode.community
        });
      }
    });

    // Traiter les followers (seulement ceux qui ne sont pas déjà dans following)
    userNetwork.followers.forEach(twitterId => {
      if (!followingSet.has(twitterId)) { // Éviter les doublons
        const graphNode = graphNodes.get(twitterId);
        if (graphNode) {
          networkNodes.push({
            id: twitterId,
            type: 'follower',
            color: OVERLAY_COLOR,
            size: (graphNode.size || 10) * OVERLAY_SIZE_MULTIPLIER,
            zIndex: 10,
            // Propriétés du graphe original
            x: graphNode.x,
            y: graphNode.y,
            label: graphNode.label,
            community: graphNode.community
          });
        }
      }
    });

    // Ajouter l'utilisateur lui-même s'il est dans le graphe
    if (userTwitterId && graphNodes.has(userTwitterId)) {
      const userGraphNode = graphNodes.get(userTwitterId);
      networkNodes.push({
        id: userTwitterId,
        type: 'following', // Type par défaut
        color: '#FFD700', // Couleur dorée pour l'utilisateur
        size: (userGraphNode.size || 10) * 2, // Encore plus gros
        zIndex: 15, // Au-dessus de tout
        x: userGraphNode.x,
        y: userGraphNode.y,
        label: userGraphNode.label || 'Vous',
        community: userGraphNode.community
      });
    }

    const response: UserNetworkResponse = {
      userNetwork: {
        nodes: networkNodes,
        userTwitterId,
        stats: {
          totalFollowing: userNetwork.stats.followingCount,
          totalFollowers: userNetwork.stats.followersCount,
          foundInGraph: networkNodes.length,
          mutualConnections: mutualConnections.length
        }
      }
    };

    console.log(`User network stats:`, response.userNetwork.stats);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache 5 minutes
      }
    });

  } catch (error) {
    console.error('Error fetching user network:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user network' },
      { status: 500 }
    );
  }
}

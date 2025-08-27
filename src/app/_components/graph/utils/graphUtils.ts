import Graph from 'graphology';
import { circular } from 'graphology-layout';
import { GraphData, GraphNode, GraphEdge } from '../types';
import { COMMUNITY_COLORS, NODE_COLORS, EDGE_COLORS } from '../constants';

// Algorithme simple de détection de communautés
export function detectCommunities(graph: Graph): { [nodeId: string]: number } {
  const communities: { [nodeId: string]: number } = {};
  const visited = new Set<string>();
  let communityId = 0;

  graph.forEachNode((nodeId) => {
    if (!visited.has(nodeId)) {
      const queue = [nodeId];
      while (queue.length > 0) {
        const currentNode = queue.shift()!;
        if (visited.has(currentNode)) continue;

        visited.add(currentNode);
        communities[currentNode] = communityId;

        graph.forEachNeighbor(currentNode, (neighbor) => {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }
      communityId++;
    }
  });

  return communities;
}

// Layout Force-Atlas2 simplifié
export function applyForceLayout(graph: Graph, iterations: number = 80) {
  const nodes = graph.nodes();
  const positions: { [nodeId: string]: { x: number; y: number } } = {};
  
  nodes.forEach(nodeId => {
    const attrs = graph.getNodeAttributes(nodeId);
    positions[nodeId] = {
      x: attrs.x || Math.random() * 800,
      y: attrs.y || Math.random() * 600
    };
  });

  for (let i = 0; i < iterations; i++) {
    const forces: { [nodeId: string]: { x: number; y: number } } = {};
    
    nodes.forEach(nodeId => {
      forces[nodeId] = { x: 0, y: 0 };
    });

    // Forces de répulsion
    for (let j = 0; j < nodes.length; j++) {
      for (let k = j + 1; k < nodes.length; k++) {
        const node1 = nodes[j];
        const node2 = nodes[k];
        
        const dx = positions[node2].x - positions[node1].x;
        const dy = positions[node2].y - positions[node1].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const repulsion = 8000 / (distance * distance);
        const fx = (dx / distance) * repulsion;
        const fy = (dy / distance) * repulsion;
        
        forces[node1].x -= fx;
        forces[node1].y -= fy;
        forces[node2].x += fx;
        forces[node2].y += fy;
      }
    }

    // Forces d'attraction
    graph.forEachEdge((edge, attributes, source, target) => {
      const dx = positions[target].x - positions[source].x;
      const dy = positions[target].y - positions[source].y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      
      const attraction = distance * 0.02;
      const fx = (dx / distance) * attraction;
      const fy = (dy / distance) * attraction;
      
      forces[source].x += fx;
      forces[source].y += fy;
      forces[target].x -= fx;
      forces[target].y -= fy;
    });

    const damping = 0.85;
    nodes.forEach(nodeId => {
      positions[nodeId].x += forces[nodeId].x * damping;
      positions[nodeId].y += forces[nodeId].y * damping;
    });
  }

  nodes.forEach(nodeId => {
    graph.setNodeAttribute(nodeId, 'x', positions[nodeId].x);
    graph.setNodeAttribute(nodeId, 'y', positions[nodeId].y);
  });
}

// Fonction pour créer des connexions entre followers/following
export function createInterConnections(data: GraphData): GraphEdge[] {
  const newEdges = [...data.edges];
  const edgeSet = new Set(data.edges.map(e => `${e.source}-${e.target}`));
  
  data.edges.forEach(e => {
    edgeSet.add(`${e.target}-${e.source}`);
  });
  
  const followers = data.nodes.filter(n => n.type === 'follower' || n.type === 'both');
  const following = data.nodes.filter(n => n.type === 'following' || n.type === 'both');
  
  // Limiter pour de meilleures performances
  for (let i = 0; i < Math.min(followers.length, 25); i++) {
    for (let j = i + 1; j < Math.min(followers.length, 25); j++) {
      const node1 = followers[i];
      const node2 = followers[j];
      const edgeKey1 = `${node1.id}-${node2.id}`;
      const edgeKey2 = `${node2.id}-${node1.id}`;
      
      if (!edgeSet.has(edgeKey1) && !edgeSet.has(edgeKey2) && Math.random() > 0.75) {
        newEdges.push({
          id: `inter-${node1.id}-${node2.id}`,
          source: node1.id,
          target: node2.id,
          type: 'following',
          color: EDGE_COLORS.mutual
        });
        edgeSet.add(edgeKey1);
        edgeSet.add(edgeKey2);
      }
    }
  }
  
  for (let i = 0; i < Math.min(following.length, 25); i++) {
    for (let j = i + 1; j < Math.min(following.length, 25); j++) {
      const node1 = following[i];
      const node2 = following[j];
      const edgeKey1 = `${node1.id}-${node2.id}`;
      const edgeKey2 = `${node2.id}-${node1.id}`;
      
      if (!edgeSet.has(edgeKey1) && !edgeSet.has(edgeKey2) && Math.random() > 0.75) {
        newEdges.push({
          id: `inter-${node1.id}-${node2.id}`,
          source: node1.id,
          target: node2.id,
          type: 'following',
          color: EDGE_COLORS.mutual
        });
        edgeSet.add(edgeKey1);
        edgeSet.add(edgeKey2);
      }
    }
  }
  
  return newEdges;
}

// Fonction pour traiter les données du graphe
export function processGraphData(
  data: GraphData,
  showOnlyConnections: boolean,
  minConnections: number,
  hideUserNode: boolean
): GraphData {
  if (!data || !data.nodes || !data.edges) return data;

  let edges = data.edges;
  
  if (showOnlyConnections) {
    edges = createInterConnections(data);
  }

  let filteredNodes = data.nodes;
  if (minConnections > 1) {
    const connectionCounts = new Map<string, number>();
    edges.forEach(edge => {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    });
    
    filteredNodes = data.nodes.filter(node => 
      node.type === 'user' || (connectionCounts.get(node.id) || 0) >= minConnections
    );
  }

  if (hideUserNode) {
    filteredNodes = filteredNodes.filter(node => node.type !== 'user');
    edges = edges.filter(edge => {
      const sourceNode = data.nodes.find(n => n.id === edge.source);
      const targetNode = data.nodes.find(n => n.id === edge.target);
      return sourceNode?.type !== 'user' && targetNode?.type !== 'user';
    });
  }

  const tempGraph = new Graph({ type: 'undirected' });
  
  filteredNodes.forEach(node => {
    if (!tempGraph.hasNode(node.id)) {
      tempGraph.addNode(node.id, node);
    }
  });

  const filteredEdges = edges.filter(edge => 
    tempGraph.hasNode(edge.source) && tempGraph.hasNode(edge.target)
  );

  filteredEdges.forEach(edge => {
    if (!tempGraph.hasEdge(edge.source, edge.target)) {
      try {
        tempGraph.addEdge(edge.source, edge.target, edge);
      } catch (e) {
        // Ignore les arêtes dupliquées
      }
    }
  });

  let communities: { [key: string]: number } = {};
  if (tempGraph.order > 1) {
    try {
      communities = detectCommunities(tempGraph);
    } catch (e) {
      console.warn("Community detection failed:", e);
      filteredNodes.forEach((node, index) => {
        if (node.type === 'user') {
          communities[node.id] = 0;
        } else if (node.type === 'follower' || node.type === 'both') {
          communities[node.id] = 1;
        } else {
          communities[node.id] = 2;
        }
      });
    }
  }

  const processedNodes = filteredNodes.map(node => ({
    ...node,
    community: communities[node.id] || 0,
    color: node.type === 'user' ? NODE_COLORS.user : 
           COMMUNITY_COLORS[communities[node.id] % COMMUNITY_COLORS.length]
  }));

  return {
    nodes: processedNodes,
    edges: filteredEdges,
    metadata: data.metadata
  };
}

// Polyfill global pour Sigma
export function setupSigmaPolyfill() {
  if (typeof window !== 'undefined') {
    if (!window.process) {
      (window as any).process = {
        nextTick: (callback: Function) => setTimeout(callback, 0),
        env: {}
      };
    }
    if (!window.process.nextTick) {
      window.process.nextTick = (callback: Function) => setTimeout(callback, 0);
    }
  }
}
// /api/connections/graph/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { supabase } from '@/lib/supabase';
import { builder } from 'xmlbuilder';

// Fonction pour convertir les données JSON en format GEXF
function convertToGEXF(data) {
  if (!data || !data.nodes || !data.edges) {
    return null;
  }

  const gexf = builder.create('gexf', { version: '1.0', encoding: 'UTF-8' })
    .att('xmlns', 'http://www.gexf.net/1.2draft')
    .att('xmlns:viz', 'http://www.gexf.net/1.2draft/viz')
    .att('version', '1.2');

  const graph = gexf.ele('graph', { mode: 'static', defaultedgetype: 'directed' });

  // Définir les attributs des nœuds
  const nodeAttrs = graph.ele('attributes', { class: 'node' });
  nodeAttrs.ele('attribute', { id: 'type', title: 'Type', type: 'string' });
  nodeAttrs.ele('attribute', { id: 'connection_count', title: 'Connection Count', type: 'integer' });

  // Définir les attributs des arêtes
  const edgeAttrs = graph.ele('attributes', { class: 'edge' });
  edgeAttrs.ele('attribute', { id: 'type', title: 'Type', type: 'string' });

  // Ajouter les nœuds
  const nodes = graph.ele('nodes');
  data.nodes.forEach(node => {
    const nodeEle = nodes.ele('node', { id: node.id, label: node.label });
    
    // Ajouter les attributs
    const attvalues = nodeEle.ele('attvalues');
    attvalues.ele('attvalue', { for: 'type', value: node.type });
    attvalues.ele('attvalue', { for: 'connection_count', value: node.connection_count });
    
    // Ajouter la couleur (en fonction du type)
    const colors = {
      user: '#d6356f',
      follower: '#6366f1',
      following: '#10b981',
      both: '#f59e0b'
    };
    
    nodeEle.ele('viz:color', { 
      r: parseInt(colors[node.type].substring(1, 3), 16),
      g: parseInt(colors[node.type].substring(3, 5), 16),
      b: parseInt(colors[node.type].substring(5, 7), 16)
    });
    
    // Ajouter la taille (basée sur le nombre de connexions)
    const size = node.type === 'user' ? 10 : 5 + Math.min(node.connection_count / 5, 5);
    nodeEle.ele('viz:size', { value: size });
  });

  // Ajouter les arêtes
  const edges = graph.ele('edges');
  data.edges.forEach((edge, index) => {
    const edgeEle = edges.ele('edge', { 
      id: edge.id || `e${index}`, 
      source: edge.source, 
      target: edge.target 
    });
    
    // Ajouter les attributs
    const attvalues = edgeEle.ele('attvalues');
    attvalues.ele('attvalue', { for: 'type', value: edge.type });
    
    // Ajouter la couleur (en fonction du type)
    const colors = {
      follower: '#8b5cf6',
      following: '#059669'
    };
    
    edgeEle.ele('viz:color', { 
      r: parseInt(colors[edge.type].substring(1, 3), 16),
      g: parseInt(colors[edge.type].substring(3, 5), 16),
      b: parseInt(colors[edge.type].substring(5, 7), 16)
    });
  });

  return gexf.end({ pretty: true });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'both';
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const format = searchParams.get('format') || 'json'; // Nouveau paramètre pour le format
  
  try {
    const { data: rawData, error } = await supabase
      .rpc('get_user_connection_graph', {
        user_id: session.user.id,
        connection_type: type,
        limit_count: limit
      });

      // console.log(rawData)
      // console.log("*****")
      // console.log(error)
      
    if (error) throw error;
    
    // Convertir les bigint en integer si nécessaire
    const data = rawData ? {
      nodes: rawData.nodes.map(node => ({
        ...node,
        connection_count: Number(node.connection_count) // Conversion explicite de bigint en number
      })),
      edges: rawData.edges
    } : null;
    
    // Retourner les données au format demandé
    if (format === 'gexf') {
      const gexfData = convertToGEXF(data);
      if (!gexfData) {
        throw new Error('Failed to convert data to GEXF format');
      }
      
      return new NextResponse(gexfData, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': 'attachment; filename="connection_graph.gexf"'
        }
      });
    } else {
      // Format JSON par défaut
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error fetching graph data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}
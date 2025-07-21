// /api/connections/graph/anonyme/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withValidation } from '@/lib/validation/middleware';
import * as fs from 'fs';
import * as path from 'path';

// Types pour la validation (simplifié)
type AnonymousGraphQueryParams = {
  // Paramètres optionnels pour compatibilité mais non utilisés
  limit?: number;
  min_connections?: number;
  analysis_type?: 'basic' | 'community_analysis';
};

// Schéma de validation pour les paramètres de requête (simplifié)
const AnonymousGraphQueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  min_connections: z.coerce.number().int().min(1).max(100).optional(),
  analysis_type: z.enum(['basic', 'community_analysis']).optional(),
}).strict() as z.ZodType<AnonymousGraphQueryParams>;

// Configuration - chemin vers le fichier JSON statique
const GRAPH_FILE_PATH = path.join(process.cwd(), 'social-graph/fine_tuned_json_nodes_only_opti11_with_usernames_and_sizes.json');

// Cache en mémoire pour éviter de relire le fichier à chaque requête
let cachedGraphData: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Fonction pour charger le fichier JSON
async function loadGraphData(): Promise<any> {
  const now = Date.now();
  
  // Vérifier si le cache est encore valide
  if (cachedGraphData && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('Utilisation du cache en mémoire existant');
    return cachedGraphData;
  }
  
  try {
    console.log('Chargement du fichier JSON:', GRAPH_FILE_PATH);
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(GRAPH_FILE_PATH)) {
      throw new Error(`Fichier non trouvé: ${GRAPH_FILE_PATH}`);
    }
    
    // Lire le fichier JSON
    const fileContent = fs.readFileSync(GRAPH_FILE_PATH, 'utf8');
    const graphData = JSON.parse(fileContent);
    
    // Mettre en cache
    cachedGraphData = graphData;
    cacheTimestamp = now;
    
    console.log('Fichier JSON chargé avec succès', {
      nodesCount: graphData.nodes?.length || 0,
      edgesCount: graphData.edges?.length || 0,
      fileSize: `${Math.round(fileContent.length / 1024 / 1024)}MB`
    });
    
    return graphData;
    
  } catch (error: any) {
    console.error('Erreur lors du chargement du fichier JSON', { error: error.message });
    throw new Error(`Impossible de charger le fichier JSON: ${error.message}`);
  }
}

// Handler GET pour l'API
export const GET = withValidation(AnonymousGraphQueryParamsSchema, async (req: NextRequest, data: z.infer<typeof AnonymousGraphQueryParamsSchema>) => {
  try {
    // Charger et retourner directement les données du graphe
    const graphData = await loadGraphData();
    
    // Retourner les données JSON telles quelles
    const response = NextResponse.json(graphData);
    
    // Headers de cache pour optimiser les performances
    response.headers.set('Cache-Control', 'public, max-age=1800'); // 30 minutes
    response.headers.set('X-Response-Type', 'static-json');
    response.headers.set('X-Data-Source', 'file');
    
    return response;
    
  } catch (error: any) {
    console.error('Erreur lors du traitement de la requête', {
      context: 'api/connections/graph/anonyme',
      error: error.message
    });
    
    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue lors de la récupération du graphe' },
      { status: 500 }
    );
  }
}, {
  requireAuth: false,
});
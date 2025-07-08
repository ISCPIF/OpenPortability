// /api/connections/graph/anonyme/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { withValidation } from '@/lib/validation/middleware';
 
// Schéma de validation pour les paramètres de requête
const AnonymousGraphQueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
  min_connections: z.coerce.number().int().min(1).max(100).optional().default(2),
  analysis_type: z.enum(['basic', 'community_analysis']).optional(),
}).strict();

// Mapper les paramètres vers les caches pré-calculés
const getCacheKey = (limit: number, min_connections: number): string => {
  if (limit <= 100 && min_connections <= 2) return 'graph_100_2';
  if (limit <= 200 && min_connections <= 3) return 'graph_200_3';
  if (limit <= 500 && min_connections <= 5) return 'graph_500_5';
  return 'graph_100_2'; // Fallback
};

// Handler pour la méthode GET
export const GET = withValidation(AnonymousGraphQueryParamsSchema, async (req: NextRequest, data: z.infer<typeof AnonymousGraphQueryParamsSchema>) => {
  try {
    const { limit, min_connections } = data;
    
    // Si analysis_type n'est pas spécifié, utiliser community_analysis par défaut
    const analysis_type = data.analysis_type ?? 'community_analysis';
    
    console.log('Récupération du graphe social anonymisé', { 
      context: 'api/connections/graph/anonyme',
      limit,
      min_connections,
      analysis_type,
      received_analysis_type: data.analysis_type, // Pour debug
    });

    // Appeler la fonction RPC appropriée en fonction du type d'analyse
    let result;
    if (analysis_type === 'community_analysis') {
      console.log('Exécution de l\'analyse des communautés sociales depuis le cache', { 
        context: 'api/connections/graph/anonyme',
        function: 'cache_lookup'
      });
      
      // Utiliser le cache pour l'analyse des communautés
      const cacheKey = getCacheKey(limit, min_connections);
      
      console.log('Récupération depuis le cache', {
        context: 'api/connections/graph/anonyme',
        cacheKey,
        limit,
        min_connections
      });
      
      // Lecture du cache
      const { data: cacheResult, error: cacheError } = await supabase
        .from('graph_cache')
        .select('graph_data')
        .eq('cache_key', cacheKey)
        .single();

      if (cacheError) {
        console.log('Erreur lors de la récupération du cache', {
          context: 'api/connections/graph/anonyme',
          error: cacheError,
          cacheKey
        });
        throw new Error(`Erreur cache: ${cacheError.message}`);
      }

      // Enrichir les données du cache avec les métadonnées complètes
      const enrichedData = {
        ...cacheResult.graph_data,
        // Assurer que les métadonnées sont complètes
        metadata: {
          ...cacheResult.graph_data.metadata,
          analysis_type: 'community_analysis',
          anonymous: true,
          limit_used: limit,
          min_connections_used: min_connections
        }
      };

      result = {
        data: enrichedData,
        error: null
      };
      
    } else {
      console.log('Exécution de la récupération du graphe social anonymisé standard', { 
        context: 'api/connections/graph/anonyme',
        function: 'get_anonymous_social_graph'
      });
      
      result = await supabase.rpc('get_anonymous_social_graph', {
        limit_nodes: limit,
        min_connections: min_connections
      });

      // Enrichir les données basic avec les métadonnées
      if (result.data) {
        result.data.metadata = {
          ...result.data.metadata,
          analysis_type: 'basic',
          anonymous: true
        };
      }
    }

    if (result.error) {
      console.log('Erreur lors de la récupération du graphe social anonymisé', {
        context: 'api/connections/graph/anonyme',
        error: result.error,
        analysis_type
      });
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    // Calculer hasCommunityAnalysis
    const hasCommunityAnalysis = analysis_type === 'community_analysis' && 
                                result.data?.community_analysis?.length > 0;

    console.log('Graphe social anonymisé récupéré avec succès', {
      context: 'api/connections/graph/anonyme',
      nodesCount: result.data?.nodes?.length || 0,
      edgesCount: result.data?.edges?.length || 0,
      analysis_type,
      hasCommunityAnalysis
    });

    // Retourner les données avec les propriétés attendues par le frontend
    return NextResponse.json({
      ...result.data,
      analysis_type,
      hasCommunityAnalysis
    });

  } catch (error) {
    console.log('Erreur inattendue lors de la récupération du graphe social anonymisé', {
      context: 'api/connections/graph/anonyme',
      error
    });
    return NextResponse.json({ error: 'Une erreur est survenue lors de la récupération du graphe' }, { status: 500 });
  }
}, {
  requireAuth: false,
  applySecurityChecks: true,
});
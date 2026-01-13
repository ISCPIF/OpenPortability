// import { redis } from '@/lib/redis';
// import logger from '@/lib/log_utils';
// import { 
//   GraphNode, 
//   GraphOverview, 
//   GraphMetadata, 
//   GraphFilters, 
//   BoundingBox,
//   GraphUserView,
//   GraphNodeWithRelation,
//   GraphTier
// } from "../types/graph";

// export class GraphRepository {
  
//   /**
//    * Récupère TOUS les nœuds du graphe depuis Redis (pour embedding-atlas)
//    * Charge toutes les grilles spatiales et tous les tiers
//    */
//   async getAllNodesFromRedis(): Promise<GraphNode[]> {
//     logger.logInfo('Repository', 'GraphRepository.getAllNodesFromRedis', 'Fetching ALL nodes from Redis', 'system');

//     try {
//       // Récupérer toutes les clés de grille
//       const gridKeys = await redis.keys('graph:grid:*');
      
//       if (gridKeys.length === 0) {
//         logger.logWarning('Repository', 'GraphRepository.getAllNodesFromRedis', 'No grid keys found in Redis', 'system');
//         return [];
//       }

//       logger.logInfo('Repository', 'GraphRepository.getAllNodesFromRedis', `Found ${gridKeys.length} grid cells`, 'system');

//       // Récupérer toutes les grilles en parallèle
//       const gridPromises = gridKeys.map(key => redis.get(key));
//       const gridResults = await Promise.all(gridPromises);

//       // Parser et combiner tous les nodes
//       const allNodes: GraphNode[] = [];
//       const nodeIds = new Set<string>(); // Pour éviter les doublons

//       for (const gridData of gridResults) {
//         if (!gridData) continue;
        
//         try {
//           const nodes = JSON.parse(gridData) as GraphNode[];
          
//           for (const node of nodes) {
//             // Éviter les doublons (un nœud peut être dans plusieurs grilles)
//             if (!nodeIds.has(node.id)) {
//               nodeIds.add(node.id);
//               allNodes.push(node);
//             }
//           }
//         } catch (parseError) {
//           // Ignorer les grilles malformées
//           continue;
//         }
//       }

//       logger.logInfo('Repository', 'GraphRepository.getAllNodesFromRedis', `✅ Loaded ${allNodes.length} unique nodes from Redis`, 'system', {
//         gridCount: gridKeys.length,
//         nodeCount: allNodes.length
//       });

//       // Trier par degree décroissant
//       allNodes.sort((a, b) => b.degree - a.degree);

//       return allNodes;

//     } catch (error) {
//       logger.logError('Repository', 'GraphRepository.getAllNodesFromRedis', error, 'system');
//       throw error;
//     }
//   }

//   /**
//    * Récupère la vue d'ensemble du graphe (top 1000 nœuds major pour performance)
//    * Utilise Redis en priorité, fallback sur PostgreSQL
//    */
//   async getGraphOverview(): Promise<GraphOverview> {
//     logger.logInfo('Repository', 'GraphRepository.getGraphOverview', 'Fetching overview nodes', 'system', {
//       context: 'Trying Redis cache first'
//     });

//     let allNodes: GraphNode[] = [];

//     try {
//       // PRIORITÉ 1: Essayer Redis
//       const cachedNodes = await redis.get('graph:overview:nodes');
      
//       if (cachedNodes) {
//         allNodes = JSON.parse(cachedNodes) as GraphNode[];
//         logger.logInfo('Repository', 'GraphRepository.getGraphOverview', '✅ Overview loaded from Redis cache', 'system', {
//           nodeCount: allNodes.length,
//           source: 'redis'
//         });
//       }
//     } catch (redisError) {
//       const error = redisError instanceof Error ? redisError : new Error(String(redisError));
//       logger.logError('Repository', 'GraphRepository.getGraphOverview', error, 'system', {
//         context: 'Redis fetch failed, falling back to PostgreSQL'
//       });
//     }

//     // FALLBACK: Si Redis échoue ou est vide, utiliser PostgreSQL
//     // if (allNodes.length === 0) {
//     //   logger.logInfo('Repository', 'GraphRepository.getGraphOverview', 'Fetching from PostgreSQL (Redis miss)', 'system');
      
//     //   const { data: batch, error } = await supabase
//     //     .from('graph_nodes')
//     //     .select('*')
//     //     .eq('tier', 'major')
//     //     .order('degree', { ascending: false })
//     //     .limit(1000)
//     //     .abortSignal(AbortSignal.timeout(30000));

//     //   if (error) {
//     //     logger.logError('Repository', 'GraphRepository.getGraphOverview', error, 'system', {
//     //       context: 'PostgreSQL query failed'
//     //     });
//     //     throw error;
//     //   }

//     //   allNodes = (batch as GraphNode[]) || [];
      
//     //   logger.logInfo('Repository', 'GraphRepository.getGraphOverview', '✅ Overview loaded from PostgreSQL', 'system', {
//     //     nodeCount: allNodes.length,
//     //     source: 'postgresql'
//     //   });
//     // }

//     // Calculer les métadonnées
//     const metadata = await this.calculateMetadata();
    
//     const overview: GraphOverview = {
//       nodes: allNodes,
//       metadata
//     };

//     logger.logInfo('Repository', 'GraphRepository.getGraphOverview', 'Complete graph overview fetched', 'system', {
//       nodeCount: allNodes.length,
//       totalNodes: metadata.totalNodes,
//       majorNodes: metadata.majorNodes,
//       mediumNodes: metadata.mediumNodes,
//       minorNodes: metadata.minorNodes,
//       communities: metadata.communities
//     });

//     return overview;
//   }

//   // /**
//   //  * Récupère les nœuds avec filtres personnalisés
//   //  * Utilise Redis pour les requêtes viewport avec index spatial
//   //  */
//   // async getGraphNodes(filters: GraphFilters): Promise<GraphNode[]> {
//   //   // Si on a une bounding box, essayer Redis avec index spatial
//   //   if (filters.boundingBox) {
//   //     try {
//   //       const nodes = await this.getNodesFromRedis(filters);
//   //       if (nodes.length > 0) {
//   //         logger.logInfo('Repository', 'GraphRepository.getGraphNodes', '✅ Nodes loaded from Redis', 'system', {
//   //           nodeCount: nodes.length,
//   //           source: 'redis',
//   //           filters
//   //         });
//   //         return nodes;
//   //       }
//   //     } catch (redisError) {
//   //       const error = redisError instanceof Error ? redisError : new Error(String(redisError));
//   //       logger.logError('Repository', 'GraphRepository.getGraphNodes', error, 'system', {
//   //         context: 'Redis query failed, falling back to PostgreSQL'
//   //       });
//   //     }
//   //   }

//   //   // FALLBACK: PostgreSQL
//   //   logger.logInfo('Repository', 'GraphRepository.getGraphNodes', 'Fetching from PostgreSQL', 'system', { filters });
    
//   //   // let query = supabase.from('graph_nodes').select('*');

//   //   // // Appliquer les filtres
//   //   // if (filters.tier) {
//   //   //   if (Array.isArray(filters.tier)) {
//   //   //     query = query.in('tier', filters.tier);
//   //   //   } else {
//   //   //     query = query.eq('tier', filters.tier);
//   //   //   }
//   //   // }

//   //   // if (filters.community) {
//   //   //   if (Array.isArray(filters.community)) {
//   //   //     query = query.in('community', filters.community);
//   //   //   } else {
//   //   //     query = query.eq('community', filters.community);
//   //   //   }
//   //   // }

//   //   // if (filters.minDegree !== undefined) {
//   //   //   query = query.gte('degree', filters.minDegree);
//   //   // }

//   //   // if (filters.maxDegree !== undefined) {
//   //   //   query = query.lte('degree', filters.maxDegree);
//   //   // }

//   //   // if (filters.boundingBox) {
//   //   //   const { minX, maxX, minY, maxY } = filters.boundingBox;
//   //   //   query = query
//   //   //     .gte('x', minX)
//   //   //     .lte('x', maxX)
//   //   //     .gte('y', minY)
//   //   //     .lte('y', maxY);
//   //   // }

//   //   // // Pagination
//   //   // if (filters.limit) {
//   //   //   query = query.limit(filters.limit);
//   //   // }

//   //   // if (filters.offset) {
//   //   //   query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
//   //   // }

//   //   // // Tri par degré décroissant
//   //   // query = query.order('degree', { ascending: false });

//   //   // const { data, error } = await query;

//   //   if (error) {
//   //     logger.logError('Repository', 'GraphRepository.getGraphNodes', error, 'system', { filters });
//   //     throw error;
//   //   }

//   //   return data as GraphNode[];
//   // }

//   /**
//    * Récupère les nœuds depuis Redis avec grille spatiale
//    * Utilise des clés de grille précises pour récupérer uniquement les zones nécessaires
//    */
//   private async getNodesFromRedis(filters: GraphFilters): Promise<GraphNode[]> {
//     if (!filters.boundingBox) {
//       return [];
//     }

//     const { minX, maxX, minY, maxY } = filters.boundingBox;
//     const GRID_SIZE = 500; // Doit correspondre à la taille dans init-redis-mappings.js (500x500)

//     // Étape 1: Calculer quelles grilles intersectent le viewport
//     const minGridX = Math.floor(minX / GRID_SIZE);
//     const maxGridX = Math.floor(maxX / GRID_SIZE);
//     const minGridY = Math.floor(minY / GRID_SIZE);
//     const maxGridY = Math.floor(maxY / GRID_SIZE);

//     // Étape 2: Déterminer les tiers à récupérer
//     const tiers = filters.tier 
//       ? (Array.isArray(filters.tier) ? filters.tier : [filters.tier])
//       : ['major', 'medium', 'minor'];

//     // Étape 3: Construire les clés de grille à récupérer
//     const gridKeys: string[] = [];
//     for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
//       for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
//         for (const tier of tiers) {
//           gridKeys.push(`graph:grid:${gridX}:${gridY}:${tier}`);
//         }
//       }
//     }

//     if (gridKeys.length === 0) {
//       return [];
//     }

//     logger.logInfo('Repository', 'GraphRepository.getNodesFromRedis', `Fetching ${gridKeys.length} grid cells from Redis`, 'system', {
//       viewport: { minX, maxX, minY, maxY },
//       grids: { minGridX, maxGridX, minGridY, maxGridY },
//       gridCount: gridKeys.length
//     });

//     // Étape 4: Récupérer toutes les grilles en parallèle
//     const gridPromises = gridKeys.map(key => redis.get(key));
//     const gridResults = await Promise.all(gridPromises);

//     // Étape 5: Parser et combiner tous les nodes des grilles
//     const allNodes: GraphNode[] = [];
    
//     for (const gridData of gridResults) {
//       if (!gridData) continue;
      
//       try {
//         const nodes = JSON.parse(gridData) as GraphNode[];
        
//         // Filtrer les nodes qui sont vraiment dans le viewport
//         for (const node of nodes) {
//           if (node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY) {
//             // Filtrer par degree
//             if (filters.minDegree !== undefined && node.degree < filters.minDegree) {
//               continue;
//             }
//             if (filters.maxDegree !== undefined && node.degree > filters.maxDegree) {
//               continue;
//             }
            
//             // Filtrer par community
//             if (filters.community !== undefined) {
//               if (Array.isArray(filters.community)) {
//                 if (!filters.community.includes(node.community as number)) {
//                   continue;
//                 }
//               } else {
//                 if (node.community !== filters.community) {
//                   continue;
//                 }
//               }
//             }
            
//             allNodes.push(node);
//           }
//         }
//       } catch (parseError) {
//         // Ignorer les grilles malformées
//         continue;
//       }
//     }

//     // Étape 6: Calculer une limite dynamique basée sur la surface du viewport
//     // Plus le viewport est petit, moins on a besoin de nodes
//     const viewportWidth = maxX - minX;
//     const viewportHeight = maxY - minY;
//     const viewportArea = viewportWidth * viewportHeight;
    
//     // Formule: 1 node par 50 unités² (ajustable)
//     // Minimum 100, maximum 3000 pour éviter les extrêmes
//     const dynamicLimit = Math.min(3000, Math.max(100, Math.ceil(viewportArea / 50)));
    
//     // Utiliser la limite la plus restrictive entre celle du filtre et la limite dynamique
//     const effectiveLimit = filters.limit ? Math.min(filters.limit, dynamicLimit) : dynamicLimit;

//     logger.logInfo('Repository', 'GraphRepository.getNodesFromRedis', `Dynamic limit calculated`, 'system', {
//       viewportArea: Math.round(viewportArea),
//       dynamicLimit,
//       filterLimit: filters.limit,
//       effectiveLimit,
//       totalNodesBeforeLimit: allNodes.length
//     });

//     // Étape 7: Trier par degree et appliquer la limite effective
//     allNodes.sort((a, b) => b.degree - a.degree);
    
//     return allNodes.slice(0, effectiveLimit);
//   }

//   /**
//    * Récupère la vue personnalisée pour un utilisateur
//    */
//   async getGraphUserView(userId: string, filters: GraphFilters = {}): Promise<GraphUserView> {
//     try {
//       // Cache key spécifique à l'utilisateur
//       const cacheKey = `graph:user:${userId}:${JSON.stringify(filters)}`;
//       const cached = await redis.get(cacheKey);
      
//       if (cached) {
//         return JSON.parse(cached) as GraphUserView;
//       }

//       // Requête complexe avec relations utilisateur
//       const { data, error } = await supabase.rpc('get_graph_user_view', {
//         p_user_id: userId,
//         p_filters: filters
//       });

//       if (error) {
//         logger.logError('Repository', 'GraphRepository.getGraphUserView', error, userId, { filters });
//         throw error;
//       }

//       const metadata = await this.calculateMetadata(filters.tier ? [filters.tier].flat() : ['major', 'medium']);
      
//       const userView: GraphUserView = {
//         nodes: data as GraphNodeWithRelation[],
//         metadata
//       };

//       // Cache pour 10 minutes (données plus dynamiques)
//       await redis.set(cacheKey, JSON.stringify(userView), 600);

//       return userView;

//     } catch (error) {
//       logger.logError('Repository', 'GraphRepository.getGraphUserView', error, userId, { filters });
//       throw error;
//     }
//   }

//   /**
//    * Calcule les métadonnées du graphe
//    */
//   private async calculateMetadata(tiers: GraphTier[] = ['major', 'medium', 'minor']): Promise<GraphMetadata> {
//     const cacheKey = `graph:metadata:${tiers.join(',')}`;
    
//     try {
//       const cached = await redis.get(cacheKey);
//       if (cached) {
//         return JSON.parse(cached) as GraphMetadata;
//       }
//     } catch (error) {
//       // Continue sans cache
//     }

//     // Requête pour les statistiques
//     const { data: stats, error: statsError } = await supabase.rpc('get_graph_metadata', {
//       p_tiers: tiers
//     });

//     if (statsError) {
//       throw statsError;
//     }

//     // Requête pour la bounding box
//     const { data: bbox, error: bboxError } = await supabase
//       .from('graph_nodes')
//       .select('x, y')
//       .in('tier', tiers);

//     if (bboxError) {
//       throw bboxError;
//     }

//     let boundingBox: BoundingBox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
//     if (bbox && bbox.length > 0) {
//       const xValues = bbox.map(n => n.x);
//       const yValues = bbox.map(n => n.y);
      
//       boundingBox = {
//         minX: Math.min(...xValues),
//         maxX: Math.max(...xValues),
//         minY: Math.min(...yValues),
//         maxY: Math.max(...yValues)
//       };
//     }

//     const metadata: GraphMetadata = {
//       totalNodes: stats.total_nodes || 0,
//       majorNodes: stats.major_nodes || 0,
//       mediumNodes: stats.medium_nodes || 0,
//       minorNodes: stats.minor_nodes || 0,
//       communities: stats.communities_count || 0,
//       boundingBox
//     };

//     // Cache pour 1 heure
//     try {
//       await redis.set(cacheKey, JSON.stringify(metadata), 3600);
//     } catch (error) {
//       // Continue sans cache
//     }

//     return metadata;
//   }

//   /**
//    * Invalide le cache du graphe
//    */
//   async invalidateCache(pattern: string = 'graph:*'): Promise<void> {
//     try {
//       // Note: Cette implémentation dépend de votre setup Redis
//       // Vous pourriez avoir besoin d'adapter selon votre version de Redis
//       const keys = await redis.keys(pattern);
//       if (keys.length > 0) {
//         await redis.del(...keys);
//         logger.logInfo('Repository', 'GraphRepository.invalidateCache', `Invalidated ${keys.length} cache keys`, 'system', {
//           pattern,
//           keysCount: keys.length
//         });
//       }
//     } catch (error) {
//       logger.logWarning('Repository', 'GraphRepository.invalidateCache', 'Failed to invalidate cache', 'system', {
//         pattern,
//         error: error instanceof Error ? error.message : 'Unknown error'
//       });
//     }
//   }

//   /**
//    * Met à jour les statistiques du cache
//    */
//   async refreshCache(): Promise<void> {
//     try {
//       // Invalider et recalculer les caches principaux
//       await this.invalidateCache('graph:overview:*');
//       await this.invalidateCache('graph:metadata:*');
      
//       // Pré-chauffer le cache overview
//       await this.getGraphOverview();
      
//       logger.logInfo('Repository', 'GraphRepository.refreshCache', 'Graph cache refreshed successfully', 'system');
//     } catch (error) {
//       logger.logError('Repository', 'GraphRepository.refreshCache', error, 'system');
//       throw error;
//     }
//   }

//   /**
//    * Récupère un nœud et son réseau depuis Redis par Twitter ID
//    */
//   async getNodeNetwork(twitterId: string): Promise<{
//     node: GraphNode | null;
//     neighbors: GraphNode[];
//     bluesky: { username: string; id: string } | null;
//     mastodon: { id: string; username: string; instance: string } | null;
//     twitter: { username: string; hasOnboarded: boolean } | null;
//   }> {
//     logger.logInfo('Repository', 'GraphRepository.getNodeNetwork', `Fetching node network for Twitter ID: ${twitterId}`, 'system');

//     try {
//       // 1. Récupérer les mappings sociaux et le username Twitter
//       const [blueskyData, mastodonData, twitterUserData] = await Promise.all([
//         redis.get(`twitter_to_bluesky:${twitterId}`),
//         redis.get(`twitter_to_mastodon:${twitterId}`),
//         authClient
//           .from('users')
//           .select('twitter_username, has_onboarded')
//           .eq('twitter_id', twitterId)
//           .single()
//       ]);

//       const bluesky = blueskyData ? JSON.parse(blueskyData) : null;
//       const mastodon = mastodonData ? JSON.parse(mastodonData) : null;
//       const twitter = twitterUserData.data ? { 
//         username: twitterUserData.data.twitter_username,
//         hasOnboarded: twitterUserData.data.has_onboarded 
//       } : null;

//       // 2. Chercher le nœud dans toutes les grilles Redis
//       let targetNode: GraphNode | null = null;
//       const gridKeys = await redis.keys('graph:grid:*');
      
//       logger.logInfo('Repository', 'GraphRepository.getNodeNetwork', `Searching in ${gridKeys.length} grid cells`, 'system');

//       for (const gridKey of gridKeys) {
//         const gridData = await redis.get(gridKey);
//         if (gridData) {
//           const nodes: GraphNode[] = JSON.parse(gridData);
//           const found = nodes.find(n => n.id === twitterId);
//           if (found) {
//             targetNode = found;
//             logger.logInfo('Repository', 'GraphRepository.getNodeNetwork', `Found node in grid: ${gridKey}`, 'system');
//             break;
//           }
//         }
//       }

//       // 3. Si pas de nœud, retourner quand même les mappings
//       if (!targetNode) {
//         logger.logWarning('Repository', 'GraphRepository.getNodeNetwork', `Node ${twitterId} not found in graph`, 'system');
//         return { node: null, neighbors: [], bluesky, mastodon, twitter };
//       }

//       // 4. Trouver les voisins (proximité spatiale)
//       const neighbors: GraphNode[] = [];
//       const PROXIMITY_THRESHOLD = 1000;
//       const GRID_SIZE = 500;
      
//       const targetGridX = Math.floor(targetNode.x / GRID_SIZE);
//       const targetGridY = Math.floor(targetNode.y / GRID_SIZE);
      
//       // Chercher dans les grilles adjacentes (3x3)
//       const adjacentGrids: string[] = [];
//       for (let dx = -1; dx <= 1; dx++) {
//         for (let dy = -1; dy <= 1; dy++) {
//           ['major', 'medium', 'minor'].forEach(tier => {
//             adjacentGrids.push(`graph:grid:${targetGridX + dx}:${targetGridY + dy}:${tier}`);
//           });
//         }
//       }

//       logger.logInfo('Repository', 'GraphRepository.getNodeNetwork', `Searching neighbors in ${adjacentGrids.length} adjacent grids`, 'system');

//       for (const gridKey of adjacentGrids) {
//         const gridData = await redis.get(gridKey);
//         if (gridData) {
//           const nodes: GraphNode[] = JSON.parse(gridData);
          
//           for (const node of nodes) {
//             if (node.id === twitterId) continue;
            
//             const distance = Math.sqrt(
//               Math.pow(node.x - targetNode.x, 2) + 
//               Math.pow(node.y - targetNode.y, 2)
//             );
            
//             if (distance < PROXIMITY_THRESHOLD || 
//                 (targetNode.community !== null && node.community === targetNode.community)) {
//               neighbors.push({ ...node, distance } as any);
//             }
//           }
//         }
//       }

//       // Trier par distance et limiter à 50
//       neighbors.sort((a: any, b: any) => a.distance - b.distance);
//       const topNeighbors = neighbors.slice(0, 50).map(n => {
//         const { distance, ...node } = n as any;
//         return node;
//       });

//       logger.logInfo('Repository', 'GraphRepository.getNodeNetwork', `Found ${topNeighbors.length} neighbors`, 'system');

//       return {
//         node: targetNode,
//         neighbors: topNeighbors,
//         bluesky,
//         mastodon,
//         twitter
//       };

//     } catch (error) {
//       logger.logError('Repository', 'GraphRepository.getNodeNetwork', error, 'system', { twitterId });
//       throw error;
//     }
//   }
// }
// import { GraphRepository } from "@/lib/repositories/graphRepository";
// import { 
//   GraphOverview, 
//   GraphNode, 
//   GraphFilters, 
//   GraphUserView,
//   GraphMetadata,
//   GraphApiResponse,
//   BoundingBox,
//   ViewportRequest
// } from "@/lib/types/graph";
// import logger from '@/lib/log_utils';

// export class GraphService {
//   private repository: GraphRepository;
  
//   constructor(repository: GraphRepository) {
//     this.repository = repository;
//   }
  
//   /**
//    * Récupère TOUS les nœuds depuis Redis (pour embedding-atlas)
//    * Charge l'ensemble du graphe pour une visualisation complète
//    */
//   async getAllNodes(): Promise<GraphApiResponse<GraphNode[]>> {
//     try {
//       const nodes = await this.repository.getAllNodesFromRedis();
      
//       logger.logInfo('Service', 'GraphService.getAllNodes', 'All nodes retrieved successfully', 'system', {
//         nodeCount: nodes.length
//       });

//       return {
//         success: true,
//         data: nodes
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.getAllNodes', errorMessage, 'system');
      
//       return {
//         success: false,
//         data: [],
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Récupère la vue d'ensemble du graphe social (nœuds major)
//    * Optimisé pour l'affichage initial rapide
//    */
//   async getOverview(): Promise<GraphApiResponse<GraphOverview>> {
//     try {
//       const overview = await this.repository.getGraphOverview();
      
//       logger.logInfo('Service', 'GraphService.getOverview', 'Graph overview retrieved successfully', 'system', {
//         nodeCount: overview.nodes.length,
//         communities: overview.metadata.communities
//       });

//       return {
//         success: true,
//         data: overview,
//         metadata: overview.metadata
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.getOverview', errorMessage, 'system');
      
//       return {
//         success: false,
//         data: { nodes: [], metadata: this.getEmptyMetadata() },
//         error: errorMessage
//       };
//     }
//   }

  // /**
  //  * Récupère les nœuds avec filtres avancés
  //  * Pour les vues détaillées et le zoom
  //  */
  // async getNodes(filters: GraphFilters): Promise<GraphApiResponse<GraphNode[]>> {
  //   try {
  //     // Validation des filtres
  //     const validatedFilters = this.validateFilters(filters);
      
  //     const nodes = await this.repository.getGraphNodes(validatedFilters);
      
  //     logger.logInfo('Service', 'GraphService.getNodes', 'Filtered nodes retrieved successfully', 'system', {
  //       nodeCount: nodes.length,
  //       filters: validatedFilters
  //     });

  //     return {
  //       success: true,
  //       data: nodes
  //     };
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //     logger.logError('Service', 'GraphService.getNodes', errorMessage, 'system', { filters });
      
  //     return {
  //       success: false,
  //       data: [],
  //       error: errorMessage
  //     };
  //   }
  // }

  /**
   * Récupère la vue personnalisée pour un utilisateur
   * Inclut les relations sociales (follows/followers)
   */
//   async getUserView(userId: string, filters: GraphFilters = {}): Promise<GraphApiResponse<GraphUserView>> {
//     try {
//       if (!userId) {
//         throw new Error('User ID is required');
//       }

//       const validatedFilters = this.validateFilters(filters);
//       const userView = await this.repository.getGraphUserView(userId, validatedFilters);
      
//       logger.logInfo('Service', 'GraphService.getUserView', 'User graph view retrieved successfully', userId, {
//         nodeCount: userView.nodes.length,
//         filters: validatedFilters
//       });

//       return {
//         success: true,
//         data: userView,
//         metadata: userView.metadata
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.getUserView', errorMessage, userId, { filters });
      
//       return {
//         success: false,
//         data: { nodes: [], metadata: this.getEmptyMetadata() },
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Récupère les nœuds dans une zone géographique (bounding box)
//    * Optimisé pour le zoom et le pan
//    */
//   async getNodesInViewport(
//     boundingBox: BoundingBox, 
//     tier: 'major' | 'medium' | 'minor' | 'all' = 'major',
//     limit: number = 1000
//   ): Promise<GraphApiResponse<GraphNode[]>> {
//     try {
//       const filters: GraphFilters = {
//         boundingBox,
//         tier: tier === 'all' ? ['major', 'medium', 'minor'] : [tier],
//         limit
//       };

//       const nodes = await this.repository.getGraphNodes(filters);
      
//       logger.logInfo('Service', 'GraphService.getNodesInViewport', 'Viewport nodes retrieved successfully', 'system', {
//         nodeCount: nodes.length,
//         boundingBox,
//         tier,
//         limit
//       });

//       return {
//         success: true,
//         data: nodes
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.getNodesInViewport', errorMessage, 'system', { boundingBox, tier, limit });
      
//       return {
//         success: false,
//         data: [],
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Récupère un nœud et son réseau par Twitter ID
//    */
//   async getNodeNetwork(twitterId: string): Promise<GraphApiResponse<{
//     node: GraphNode | null;
//     neighbors: GraphNode[];
//     bluesky: { username: string; id: string } | null;
//     mastodon: { id: string; username: string; instance: string } | null;
//     twitter: { username: string; hasOnboarded: boolean } | null;
//     metadata: {
//       twitterId: string;
//       hasNode: boolean;
//       neighborCount: number;
//     };
//   }>> {
//     try {
//       const result = await this.repository.getNodeNetwork(twitterId);
      
//       logger.logInfo('Service', 'GraphService.getNodeNetwork', 'Node network retrieved successfully', 'system', {
//         twitterId,
//         hasNode: result.node !== null,
//         neighborCount: result.neighbors.length
//       });

//       return {
//         success: true,
//         data: {
//           ...result,
//           metadata: {
//             twitterId,
//             hasNode: result.node !== null,
//             neighborCount: result.neighbors.length
//           }
//         }
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.getNodeNetwork', errorMessage, 'system', { twitterId });
      
//       return {
//         success: false,
//         data: {
//           node: null,
//           neighbors: [],
//           bluesky: null,
//           mastodon: null,
//           twitter: null,
//           metadata: {
//             twitterId,
//             hasNode: false,
//             neighborCount: 0
//           }
//         },
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Récupère les nœuds dans un viewport avec filtrage adaptatif basé sur le zoom
//    * Applique automatiquement les bonnes règles de filtrage selon le niveau de zoom
//    */
//   async getNodesInViewportAdaptive(request: ViewportRequest): Promise<GraphApiResponse<GraphNode[]>> {
//     try {
//       const { xMin, xMax, yMin, yMax, zoomLevel, maxNodes, community } = request;

//       // Déterminer les filtres automatiques basés sur le niveau de zoom
//       const { tiers, minDegree, limit } = this.getAdaptiveFilters(zoomLevel, maxNodes);

//       const filters: GraphFilters = {
//         boundingBox: { minX: xMin, maxX: xMax, minY: yMin, maxY: yMax },
//         tier: tiers,
//         minDegree,
//         limit,
//         community
//       };

//       const nodes = await this.repository.getGraphNodes(filters);
      
//       logger.logInfo('Service', 'GraphService.getNodesInViewportAdaptive', 'Adaptive viewport nodes retrieved', 'system', {
//         nodeCount: nodes.length,
//         zoomLevel,
//         appliedFilters: { tiers, minDegree, limit },
//         viewport: { xMin, xMax, yMin, yMax }
//       });

//       return {
//         success: true,
//         data: nodes
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.getNodesInViewportAdaptive', errorMessage, 'system', { request });
      
//       return {
//         success: false,
//         data: [],
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Détermine les filtres automatiques basés sur le niveau de zoom
//    * 
//    * Règles :
//    * - zoom < 1.5       → major only, degree > 200, max 1000 nodes
//    * - zoom 1.5-3.0     → major only, degree > 100, max 2000 nodes
//    * - zoom 3.0-5.0     → major + medium, degree > 50, max 3500 nodes
//    * - zoom 5.0-8.0     → major + medium, degree > 20, max 5000 nodes
//    * - zoom > 8.0       → all tiers, degree > 5, max 8000 nodes
//    */
//   private getAdaptiveFilters(zoomLevel: number, maxNodesOverride?: number): {
//     tiers: ('major' | 'medium' | 'minor')[],
//     minDegree: number,
//     limit: number
//   } {
//     let tiers: ('major' | 'medium' | 'minor')[];
//     let minDegree: number;
//     let limit: number;

//     if (zoomLevel < 1.5) {
//       tiers = ['major'];
//       minDegree = 200;
//       limit = 1000;
//     } else if (zoomLevel < 3.0) {
//       tiers = ['major'];
//       minDegree = 100;
//       limit = 2000;
//     } else if (zoomLevel < 5.0) {
//       tiers = ['major', 'medium'];
//       minDegree = 50;
//       limit = 3500;
//     } else if (zoomLevel < 8.0) {
//       tiers = ['major', 'medium'];
//       minDegree = 20;
//       limit = 5000;
//     } else {
//       tiers = ['major', 'medium', 'minor'];
//       minDegree = 5;
//       limit = 8000;
//     }

//     // Override la limite si spécifiée (avec maximum de sécurité)
//     if (maxNodesOverride !== undefined) {
//       limit = Math.min(maxNodesOverride, 10000);
//     }

//     return { tiers, minDegree, limit };
//   }

//   /**
//    * Récupère les nœuds d'une communauté spécifique
//    */
//   async getCommunityNodes(
//     communityId: number, 
//     tier: 'major' | 'medium' | 'minor' | 'all' = 'all'
//   ): Promise<GraphApiResponse<GraphNode[]>> {
//     try {
//       const filters: GraphFilters = {
//         community: communityId,
//         tier: tier === 'all' ? ['major', 'medium', 'minor'] : [tier]
//       };

//       const nodes = await this.repository.getGraphNodes(filters);
      
//       logger.logInfo('Service', 'GraphService.getCommunityNodes', 'Community nodes retrieved successfully', 'system', {
//         nodeCount: nodes.length,
//         communityId,
//         tier
//       });

//       return {
//         success: true,
//         data: nodes
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.getCommunityNodes', errorMessage, 'system', { communityId, tier });
      
//       return {
//         success: false,
//         data: [],
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Recherche de nœuds par label/username
//    */
//   async searchNodes(query: string, limit: number = 50): Promise<GraphApiResponse<GraphNode[]>> {
//     try {
//       if (!query || query.length < 2) {
//         return {
//           success: false,
//           data: [],
//           error: 'Query must be at least 2 characters long'
//         };
//       }

//       // Cette fonctionnalité nécessiterait une extension du repository
//       // Pour l'instant, on peut faire une recherche basique côté service
//       const allNodes = await this.repository.getGraphNodes({ limit: 10000 });
      
//       const filteredNodes = allNodes
//         .filter(node => 
//           node.label.toLowerCase().includes(query.toLowerCase()) ||
//           node.id.includes(query)
//         )
//         .slice(0, limit);

//       logger.logInfo('Service', 'GraphService.searchNodes', 'Node search completed', 'system', {
//         query,
//         resultCount: filteredNodes.length,
//         limit
//       });

//       return {
//         success: true,
//         data: filteredNodes
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.searchNodes', errorMessage, 'system', { query, limit });
      
//       return {
//         success: false,
//         data: [],
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Rafraîchit le cache du graphe
//    */
//   async refreshCache(): Promise<GraphApiResponse<boolean>> {
//     try {
//       await this.repository.refreshCache();
      
//       logger.logInfo('Service', 'GraphService.refreshCache', 'Graph cache refreshed successfully', 'system');

//       return {
//         success: true,
//         data: true
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       logger.logError('Service', 'GraphService.refreshCache', errorMessage, 'system');
      
//       return {
//         success: false,
//         data: false,
//         error: errorMessage
//       };
//     }
//   }

//   /**
//    * Valide et normalise les filtres
//    */
//   private validateFilters(filters: GraphFilters): GraphFilters {
//     const validated: GraphFilters = { ...filters };

//     // Limiter la pagination
//     if (validated.limit && validated.limit > 5000) {
//       validated.limit = 5000;
//     }

//     // Valider les degrés
//     if (validated.minDegree !== undefined && validated.minDegree < 0) {
//       validated.minDegree = 0;
//     }

//     if (validated.maxDegree !== undefined && validated.maxDegree < 0) {
//       delete validated.maxDegree;
//     }

//     // Valider la bounding box
//     if (validated.boundingBox) {
//       const { minX, maxX, minY, maxY } = validated.boundingBox;
//       if (minX >= maxX || minY >= maxY) {
//         delete validated.boundingBox;
//       }
//     }

//     return validated;
//   }

//   /**
//    * Retourne des métadonnées vides pour les cas d'erreur
//    */
//   private getEmptyMetadata(): GraphMetadata {
//     return {
//       totalNodes: 0,
//       majorNodes: 0,
//       mediumNodes: 0,
//       minorNodes: 0,
//       communities: 0,
//       boundingBox: { minX: 0, maxX: 0, minY: 0, maxY: 0 }
//     };
//   }
// }
// 'use client';

// import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
// import Graph from 'graphology';
// import { circular } from 'graphology-layout';

// // Hooks réutilisés
// import { useGraphData } from './hooks/useGraphData';

// // Types
// import { GraphData, GraphNode } from './types';

// // Constantes pour le filtrage
// const MAX_EDGES_PER_COMMUNITY = 150;
// const MAX_EDGES_TOTAL = 1000;
// const LARGE_COMMUNITY_THRESHOLD = 100;

// export default function CommunityGraph() {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const sigmaRef = useRef<any>(null);
//   const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  
//   // Utiliser le hook existant qui marche
//   const {
//     session,
//     loading,
//     error,
//     fetchAnonymousData
//   } = useGraphData();

//   // État local pour les données
//   const [graphData, setGraphData] = useState<GraphData | null>(null);
//   const [dataLoaded, setDataLoaded] = useState(false);

//   // Charger les données au démarrage - UNE SEULE FOIS
//   useEffect(() => {
//     if (dataLoaded) return; // Éviter les rechargements
    
//     const loadData = async () => {
//       try {
//         console.log('Chargement des données...');
//         const response = await fetch('/api/connections/graph/anonyme?limit=500&min_connections=3&analysis_type=community_analysis');
//         const data = await response.json();
//         setGraphData(data);
//         setDataLoaded(true);
//         console.log('Données chargées:', { nodes: data.nodes?.length, edges: data.edges?.length });
//       } catch (err) {
//         console.error('Erreur chargement:', err);
//       }
//     };
//     loadData();
//   }, [dataLoaded]);

//   // **FILTRAGE INTELLIGENT DES ARÊTES** - Mémorisé avec clé stable
//   const filteredData = useMemo(() => {
//     if (!graphData?.nodes || !graphData?.edges) return null;

//     // Créer une clé unique pour éviter les recalculs inutiles
//     const dataKey = `${graphData.nodes.length}-${graphData.edges.length}`;
//     console.log('Recalcul filteredData pour:', dataKey);

//     // Grouper par communauté
//     const communities = new Map<number, GraphNode[]>();
//     graphData.nodes.forEach((node: any) => {
//       const community = node.community || 0;
//       if (!communities.has(community)) {
//         communities.set(community, []);
//       }
//       communities.get(community)?.push(node);
//     });

//     // Séparer arêtes inter vs intra-communautés
//     const interEdges: any[] = [];
//     const intraEdges = new Map<number, any[]>();

//     graphData.edges.forEach((edge: any) => {
//       const sourceNode = graphData.nodes.find((n: any) => n.id === edge.source);
//       const targetNode = graphData.nodes.find((n: any) => n.id === edge.target);
      
//       if (!sourceNode || !targetNode) return;

//       const sourceCommunity = sourceNode.community || 0;
//       const targetCommunity = targetNode.community || 0;

//       if (sourceCommunity !== targetCommunity) {
//         // Inter-communauté : GARDER TOUTES
//         interEdges.push(edge);
//       } else {
//         // Intra-communauté : FILTRER
//         if (!intraEdges.has(sourceCommunity)) {
//           intraEdges.set(sourceCommunity, []);
//         }
//         intraEdges.get(sourceCommunity)?.push(edge);
//       }
//     });

//     // Filtrer intelligemment les arêtes intra-communauté
//     const finalEdges = [...interEdges];
    
//     intraEdges.forEach((edges, communityId) => {
//       const communitySize = communities.get(communityId)?.length || 0;
      
//       // Limite adaptative selon la taille
//       let maxEdges;
//       if (communitySize > 300) maxEdges = 50;
//       else if (communitySize > 100) maxEdges = 100;
//       else maxEdges = Math.min(200, communitySize * 2);

//       // Trier par importance et prendre les meilleures
//       const sortedEdges = edges.sort((a, b) => {
//         const aMutual = a.type === 'mutual' ? 1 : 0;
//         const bMutual = b.type === 'mutual' ? 1 : 0;
//         return bMutual - aMutual;
//       });

//       finalEdges.push(...sortedEdges.slice(0, maxEdges));
//     });

//     console.log(`✅ Arêtes filtrées: ${graphData.edges.length} → ${finalEdges.length}`);

//     return {
//       ...graphData,
//       edges: finalEdges.slice(0, MAX_EDGES_TOTAL)
//     };
//   }, [graphData?.nodes?.length, graphData?.edges?.length, dataLoaded]); // Dépendances plus stables

//   // **COULEURS DES COMMUNAUTÉS**
//   const getCommunityColor = useCallback((communityId: number): string => {
//     const colors = [
//       '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
//       '#ef4444', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#3b82f6'
//     ];
//     return colors[communityId % colors.length];
//   }, []);

//   // **LAYOUT COMMUNAUTAIRE SIMPLE ET EFFICACE**
//   const applyCommunityLayout = useCallback((graph: Graph, width: number, height: number) => {
//     if (!filteredData) return;

//     // Grouper les nœuds par communauté
//     const communities = new Map<number, string[]>();
//     filteredData.nodes.forEach((node: any) => {
//       const community = node.community || 0;
//       if (!communities.has(community)) {
//         communities.set(community, []);
//       }
//       communities.get(community)?.push(node.id);
//     });

//     const numCommunities = communities.size;
//     const centerX = width / 2;
//     const centerY = height / 2;
//     const radius = Math.min(width, height) * 0.35;

//     // Positionner chaque communauté
//     Array.from(communities.entries()).forEach(([communityId, nodeIds], index) => {
//       let cx, cy;

//       if (numCommunities === 1) {
//         cx = centerX;
//         cy = centerY;
//       } else {
//         const angle = (2 * Math.PI * index) / numCommunities;
//         cx = centerX + radius * Math.cos(angle);
//         cy = centerY + radius * Math.sin(angle);
//       }

//       // Layout interne selon la taille
//       const communityRadius = Math.min(80, Math.sqrt(nodeIds.length) * 15);
      
//       nodeIds.forEach((nodeId, nodeIndex) => {
//         if (!graph.hasNode(nodeId)) return;

//         let x, y;
//         if (nodeIds.length === 1) {
//           x = cx;
//           y = cy;
//         } else {
//           const nodeAngle = (2 * Math.PI * nodeIndex) / nodeIds.length;
//           x = cx + communityRadius * Math.cos(nodeAngle);
//           y = cy + communityRadius * Math.sin(nodeAngle);
//         }

//         // Variation aléatoire
//         x += (Math.random() - 0.5) * 20;
//         y += (Math.random() - 0.5) * 20;

//         // Garder dans les limites
//         x = Math.max(50, Math.min(width - 50, x));
//         y = Math.max(50, Math.min(height - 50, y));

//         graph.setNodeAttribute(nodeId, 'x', x);
//         graph.setNodeAttribute(nodeId, 'y', y);
//       });
//     });
//   }, [filteredData]);

//   // **INITIALISATION SIGMA**
//   const initSigma = useCallback(async () => {
//     if (!filteredData || !containerRef.current) return;

//     // Nettoyer l'instance précédente
//     if (sigmaRef.current) {
//       sigmaRef.current.kill();
//       sigmaRef.current = null;
//     }

//     const rect = containerRef.current.getBoundingClientRect();
//     if (rect.width < 200 || rect.height < 200) return;

//     try {
//       const graph = new Graph({ type: 'undirected' });

//       // Ajouter les nœuds
//       filteredData.nodes.forEach((node: any) => {
//         const communitySize = filteredData.nodes.filter((n: any) => n.community === node.community).length;
//         const baseSize = communitySize > LARGE_COMMUNITY_THRESHOLD ? 4 : 6;
//         const size = baseSize + Math.log(Math.max(1, node.connection_count || 1)) * 2;

//         graph.addNode(node.id, {
//           label: '',
//           size: Math.min(20, size),
//           color: getCommunityColor(node.community || 0),
//           x: Math.random() * rect.width,
//           y: Math.random() * rect.height,
//           community: node.community,
//           borderColor: '#ffffff',
//           borderSize: 1
//         });
//       });

//       // Ajouter les arêtes
//       filteredData.edges.forEach((edge: any) => {
//         if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
//           try {
//             graph.addEdge(edge.source, edge.target, {
//               color: '#e2e8f040',
//               size: 0.5
//             });
//           } catch (e) {
//             // Ignorer les doublons
//           }
//         }
//       });

//       // Appliquer le layout
//       applyCommunityLayout(graph, rect.width, rect.height);

//       // Initialiser Sigma
//       const SigmaModule = await import('sigma');
//       const Sigma = SigmaModule.default || SigmaModule;

//       sigmaRef.current = new Sigma(graph, containerRef.current, {
//         renderEdgeLabels: false,
//         labelDensity: 0,
//         labelRenderedSizeThreshold: 999,
//         minCameraRatio: 0.1,
//         maxCameraRatio: 10,
//         defaultEdgeColor: '#f3f4f620',
//         defaultNodeColor: '#64748b',
//         edgeReducer: (edge: any, data: any) => ({
//           ...data,
//           size: 0.3
//         })
//       });

//       // Events
//       sigmaRef.current.on('clickStage', () => {
//         setSelectedCommunity(null);
//       });

//     } catch (error) {
//       console.error('Erreur Sigma:', error);
//     }
//   }, [filteredData, applyCommunityLayout, getCommunityColor]);

//   // Initialiser quand les données sont prêtes
//   useEffect(() => {
//     if (filteredData) {
//       initSigma();
//     }
//   }, [filteredData, initSigma]);

//   // Redimensionnement
//   useEffect(() => {
//     const handleResize = () => {
//       setTimeout(initSigma, 300);
//     };
//     window.addEventListener('resize', handleResize);
//     return () => window.removeEventListener('resize', handleResize);
//   }, [initSigma]);

//   // Statistiques des communautés
//   const communityStats = useMemo(() => {
//     if (!filteredData) return [];
    
//     const stats = new Map<number, { size: number; color: string }>();
//     filteredData.nodes.forEach((node: any) => {
//       const community = node.community || 0;
//       if (!stats.has(community)) {
//         stats.set(community, {
//           size: 0,
//           color: getCommunityColor(community)
//         });
//       }
//       stats.get(community)!.size++;
//     });
    
//     return Array.from(stats.entries())
//       .map(([id, data]) => ({ id, ...data }))
//       .sort((a, b) => b.size - a.size);
//   }, [filteredData, getCommunityColor]);

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-96">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="text-red-500 p-4 text-center">
//         Erreur: {error}
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-6">
//       {/* En-tête simple */}
//       <div className="flex items-center justify-between">
//         <h2 className="text-xl font-semibold text-gray-900">
//           Graphe des Communautés
//         </h2>
//         <div className="text-sm text-gray-600">
//           {filteredData?.nodes?.length || 0} nœuds, {filteredData?.edges?.length || 0} arêtes
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//         {/* Graphe */}
//         <div className="lg:col-span-3">
//           <div 
//             className="border border-gray-200 rounded-lg bg-white"
//             style={{ height: '600px' }}
//           >
//             <div ref={containerRef} className="w-full h-full" />
//           </div>
//         </div>

//         {/* Légende des communautés */}
//         <div className="lg:col-span-1">
//           <div className="bg-white border border-gray-200 rounded-lg p-4">
//             <h3 className="font-medium text-gray-900 mb-4">Communautés</h3>
//             <div className="space-y-2">
//               {communityStats.map(({ id, size, color }) => (
//                 <div 
//                   key={id}
//                   className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
//                   onClick={() => setSelectedCommunity(selectedCommunity === id ? null : id)}
//                 >
//                   <div 
//                     className="w-4 h-4 rounded-full"
//                     style={{ backgroundColor: color }}
//                   />
//                   <span className="text-sm text-gray-700">
//                     Communauté {id} ({size} membres)
//                   </span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// } 
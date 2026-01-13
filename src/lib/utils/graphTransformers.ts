import { GraphNode } from '@/lib/types/graph';

export interface EmbeddingData {
  x: Float32Array;
  y: Float32Array;
  category?: Uint8Array;
  text?: string[];
  identifier?: string[];
  description?: string[];
}

export interface NormalizationBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  centerX: number;
  centerY: number;
}

/**
 * Mappe un tier à un index de catégorie
 * major = 0, medium = 1, minor = 2, personal = 3
 */
function getTierCategoryIndex(tier: string, isPersonalNetwork?: boolean): number {
  // Personal network always gets category 3
  if (isPersonalNetwork) {
    return 3;
  }
  
  switch (tier) {
    case 'major':
      return 0;
    case 'medium':
      return 1;
    case 'minor':
      return 2;
    default:
      return 0;
  }
}

/**
 * Calcule les bornes de normalisation à partir d'un ensemble de nœuds
 * Détecte automatiquement si les données sont déjà normalisées [0,1] ou [-1,1]
 */
export function calculateNormalizationBounds(nodes: GraphNode[]): NormalizationBounds {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const maxRange = Math.max(rangeX, rangeY);
  
  // Détecter si les données sont déjà normalisées [0,1] ou [-1,1]
  const isNormalized = (minX >= -1.1 && maxX <= 1.1) || (minX >= -0.1 && maxX <= 1.1);
  
  // Si déjà normalisées, utiliser un scale plus petit pour éviter de les étaler trop
  // Sinon, utiliser le scale standard
  const scale = isNormalized ? 100 : (200 / maxRange);
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return { minX, maxX, minY, maxY, scale, centerX, centerY };
}

/**
 * Transforme un tableau de GraphNode en format EmbeddingView
 * Utilise des bornes de normalisation fixes pour garantir la cohérence
 */
// Community labels for auto-labeling
const COMMUNITY_LABELS: Record<number, string> = {
  0: 'Gaming / Esports',
  1: 'Science / Environment',
  2: 'Sports / Business',
  3: 'Journalism / International',
  4: 'Entertainment / LGBTQ+',
  5: 'Spanish Media',
  6: 'French Media',
  7: 'Science / Research',
  8: 'Adult Content',
  9: 'Music / Art',
};

export function transformNodesToEmbeddingData(
  nodes: GraphNode[], 
  fixedBounds?: NormalizationBounds
): EmbeddingData {
  const count = nodes.length;
  
  const xArray = new Float32Array(count);
  const yArray = new Float32Array(count);
  const categoryArray = new Uint8Array(count);
  const textArray: string[] = [];
  const identifierArray: string[] = [];
  const descriptionArray: string[] = [];

  // Utiliser les bornes fixes si fournies, sinon les calculer
  const bounds = fixedBounds || calculateNormalizationBounds(nodes);

  // Normaliser les coordonnées entre -100 et +100
  nodes.forEach((node, index) => {
    xArray[index] = (node.x - bounds.centerX) * bounds.scale;
    yArray[index] = (node.y - bounds.centerY) * bounds.scale;
    categoryArray[index] = getTierCategoryIndex(node.tier, node.metadata?.isPersonalNetwork);
    
    // Identifier pour la sélection
    identifierArray[index] = index.toString();
    
    // TEXT = used for tooltip display AND auto-labeling
    // If node has description from graph_personal_labels, show "label\ndescription"
    // Otherwise just show the label (username)
    const baseLabel = node.label || node.id;
    textArray[index] = node.description 
      ? `${baseLabel}\n${node.description}`
      : baseLabel;
    
    // Description array (kept for compatibility, same as text)
    descriptionArray[index] = textArray[index];
  });

  return {
    x: xArray,
    y: yArray,
    category: categoryArray,
    text: textArray,
    identifier: identifierArray,
    description: descriptionArray,
  };
}

/**
 * Récupère les métadonnées d'un nœud par son index
 */
export function getNodeMetadata(nodes: GraphNode[], index: number): GraphNode | null {
  return nodes[index] || null;
}

/**
 * Merge base graph nodes with personal network nodes
 * Personal nodes replace their counterparts in the base graph (keep original position)
 */
export function mergeGraphWithPersonalNetwork(
  baseNodes: GraphNode[],
  personalNodes: GraphNode[],
  hideBaseGraph: boolean
): GraphNode[] {
  if (hideBaseGraph) {
    // Only show personal network
    return personalNodes;
  }

  // Create a Map of personal nodes by ID for quick lookup
  const personalNodeMap = new Map(personalNodes.map(n => [n.id, n]));

  // Replace base nodes with personal nodes where IDs match (keep original position)
  const merged = baseNodes.map((node) => {
    const personalNode = personalNodeMap.get(node.id);
    return personalNode || node; // Use personal node if exists, otherwise keep base node
  });
  
  return merged;
}

/**
 * Interface pour les données brutes en TypedArrays (optimisé mémoire)
 * Utilisé pour les très gros graphes (18M+ nœuds)
 * 
 * Mémoire pour 18M nœuds:
 * - x: Float32Array = 72 MB
 * - y: Float32Array = 72 MB  
 * - community: Uint8Array = 18 MB (max 256 communautés)
 * - Total: ~162 MB (vs ~3.6 GB avec objets JS)
 */
export interface RawEmbeddingArrays {
  x: Float32Array;
  y: Float32Array;
  community: Uint8Array; // Uint8Array pour < 256 communautés (économie ~54 MB)
  count: number;
  // IDs supprimés - pas nécessaires pour le rendu, l'index sert d'identifiant
}

/**
 * Calcule les bornes de normalisation à partir de TypedArrays
 */
export function calculateBoundsFromArrays(x: Float32Array, y: Float32Array): NormalizationBounds {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < x.length; i++) {
    const xVal = x[i];
    const yVal = y[i];
    if (xVal < minX) minX = xVal;
    if (xVal > maxX) maxX = xVal;
    if (yVal < minY) minY = yVal;
    if (yVal > maxY) maxY = yVal;
  }

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const maxRange = Math.max(rangeX, rangeY);
  
  const isNormalized = (minX >= -1.1 && maxX <= 1.1) || (minX >= -0.1 && maxX <= 1.1);
  const scale = isNormalized ? 100 : (200 / maxRange);
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return { minX, maxX, minY, maxY, scale, centerX, centerY };
}

/**
 * Transforme des TypedArrays bruts en format EmbeddingData
 * Évite la création d'objets GraphNode intermédiaires (économie ~90% mémoire)
 */
export function transformRawArraysToEmbeddingData(
  rawData: RawEmbeddingArrays,
  fixedBounds?: NormalizationBounds
): EmbeddingData {
  const count = rawData.count;
  
  // Calculer les bornes si non fournies
  const bounds = fixedBounds || calculateBoundsFromArrays(rawData.x, rawData.y);
  
  // Créer les tableaux de sortie
  const xArray = new Float32Array(count);
  const yArray = new Float32Array(count);
  const categoryArray = new Uint8Array(count);
  
  // Normaliser les coordonnées et assigner les catégories
  for (let i = 0; i < count; i++) {
    xArray[i] = (rawData.x[i] - bounds.centerX) * bounds.scale;
    yArray[i] = (rawData.y[i] - bounds.centerY) * bounds.scale;
    // Utiliser community modulo 100 comme catégorie (0-99)
    const community = rawData.community[i];
    categoryArray[i] = community >= 0 ? community % 100 : 0;
  }

  return {
    x: xArray,
    y: yArray,
    category: categoryArray,
    // Pas de text/identifier/description pour économiser la mémoire
    // Le tooltip utilisera les index directement
  };
}

/**
 * Concatène plusieurs RawEmbeddingArrays en un seul
 * Utilisé pour le chargement progressif par batch
 */
export function concatRawArrays(
  existing: RawEmbeddingArrays | null,
  newData: RawEmbeddingArrays
): RawEmbeddingArrays {
  if (!existing || existing.count === 0) {
    return newData;
  }

  const totalCount = existing.count + newData.count;
  
  // Créer les nouveaux tableaux concaténés
  const x = new Float32Array(totalCount);
  const y = new Float32Array(totalCount);
  const community = new Uint8Array(totalCount);
  
  // Copier les données existantes
  x.set(existing.x);
  y.set(existing.y);
  community.set(existing.community);
  
  // Ajouter les nouvelles données
  x.set(newData.x, existing.count);
  y.set(newData.y, existing.count);
  community.set(newData.community, existing.count);

  return { x, y, community, count: totalCount };
}

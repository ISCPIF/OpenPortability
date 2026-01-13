'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { GraphNode } from '@/lib/types/graph';
import { FollowingHashStatus } from '@/hooks/usePersonalNetwork';
import { transformNodesToEmbeddingData, calculateNormalizationBounds, EmbeddingData } from '@/lib/utils/graphTransformers';
import { useTheme } from '@/hooks/useTheme';
import { useGraphDataOptional } from '@/contexts/GraphDataContext';
import dynamic from 'next/dynamic';

// Helper to create coordinate hash (same format as used in API)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

const EmbeddingViewWrapper = dynamic(
  () => import('./EmbeddingViewWrapper').then(mod => ({ default: mod.EmbeddingViewWrapper })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1d4ed8] font-mono tracking-wider text-sm">Chargement du graphe...</p>
        </div>
      </div>
    )
  }
);


// ViewportState type from embedding-atlas
interface ViewportState {
  x: number;
  y: number;
  scale: number; // zoom level (embedding-atlas uses 'scale' not 'k')
}

// Cookie name for viewport persistence
const VIEWPORT_COOKIE_NAME = 'graph_viewport_state';
const VIEWPORT_COOKIE_EXPIRY_DAYS = 7;
const GRAPH_UI_COOKIE_NAME = 'graph_ui_state';
const GRAPH_UI_COOKIE_EXPIRY_DAYS = 30;

// Viewport limits - prevent user from zooming/panning too far
const MIN_SCALE = 0.01; // Minimum zoom level (zoomed out)
const MAX_SCALE = 60;  // Maximum zoom level (zoomed in)
const MIN_X = -50;      // Minimum x coordinate (left boundary)
const MAX_X = 50;       // Maximum x coordinate (right boundary)
const MIN_Y = -50;      // Minimum y coordinate (top boundary)
const MAX_Y = 50;       // Maximum y coordinate (bottom boundary)

// Helper to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

// Helper to set cookie
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const cookieString = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  document.cookie = cookieString;
}

// User node type (from context)
interface UserNodeData {
  x: number;
  y: number;
  label: string | null;
  community: number | null;
  tier: string | null;
  degree: number;
}

// Floating label type for public labels
interface FloatingLabelProp {
  coord_hash: string;
  x: number;
  y: number;
  text: string;
  priority: number;
  level: number;
}

interface ReconnectGraphVisualizationProps {
  nodes: GraphNode[];
  width: number;
  height: number;
  hasPersonalNetwork?: boolean;
  isPersonalOnlyView?: boolean; // true when showing only personal network (larger points)
  isMembersView?: boolean; // true when showing HelloQuitteX members highlighted
  isFollowersView?: boolean; // true when showing followers highlighted (points mode)
  viewMode?: 'discover' | 'followings' | 'followers'; // view mode for key generation
  userTwitterId?: string; // @deprecated - use userNode instead
  userNode?: UserNodeData | null; // user's node data from context (coordinates-based identification)
  onNodeSelect?: (node: GraphNode | null) => void;
  onMosaicNodesReady?: (nodes: GraphNode[]) => void; // callback when Mosaic loads nodes from DuckDB
  onGraphReady?: () => void; // callback when graph is fully rendered
  communityColors?: string[]; // colors for communities (from useCommunityColors hook)
  userPointSize?: number; // user-defined point size (from useCommunityColors hook)
  onLassoMembers?: (members: GraphNode[]) => void; // callback when members are selected via lasso
  lassoSelectedMembers?: GraphNode[]; // nodes selected via lasso to highlight
  lassoConnectedIds?: Set<string>; // IDs of nodes that have been successfully connected via lasso
  lassoActiveTab?: 'found' | 'connected'; // which tab is active in the lasso panel
  highlightVersion?: number; // increment to force re-apply highlight selection
  highlightMode?: 'network' | 'node' | 'connected' | 'members' | null; // which highlight to show: network (all personal), node (user only), connected (lasso connected), members (member followers only), or null (all)
  // Hash-based highlighting (RGPD-friendly - no twitter_ids exposed)
  followingHashes?: Map<string, FollowingHashStatus>; // coordinate hashes of following accounts in graph with follow status
  followerHashes?: Set<string>; // coordinate hashes of follower accounts in graph
  // User onboarding status - affects highlight colors for non-onboarded users
  hasOnboarded?: boolean; // if false, force pink (11) for all following nodes since we don't have sources_targets data
  // Public floating labels (for discover mode without GraphDataContext)
  publicFloatingLabels?: FloatingLabelProp[]; // floating labels passed from PublicGraphDataContext
  // Public normalization bounds (for discover mode without GraphDataContext)
  publicNormalizationBounds?: { minX: number; maxX: number; minY: number; maxY: number; scale: number; centerX: number; centerY: number } | null;
  // Highlighted search node (from search in discover mode)
  highlightedSearchNode?: { x: number; y: number; label: string; description: string | null; community: number | null } | null;
}

interface TooltipData {
  x: number;
  y: number;
  category?: number;
  text?: string;
  identifier?: string;
}

export function ReconnectGraphVisualization({
  nodes,
  width,
  height,
  hasPersonalNetwork = false,
  isPersonalOnlyView = false,
  isMembersView = false,
  isFollowersView = false,
  viewMode = 'discover',
  userTwitterId,
  userNode = null,
  onNodeSelect,
  onMosaicNodesReady,
  onGraphReady,
  communityColors: communityColorsProp,
  userPointSize = 2,
  onLassoMembers,
  lassoSelectedMembers = [],
  lassoConnectedIds = new Set<string>(),
  lassoActiveTab = 'found',
  highlightVersion = 0,
  highlightMode = null,
  followingHashes = new Map<string, FollowingHashStatus>(),
  followerHashes = new Set<string>(),
  hasOnboarded = true,
  publicFloatingLabels = [],
  publicNormalizationBounds = null,
  highlightedSearchNode = null,
}: ReconnectGraphVisualizationProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [selection, setSelection] = useState<TooltipData[] | null>(null);
  const [autoSelection, setAutoSelection] = useState<TooltipData[] | null>(null);
  const [lassoSelection, setLassoSelection] = useState<TooltipData[] | null>(null);
  const [searchSelection, setSearchSelection] = useState<TooltipData[] | null>(null);
  const nodeMapRef = useRef<Map<string, GraphNode>>(new Map());
  const embeddingDataRef = useRef<any>(null);
  const normalizationBoundsRef = useRef<any>(null);

  // Viewport state for persistence
  const [viewportState, setViewportState] = useState<ViewportState | null>(() => {
    // Load from cookie on initial render
    const savedUi = getCookie(GRAPH_UI_COOKIE_NAME);
    if (savedUi) {
      try {
        const parsed = JSON.parse(decodeURIComponent(savedUi));
        const vp = parsed?.viewport;
        if (vp && typeof vp.x === 'number' && typeof vp.y === 'number' && typeof vp.scale === 'number') {
          return vp;
        }
      } catch (e) {
        console.warn('📍 [Viewport] Failed to parse saved UI state:', e);
      }
    }

    const saved = getCookie(VIEWPORT_COOKIE_NAME);
    if (saved) {
      try {
        const parsed = JSON.parse(decodeURIComponent(saved));
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number' && typeof parsed.scale === 'number') {
          return parsed;
        }
      } catch (e) {
        console.warn('📍 [Viewport] Failed to parse saved viewport:', e);
      }
    }
    return null;
  });
  const viewportSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Personal labels and normalization bounds from context (fetched centrally)
  // Use optional hook - context may not be available in public/discover mode
  const graphData = useGraphDataOptional();
  
  // Extract values with defaults for when context is not available
  const personalLabelMap = graphData?.personalLabelMap ?? {};
  const personalFloatingLabels = graphData?.personalFloatingLabels ?? [];
  const isPersonalLabelsLoaded = graphData?.isPersonalLabelsLoaded ?? true;
  const fetchPersonalLabels = graphData?.fetchPersonalLabels ?? (async () => {});
  const contextBaseNodes = graphData?.baseNodes ?? [];
  const contextBaseNodesLoaded = graphData?.isBaseNodesLoaded ?? false;
  const contextBaseNodesLoading = graphData?.isBaseNodesLoading ?? false;
  const fetchBaseNodes = graphData?.fetchBaseNodes ?? (async () => {});
  const contextNormalizationBounds = graphData?.normalizationBounds ?? null;

  // Get theme for background color
  const { isDark, colors } = useTheme();

  // Use community colors from prop (managed by Dashboard) or fallback to default
  // Indices 0-9: community colors
  // Index 10: green (#10b981) - reserved
  // Index 11: rose (#ec4899) - followings
  // Index 12: yellow (#fbbf24) - followers (non-members)
  // Index 13: green (#22c55e) - reserved (default)
  // Index 14: blue (#3b82f6) - connected (lasso)
  // Index 15: red (#ef4444) - followers (members)
  const baseCommunityColors = communityColorsProp || [
    '#011959', '#0e3268', '#234b6e', '#3d6370', '#577a6e',
    '#749166', '#97a65c', '#c0b84f', '#ebc844', '#fad541',
    '#10b981', '#ec4899', '#fbbf24', '#22c55e', '#3b82f6', '#ef4444', // special colors: green, rose, yellow, green, blue, red
  ];
  
  // Extend colors array to include lasso selection colors at indices 100, 101, 102
  // Index 100 = Rose/pink for found but not connected
  // Index 101 = Blue for connected
  // Index 102 = Amber/orange for search highlight
  const communityColors = useMemo(() => {
    const colors = [...baseCommunityColors];
    // Pad array to index 100
    while (colors.length < 100) {
      colors.push(baseCommunityColors[colors.length % baseCommunityColors.length]);
    }
    colors[100] = '#ec4899'; // Rose/pink for found
    colors[101] = '#3b82f6'; // Blue for connected
    colors[102] = '#f59e0b'; // Amber/orange for search highlight
    return colors;
  }, [baseCommunityColors]);

  const isMosaicView = !isPersonalOnlyView && !isMembersView && !isFollowersView;

  // Fetch personal labels from context (always, for tooltips in all modes)
  useEffect(() => {
    if (isPersonalLabelsLoaded) return;
    fetchPersonalLabels();
  }, [isPersonalLabelsLoaded, fetchPersonalLabels]);

  // Filtrer les nœuds selon le mode de vue
  const filteredNodes = useMemo(() => {
    if (isMosaicView) {
      return nodes;
    }

    // En mode MEMBRES : afficher uniquement les membres
    if (isMembersView) {
      return nodes.filter(node => node.nodeType === 'member');
    }

    // En mode PERSONAL ou FOLLOWERS : afficher tous les nœuds (le highlighting est géré par mergeGraphWithPersonalNetwork)
    return nodes;
  }, [nodes, isMembersView, isMosaicView]);

  // State pour savoir si les données Mosaic sont en cours de chargement
  // Si des nodes sont déjà fournis en props, pas besoin de charger
  const [isMosaicLoading, setIsMosaicLoading] = useState(nodes.length === 0);

  // Mettre à jour isMosaicLoading quand les nodes arrivent via props
  useEffect(() => {
    if (nodes.length > 0) {
      setIsMosaicLoading(false);
    }
  }, [nodes.length]);

  // Special category index for lasso connected nodes (blue) - defined early for use in combined memo
  const LASSO_CATEGORY_CONNECTED_AUTO = 101;

  // OPTIMIZATION: Pre-compute userNode hash once (avoid computing in loop)
  const userNodeHash = useMemo(() => {
    return userNode ? coordHash(userNode.x, userNode.y) : null;
  }, [userNode]);

  // OPTIMIZATION STEP 1: Compute STATIC data (x, y, identifier, description) only when nodes change
  // This is the expensive part - transforming 658k nodes
  const staticEmbeddingData = useMemo(() => {
    if (filteredNodes.length === 0) {
      nodeMapRef.current.clear();
      embeddingDataRef.current = null;
      return null;
    }

    // Use cached bounds from context if available (for instant label display)
    if (!normalizationBoundsRef.current) {
      if (contextNormalizationBounds) {
        normalizationBoundsRef.current = contextNormalizationBounds;
      } else {
        normalizationBoundsRef.current = calculateNormalizationBounds(nodes);
      }
    }

    const data = transformNodesToEmbeddingData(filteredNodes, normalizationBoundsRef.current);
    
    // Build nodeMap once
    nodeMapRef.current.clear();
    for (let i = 0; i < filteredNodes.length; i++) {
      nodeMapRef.current.set(i.toString(), filteredNodes[i]);
    }
    
    embeddingDataRef.current = data;
    return data;
  }, [filteredNodes, nodes, contextNormalizationBounds]);

  // OPTIMIZATION STEP 2: Pre-compute node hashes for fast lookup (only when nodes change)
  const nodeHashMap = useMemo(() => {
    if (!staticEmbeddingData || filteredNodes.length === 0) return new Map<number, string>();
    
    const hashMap = new Map<number, string>();
    for (let i = 0; i < filteredNodes.length; i++) {
      const node = filteredNodes[i];
      hashMap.set(i, coordHash(node.x, node.y));
    }
    return hashMap;
  }, [filteredNodes, staticEmbeddingData]);

  // OPTIMIZATION STEP 3: Compute DYNAMIC categories separately (fast - just array assignment)
  // This runs when mode changes but doesn't re-transform coordinates
  const { embeddingData, computedAutoSelection } = useMemo<{ embeddingData: EmbeddingData | null; computedAutoSelection: TooltipData[] | null }>(() => {
    if (!staticEmbeddingData || filteredNodes.length === 0) {
      return { embeddingData: null, computedAutoSelection: null };
    }

    // Clone the category array for mutation (x, y, identifier, description stay the same)
    const data = {
      ...staticEmbeddingData,
      category: staticEmbeddingData.category ? new Uint8Array(staticEmbeddingData.category) : undefined,
      text: [...(staticEmbeddingData.text || [])],
    };
    
    let nodesWithMetadata = 0;
    const textArray: string[] = new Array(filteredNodes.length).fill('');
    
    // For auto-selection (personal/followers view only)
    const personalPoints: TooltipData[] = [];
    const shouldComputeAutoSelection = !isMosaicView && (isPersonalOnlyView || isFollowersView);
    
    // Single pass over all nodes - compute categories AND auto-selection
    // OPTIMIZATION: Use pre-computed nodeHashMap instead of computing hash in loop
    for (let index = 0; index < filteredNodes.length; index++) {
      const node = filteredNodes[index];
      
      // En mode MEMBRES : colorer tous les nœuds en vert (catégorie 10)
      if (isMembersView) {
        if (data.category) {
          data.category[index] = 10;
        }
        continue;
      }
      
      // OPTIMIZATION: Use pre-computed hash from nodeHashMap
      const nodeHash = nodeHashMap.get(index) || '';
      const isUserNodeMatch = userNodeHash && nodeHash === userNodeHash;
      
      // Si c'est le nœud de l'utilisateur, catégorie 13 (vert vif)
      if (isUserNodeMatch) {
        if (data.category) {
          data.category[index] = 13;
        }
        if (isPersonalOnlyView || isFollowersView) {
          textArray[index] = '📍 YOU ARE HERE';
        }
        // Add to auto-selection if in personal/followers view
        if (shouldComputeAutoSelection && highlightMode !== 'network') {
          personalPoints.push({
            x: data.x[index],
            y: data.y[index],
            category: data.category ? data.category[index] : undefined,
            identifier: index.toString(),
          });
        }
        continue;
      }
      
      // Hash-based highlighting (nodeHash already computed above)
      const followingStatus = followingHashes.get(nodeHash);
      const isFollowingNode = followingStatus !== undefined;
      const isFollowerNode = followerHashes.size > 0 && followerHashes.has(nodeHash);
      // lassoConnectedIds now contains coord_hashes, not twitter_ids
      const isConnectedNode = lassoConnectedIds.size > 0 && lassoConnectedIds.has(nodeHash);
      
      // Determine if this is a personal node based on view mode
      const isPersonalNode = isPersonalOnlyView ? isFollowingNode : isFollowerNode;
      
      // PRIORITY: Connected nodes get blue color (category 14) regardless of other status
      // This ensures lasso-connected nodes are always visible in blue
      // BUT: In followers view, we don't highlight connected nodes - only followers
      if (isConnectedNode && isPersonalOnlyView) {
        nodesWithMetadata++;
        if (data.category) {
          data.category[index] = 14; // blue for connected
        }
        // Add to auto-selection if in connected mode
        if (shouldComputeAutoSelection) {
          if (highlightMode === 'connected' || highlightMode === null) {
            personalPoints.push({
              x: data.x[index],
              y: data.y[index],
              category: 14,
              identifier: index.toString(),
            });
          }
        }
        continue;
      }
      
      // In followings view: highlight nodes that are in followingHashes
      // Color logic:
      // - 12 (yellow) = already followed on Bluesky or Mastodon
      // - 11 (rose) = has matching (can be followed), not yet followed
      // - 16 (gray) = no matching found (cannot be followed yet)
      // Special case: if hasOnboarded=false, force pink (11) for all nodes since we don't have sources_targets data
      if (isPersonalOnlyView && isFollowingNode) {
        nodesWithMetadata++;
        if (data.category) {
          const isAlreadyFollowed = followingStatus?.hasBlueskyFollow || followingStatus?.hasMastodonFollow;
          const hasMatching = followingStatus?.hasMatching;
          // For non-onboarded users, force pink (11) since they don't have sources_targets yet
          // Priority: followed > has matching > no matching (or force pink if not onboarded)
          data.category[index] = isAlreadyFollowed ? 12 : (hasMatching || !hasOnboarded ? 11 : 16);
        }
        // Add to auto-selection based on highlightMode
        if (shouldComputeAutoSelection) {
          if (highlightMode === 'network' || highlightMode === null) {
            personalPoints.push({
              x: data.x[index],
              y: data.y[index],
              category: data.category ? data.category[index] : undefined,
              identifier: index.toString(),
            });
          }
        }
        continue;
      }
      
      // In followers view: highlight nodes that are in followerHashes
      // Members get red (category 15), non-members get yellow (category 12)
      if (isFollowersView && isFollowerNode) {
        nodesWithMetadata++;
        const isMember = node.nodeType === 'member';
        if (data.category) {
          data.category[index] = isMember ? 15 : 12; // 15 = rouge (member), 12 = jaune (non-member)
        }
        // Add to auto-selection based on highlightMode
        if (shouldComputeAutoSelection) {
          // 'members' mode: only select member followers
          // 'network' or null: select all followers
          const shouldSelect = highlightMode === 'members' 
            ? isMember 
            : (highlightMode === 'network' || highlightMode === null);
          if (shouldSelect) {
            personalPoints.push({
              x: data.x[index],
              y: data.y[index],
              category: data.category ? data.category[index] : undefined,
              identifier: index.toString(),
            });
          }
        }
        continue;
      }
      
      // Handle connected nodes for auto-selection (only in followings view, not followers view)
      if (shouldComputeAutoSelection && isConnectedNode && isPersonalOnlyView) {
        if (highlightMode === 'connected' || highlightMode === null) {
          personalPoints.push({
            x: data.x[index],
            y: data.y[index],
            category: LASSO_CATEGORY_CONNECTED_AUTO,
            identifier: index.toString(),
          });
        }
      }
      
      // Legacy: metadata.isPersonalNetwork
      if (node.metadata?.isPersonalNetwork) {
        nodesWithMetadata++;
        if (data.category) {
          const isAlreadyFollowed = node.metadata.hasBlueskyFollow || node.metadata.hasMastodonFollow;
          data.category[index] = isAlreadyFollowed ? 12 : 11;
        }
        continue;
      }
      
      // Mode normal : communauté comme catégorie (0-9)
      if (data.category && node.community !== null && node.community !== undefined) {
        data.category[index] = node.community % 10;
      }
      
      // In Discover mode: use node.description for tooltip if available
      // Description comes from baseNode (loaded via LEFT JOIN with graph_personal_labels)
      if (isMosaicView && node.description) {
        textArray[index] = `${node.label}\n${node.description}`;
      }
    }
    
    data.text = textArray;
    
    embeddingDataRef.current = data;
    
    // Return both embeddingData and computed auto-selection
    const autoSel = shouldComputeAutoSelection && personalPoints.length > 0 ? personalPoints : null;
    
    return { embeddingData: data, computedAutoSelection: autoSel };
  }, [staticEmbeddingData, filteredNodes, nodeHashMap, userNodeHash, isMembersView, isMosaicView, isFollowersView, isPersonalOnlyView, followingHashes, followerHashes, hasOnboarded, highlightMode, lassoConnectedIds, highlightVersion]);

  // Community colors are now managed by useCommunityColors hook (see line ~70)
  // The hook provides colors with cookie persistence and palette selection

  const pointSize = useMemo(() => {
    // Use user-defined point size as base, with mode-specific adjustments
    const baseSize = userPointSize;
    
    // Mode points (personal, members, followers) : slightly larger for visibility
    if (isPersonalOnlyView || isMembersView || isFollowersView) {
      return Math.max(baseSize, 1); // At least 3px for highlighted views
    }
    if (hasPersonalNetwork) {
      return isMosaicView ? baseSize : Math.max(baseSize * 2, 6);
    }
    return isMosaicView ? baseSize : Math.max(baseSize * 1.5, 4);
  }, [hasPersonalNetwork, isMembersView, isMosaicView, isPersonalOnlyView, isFollowersView, userPointSize]);

  // Community labels
  const COMMUNITY_LABELS: Record<number, string> = useMemo(() => ({
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
  }), []);

  // Calculate static labels from community centroids
  // Use original node community data, not the modified category (which changes for members/personal views)
  const communityLabels = useMemo(() => {
    if (!embeddingData || !embeddingData.x || filteredNodes.length === 0) {
      return [];
    }

    // Calculate centroid for each community using ORIGINAL node community data
    const communityCentroids: Record<number, { sumX: number; sumY: number; count: number }> = {};
    
    for (let i = 0; i < filteredNodes.length && i < embeddingData.x.length; i++) {
      const node = filteredNodes[i];
      const community = node.community;
      const x = embeddingData.x[i];
      const y = embeddingData.y[i];
      // Only consider communities 0-9 with valid coordinates
      if (community != null && community >= 0 && community <= 9 && 
          typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
        if (!communityCentroids[community]) {
          communityCentroids[community] = { sumX: 0, sumY: 0, count: 0 };
        }
        communityCentroids[community].sumX += x;
        communityCentroids[community].sumY += y;
        communityCentroids[community].count++;
      }
    }

    // Create labels at centroids
    const labels: { x: number; y: number; text: string; priority: number; level: number }[] = [];
    for (const [communityStr, centroid] of Object.entries(communityCentroids)) {
      const community = parseInt(communityStr);
      if (centroid.count > 50 && COMMUNITY_LABELS[community]) {
        const labelX = centroid.sumX / centroid.count;
        const labelY = centroid.sumY / centroid.count;
        // Only add label if coordinates are valid
        if (!isNaN(labelX) && !isNaN(labelY) && isFinite(labelX) && isFinite(labelY)) {
          labels.push({
            x: labelX,
            y: labelY,
            text: COMMUNITY_LABELS[community],
            priority: centroid.count, // Higher priority for larger communities
            level: 0,
          });
        }
      }
    }

    return labels;
  }, [embeddingData, filteredNodes, COMMUNITY_LABELS]);

  // Consent-based labels for Discover mode (from API)
  const consentLabels = useMemo(() => {
    const bounds = contextNormalizationBounds || publicNormalizationBounds || normalizationBoundsRef.current;
    const labelsToUse = personalFloatingLabels.length > 0 ? personalFloatingLabels : publicFloatingLabels;
    if (labelsToUse.length > 0 && bounds) {
      return labelsToUse.map(label => ({
        x: (label.x - bounds.centerX) * bounds.scale,
        y: (label.y - bounds.centerY) * bounds.scale,
        text: label.text,
        priority: label.priority,
        level: label.level,
      }));
    }
    return [];
  }, [personalFloatingLabels, publicFloatingLabels, contextNormalizationBounds, publicNormalizationBounds]);

  // Highlighted search node label (for discover mode search)
  // Depend on embeddingData to ensure normalizationBoundsRef is populated
  const searchNodeLabel = useMemo(() => {
    if (!highlightedSearchNode || !isMosaicView) return null;
    
    // embeddingData dependency ensures normalizationBoundsRef.current is set
    if (!embeddingData) return null;
    
    const bounds = contextNormalizationBounds || publicNormalizationBounds || normalizationBoundsRef.current;
    if (!bounds) {
      return null;
    }
    
    const label = {
      x: (highlightedSearchNode.x - bounds.centerX) * bounds.scale,
      y: (highlightedSearchNode.y - bounds.centerY) * bounds.scale,
      text: `🔍 ${highlightedSearchNode.label}`,
      priority: 1000, // Highest priority to always show
      level: 0, // Top level
    };
    return label;
  }, [highlightedSearchNode, isMosaicView, embeddingData, contextNormalizationBounds, publicNormalizationBounds]);

  // Choose which labels to show based on view mode:
  // - Discover: consent labels only (from API) + search node label if present
  // - Followings/Followers: community labels only
  const validLabels = useMemo(() => {
    if (isMosaicView) {
      // Discover mode: show consent labels + search node label
      const labels = consentLabels.length > 0 ? [...consentLabels] : [];
      if (searchNodeLabel) {
        labels.push(searchNodeLabel);
      }
      return labels.length > 0 ? labels : undefined;
    } else {
      // Followings/Followers mode: show community labels
      return communityLabels.length > 0 ? communityLabels : undefined;
    }
  }, [isMosaicView, consentLabels, communityLabels, searchNodeLabel]);

  // REMOVED: Old auto-selection useEffect - now computed in combined useMemo above
  // This avoids iterating over 658k nodes twice
  
  // Sync computedAutoSelection to autoSelection state
  useEffect(() => {
    setAutoSelection(computedAutoSelection);
  }, [computedAutoSelection]);

  // Special category indices for lasso selection colors
  const LASSO_CATEGORY_FOUND = 100; // Rose/pink for found but not connected
  const LASSO_CATEGORY_CONNECTED = 101; // Blue for connected

  // Update lasso selection when lassoSelectedMembers changes (for highlighting in density view)
  useEffect(() => {
    // When "Connected" tab is active, show only connected nodes (even if no lasso selection)
    if (lassoActiveTab === 'connected') {
      if (!isMosaicView || !embeddingData || !embeddingData.x || lassoConnectedIds.size === 0) {
        setLassoSelection(null);
        return;
      }
      
      // Find connected nodes in the embedding data
      // node.id IS the coord_hash (set in GraphDataContext)
      const connectedPoints: TooltipData[] = [];
      for (let i = 0; i < filteredNodes.length; i++) {
        const node = filteredNodes[i];
        if (lassoConnectedIds.has(node.id)) {
          connectedPoints.push({
            x: embeddingData.x[i],
            y: embeddingData.y[i],
            category: LASSO_CATEGORY_CONNECTED,
            identifier: node.id,
          });
        }
      }
      
      setLassoSelection(connectedPoints.length > 0 ? connectedPoints : null);
      return;
    }
    
    // "Found" tab - show lasso-selected members with color based on connection status
    if (!isMosaicView || !embeddingData || !embeddingData.x || lassoSelectedMembers.length === 0) {
      setLassoSelection(null);
      return;
    }

    // Create a Set of lasso-selected node IDs for fast lookup
    const lassoNodeIds = new Set(lassoSelectedMembers.map(n => n.id));
    
    // Find the indices of lasso-selected nodes in the embedding data
    const lassoPoints: TooltipData[] = [];
    for (let i = 0; i < filteredNodes.length; i++) {
      const node = filteredNodes[i];
      if (lassoNodeIds.has(node.id)) {
        // Use special category based on whether node is connected or not
        // node.id IS the coord_hash (set in GraphDataContext)
        const isConnected = lassoConnectedIds.has(node.id);
        lassoPoints.push({
          x: embeddingData.x[i],
          y: embeddingData.y[i],
          category: isConnected ? LASSO_CATEGORY_CONNECTED : LASSO_CATEGORY_FOUND,
          identifier: node.id,
        });
      }
    }
    
    const connectedCount = lassoPoints.filter(p => p.category === LASSO_CATEGORY_CONNECTED).length;
    setLassoSelection(lassoPoints.length > 0 ? lassoPoints : null);
  }, [isMosaicView, embeddingData, filteredNodes, lassoSelectedMembers, lassoConnectedIds, lassoActiveTab]);

  // Combine search and lasso selections (both can be active at the same time)
  const combinedMosaicSelection = useMemo(() => {
    const combined: TooltipData[] = [];
    if (searchSelection) combined.push(...searchSelection);
    if (lassoSelection) combined.push(...lassoSelection);
    if (combined.length === 0) return null;
    return combined;
  }, [searchSelection, lassoSelection]);

  // Callback pour le tooltip
  const handleTooltip = useCallback((dataPoint: TooltipData | null) => {
    setTooltip(dataPoint);
  }, []);

  // Special category index for search highlight (amber/orange color)
  const SEARCH_CATEGORY = 102;

  // Center view on highlighted search node and create selection for highlighting
  // Depend on embeddingData to ensure bounds are computed first
  useEffect(() => {
    if (!highlightedSearchNode || !isMosaicView) {
      setSearchSelection(null);
      return;
    }
    
    // Wait for embedding data to be ready (which means bounds are computed)
    if (!embeddingData) {
      return;
    }
    
    const bounds = contextNormalizationBounds || publicNormalizationBounds || normalizationBoundsRef.current;
    
    if (!bounds) {
      return;
    }
    
    // Convert to normalized coordinates
    const normalizedX = (highlightedSearchNode.x - bounds.centerX) * bounds.scale;
    const normalizedY = (highlightedSearchNode.y - bounds.centerY) * bounds.scale;
    
    // Set viewport to center on the node with a reasonable zoom level
    const newViewport: ViewportState = {
      x: normalizedX,
      y: normalizedY,
      scale: 8, // Zoom in to see the node clearly
    };
    
    setViewportState(newViewport);
    
    // Create selection for highlighting the searched node
    const searchPoint: TooltipData = {
      x: normalizedX,
      y: normalizedY,
      category: SEARCH_CATEGORY,
      text: highlightedSearchNode.label,
    };
    setSearchSelection([searchPoint]);
    
    // Save to cookie
    const serialized = JSON.stringify(newViewport);
    setCookie(VIEWPORT_COOKIE_NAME, serialized, VIEWPORT_COOKIE_EXPIRY_DAYS);
    const uiSerialized = JSON.stringify({ viewMode, viewport: newViewport });
    setCookie(GRAPH_UI_COOKIE_NAME, uiSerialized, GRAPH_UI_COOKIE_EXPIRY_DAYS);
  }, [highlightedSearchNode, isMosaicView, embeddingData, contextNormalizationBounds, publicNormalizationBounds]);

  // Callback for viewport state changes - debounced save to cookie
  // Also clamps zoom level and position to prevent infinite zoom out / panning
  const handleViewportState = useCallback((state: ViewportState) => {
    // Clamp all values to limits
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale));
    const clampedX = Math.max(MIN_X, Math.min(MAX_X, state.x));
    const clampedY = Math.max(MIN_Y, Math.min(MAX_Y, state.y));
    const needsClamp = clampedScale !== state.scale || clampedX !== state.x || clampedY !== state.y;
    
    // If any value was clamped, update the viewport state to force embedding-atlas to respect limits
    if (needsClamp) {
      const clampedState: ViewportState = { x: clampedX, y: clampedY, scale: clampedScale };
      setViewportState(clampedState);
      // Save clamped state to cookie
      const serialized = JSON.stringify(clampedState);
      setCookie(VIEWPORT_COOKIE_NAME, serialized, VIEWPORT_COOKIE_EXPIRY_DAYS);
      const uiSerialized = JSON.stringify({ viewMode, viewport: clampedState });
      setCookie(GRAPH_UI_COOKIE_NAME, uiSerialized, GRAPH_UI_COOKIE_EXPIRY_DAYS);
      return;
    }
    
    // Debounce cookie save to avoid too many writes
    if (viewportSaveTimeoutRef.current) {
      clearTimeout(viewportSaveTimeoutRef.current);
    }
    viewportSaveTimeoutRef.current = setTimeout(() => {
      const serialized = JSON.stringify(state);
      setCookie(VIEWPORT_COOKIE_NAME, serialized, VIEWPORT_COOKIE_EXPIRY_DAYS);
      const uiSerialized = JSON.stringify({ viewMode, viewport: state });
      setCookie(GRAPH_UI_COOKIE_NAME, uiSerialized, GRAPH_UI_COOKIE_EXPIRY_DAYS);
    }, 500); // 500ms debounce
  }, [viewMode]);

  // Helper function to check if a point is inside a polygon (ray casting algorithm)
  const isPointInPolygon = useCallback((x: number, y: number, polygon: { x: number; y: number }[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }, []);

  // Callback pour la sélection lasso (range selection)
  const handleRangeSelection = useCallback((rangeData: { x: number; y: number }[] | { x: number; y: number; width: number; height: number } | null) => {
    
    if (!onLassoMembers) {
      return;
    }
    
    // If rangeData is null, clear the selection
    if (!rangeData) {
      onLassoMembers([]);
      return;
    }

    const data = embeddingDataRef.current;
    if (!data || !data.x) {
      return;
    }

    const selectedNodes: GraphNode[] = [];
    
    // Check if it's a polygon (lasso) or rectangle
    if (Array.isArray(rangeData)) {
      // Lasso selection - polygon
      
      for (let i = 0; i < data.x.length; i++) {
        const px = data.x[i];
        const py = data.y[i];
        
        if (isPointInPolygon(px, py, rangeData)) {
          const node = nodeMapRef.current.get(i.toString());
          if (node) {
            selectedNodes.push(node);
          }
        }
      }
    } else if ('xMin' in rangeData && 'xMax' in rangeData && 'yMin' in rangeData && 'yMax' in rangeData) {
      // Rectangle selection from embedding-atlas: {xMin, yMin, xMax, yMax}
      const { xMin, yMin, xMax, yMax } = rangeData as { xMin: number; yMin: number; xMax: number; yMax: number };
      
      // Convert rectangle to polygon (same format as lasso)
      const rectPolygon = [
        { x: xMin, y: yMin },
        { x: xMax, y: yMin },
        { x: xMax, y: yMax },
        { x: xMin, y: yMax },
      ];
            
      for (let i = 0; i < data.x.length; i++) {
        const px = data.x[i];
        const py = data.y[i];
        
        if (isPointInPolygon(px, py, rectPolygon)) {
          const node = nodeMapRef.current.get(i.toString());
          if (node) {
            selectedNodes.push(node);
          }
        }
      }
    } else if ('width' in rangeData && 'height' in rangeData) {
      // Rectangle selection (legacy format): {x, y, width, height}
      const { x, y, width, height } = rangeData as { x: number; y: number; width: number; height: number };
      
      // Normalize rectangle bounds (handle negative width/height)
      const minX = width >= 0 ? x : x + width;
      const maxX = width >= 0 ? x + width : x;
      const minY = height >= 0 ? y : y + height;
      const maxY = height >= 0 ? y + height : y;
      
      // Convert rectangle to polygon (same format as lasso)
      const rectPolygon = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      
      for (let i = 0; i < data.x.length; i++) {
        const px = data.x[i];
        const py = data.y[i];
        
        if (isPointInPolygon(px, py, rectPolygon)) {
          const node = nodeMapRef.current.get(i.toString());
          if (node) {
            selectedNodes.push(node);
          }
        }
      }
    }

    // Filter for members only - lasso selection should only highlight member nodes
    const members = selectedNodes.filter(n => n.nodeType === 'member');
    
    onLassoMembers(members);
  }, [onLassoMembers, isPointInPolygon]);

  // Callback pour la sélection (point selection et fallback pour rectangle selection)
  const handleSelection = useCallback((selectedPoints: TooltipData[] | null) => {
    if (selectedPoints && Array.isArray(selectedPoints) && selectedPoints.length > 0) {
      // Single point selection - for node details
      if (selectedPoints.length === 1) {
        const point = selectedPoints[0];
        const nodeIndex = point.identifier;
        const node = nodeIndex !== undefined ? nodeMapRef.current.get(nodeIndex.toString()) : null;
        onNodeSelect?.(node || null);
      } else {
        // Multi-point selection (lasso/rectangle) - filter members and call onLassoMembers
        onNodeSelect?.(null);
        
        if (onLassoMembers && isMosaicView) {
          const selectedMembers: GraphNode[] = [];
          const allSelectedNodes: GraphNode[] = [];
          
          for (const point of selectedPoints) {
            const nodeIndex = point.identifier;
            if (nodeIndex !== undefined) {
              const node = nodeMapRef.current.get(nodeIndex.toString());
              if (node) {
                allSelectedNodes.push(node);
                if (node.nodeType === 'member') {
                  selectedMembers.push(node);
                }
              }
            }
          }
          
          // If we have members, use them; otherwise use all selected nodes
          const nodesToFollow = selectedMembers.length > 0 ? selectedMembers : allSelectedNodes;
          
          if (nodesToFollow.length > 0) {
            onLassoMembers(nodesToFollow);
          }
        }
      }
    } else {
      onNodeSelect?.(null);
    }
    setSelection(selectedPoints);
  }, [onNodeSelect, onLassoMembers, isMosaicView]);

  // Fonction pour trouver le point le plus proche
  const querySelection = useMemo(() => {
    const fn = async (x: number, y: number, unitDistance: number): Promise<any> => {
      try {
        const data = embeddingDataRef.current;
        if (!data || !data.x) return null;
        
        let closestIndex = -1;
        let minDistance = unitDistance * 20;
        
        for (let index = 0; index < data.x.length; index++) {
          const nodeX = data.x[index];
          const nodeY = data.y[index];
          const dx = nodeX - x;
          const dy = nodeY - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        }
        
        if (closestIndex === -1) return null;
        
        return {
          x: data.x[closestIndex],
          y: data.y[closestIndex],
          category: data.category?.[closestIndex] ?? 0,
          text: data.text?.[closestIndex] ?? '',
          identifier: data.identifier?.[closestIndex] ?? closestIndex.toString()
        };
      } catch (error) {
        console.error('Error in querySelection:', error);
        return null;
      }
    };
    return fn;
  }, []);

  // Composant personnalisé pour le tooltip
  const CustomTooltip = useCallback(({ tooltip: tooltipData }: { tooltip: TooltipData }) => {
    const nodeIndex = tooltipData.identifier;
    const node = nodeIndex !== undefined ? nodeMapRef.current.get(nodeIndex.toString()) : null;

    if (!node) {
      return (
        <div className="bg-gray-900/95 text-white px-3 py-2 rounded-lg shadow-xl text-sm backdrop-blur-sm border border-white/10">
          <p>Point ({tooltipData.x.toFixed(2)}, {tooltipData.y.toFixed(2)})</p>
        </div>
      );
    }

    const isPersonal = node.metadata?.isPersonalNetwork;

    return (
      <div className={`px-4 py-3 rounded-lg shadow-xl text-sm max-w-xs backdrop-blur-sm border ${
        isPersonal 
          ? 'bg-yellow-900/95 text-yellow-50 border-yellow-500/30' 
          : 'bg-gray-900/95 text-white border-white/10'
      }`}>
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate">{node.label || 'Unknown'}</p>
          {isPersonal && (
            <span className="text-xs bg-yellow-500 text-yellow-900 px-2 py-0.5 rounded-full font-medium">
              Mon réseau
            </span>
          )}
        </div>
        <div className={`mt-2 space-y-1 text-xs ${isPersonal ? 'text-yellow-100' : 'text-gray-200'}`}>
          <p><span className={isPersonal ? 'text-yellow-300' : 'text-gray-400'}>Tier:</span> <span className="capitalize">{node.tier}</span></p>
          <p><span className={isPersonal ? 'text-yellow-300' : 'text-gray-400'}>Degree:</span> {node.degree}</p>
          {isPersonal && node.metadata && (
            <div className="mt-2 pt-2 border-t border-yellow-700/50">
              {node.metadata.hasBlueskyFollow && (
                <p className="flex items-center gap-1">
                  <span className="text-yellow-300">🦋</span>
                  <span className="text-yellow-100">{node.metadata.blueskyHandle || 'Suivi'}</span>
                </p>
              )}
              {node.metadata.hasMastodonFollow && (
                <p className="flex items-center gap-1">
                  <span className="text-yellow-300">🐘</span>
                  <span className="text-yellow-100">{node.metadata.mastodonHandle || 'Suivi'}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, []);

  const viewConfig = useMemo(() => {
    const colorScheme = isDark ? 'dark' : 'light';
    
    if (isPersonalOnlyView || isMembersView || isFollowersView) {
      return {
        mode: 'points',
        pointSize,
        colorScheme,
      };
    }

    return {
      mode: 'points',
      pointSize,
      colorScheme,
    };
  }, [isMembersView, isPersonalOnlyView, isFollowersView, pointSize, isDark]);

  // Memoize theme to avoid recreating object on each render
  // Adapt label colors based on theme
  const embeddingTheme = useMemo(() => ({
    fontFamily: 'system-ui, -apple-system, sans-serif',
    statusBar: true,
    backgroundColor: colors.background, // Use theme background (#0a0f1f dark, #ffffff light)
    clusterLabelColor: isDark ? '#ffffff' : '#0a0f1f',
    clusterLabelOutlineColor: isDark ? '#000000' : '#ffffff',
    clusterLabelOpacity: 1,
  }), [isDark, colors.background]);

  // Memoize customTooltip config - don't include tooltip in deps to avoid re-renders on hover
  const customTooltipConfig = useMemo(() => ({
    component: CustomTooltip,
  }), [CustomTooltip]);
  
  // Track if component is mounted (client-side only)
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Callback interne pour gérer le chargement Mosaic (doit être avant les returns conditionnels)
  const handleMosaicNodesReady = useCallback((loadedNodes: GraphNode[]) => {
    setIsMosaicLoading(false);
    if (onMosaicNodesReady) {
      onMosaicNodesReady(loadedNodes);
    }
  }, [onMosaicNodesReady]);

  // Charger les données via le contexte GraphData (centralisé)
  // On charge les données Mosaic seulement si pas de nodes en props
  // Le Dashboard charge les nodes via onMosaicNodesReady et les passe ensuite en props
  const shouldLoadMosaic = nodes.length === 0;
  
  // Fetch base nodes from context if needed
  useEffect(() => {
    if (!shouldLoadMosaic || !isMosaicLoading || !isMounted) return;
    
    // If context already has nodes, use them
    if (contextBaseNodesLoaded && contextBaseNodes.length > 0) {
      handleMosaicNodesReady(contextBaseNodes);
      return;
    }
    
    // If context is loading, wait for it
    if (contextBaseNodesLoading) {
      return;
    }
    
    // Trigger fetch from context
    fetchBaseNodes();
  }, [shouldLoadMosaic, isMosaicLoading, isMounted, contextBaseNodesLoaded, contextBaseNodes, contextBaseNodesLoading, fetchBaseNodes, handleMosaicNodesReady]);
  
  // When context base nodes are loaded, pass them to the callback
  useEffect(() => {
    if (!shouldLoadMosaic || !isMosaicLoading) return;
    if (contextBaseNodesLoaded && contextBaseNodes.length > 0) {
      handleMosaicNodesReady(contextBaseNodes);
    }
  }, [shouldLoadMosaic, isMosaicLoading, contextBaseNodesLoaded, contextBaseNodes, handleMosaicNodesReady]);

  // NOTE: Web Worker code for followers loading has been removed
  // All modes now use the same baseNodes data from GraphDataContext/Mosaic
  // Highlighting is done via coordinate hashes (followingHashes, followerHashes)

  // Afficher le spinner pendant le chargement (fond transparent pour voir les particules)
  if (!isMounted || (shouldLoadMosaic && isMosaicLoading)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1d4ed8] font-mono tracking-wider text-sm">Chargement du graphe...</p>
        </div>
      </div>
    );
  }

  // All modes now use the same embeddingData (baseNodes from /api/mosaic/query)
  // Highlighting is done via coordinate hashes, not by loading different data
  const finalEmbeddingData = embeddingData;

  // Same loading condition for all modes - use embeddingData from baseNodes
  const isDataReady = filteredNodes.length > 0 && embeddingData !== null;

  if (!isDataReady) {
    const loadingLabel = isPersonalOnlyView
      ? 'Chargement de ton réseau personnel...'
      : isMembersView
        ? 'Chargement des membres OP...'
        : isFollowersView
          ? 'Chargement du graphe followers...'
          : 'Chargement du graphe...';

    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1d4ed8] font-mono tracking-wider text-sm">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  // Note: We no longer use viewMode in the key to preserve viewport state when switching
  // between Following/Followers modes. The highlighting is handled via selection prop updates.
  // Only force remount when explicitly requested via parent's viewResetKey.

  // Mode standard (personal network / members) : utilise EmbeddingView avec données locales
  return (
    <div className="w-full h-full relative">
      <EmbeddingViewWrapper
        data={finalEmbeddingData!}
        width={width}
        height={height}
        categoryColors={communityColors}
        labels={validLabels}
        tooltip={tooltip}
        selection={isMosaicView ? (combinedMosaicSelection ?? autoSelection ?? selection ?? undefined) : (isPersonalOnlyView || isMembersView || isFollowersView) ? (autoSelection ?? undefined) : (selection ?? undefined)}
        onTooltip={handleTooltip}
        onSelection={isMosaicView ? handleSelection : (isPersonalOnlyView || isMembersView || isFollowersView) ? undefined : handleSelection}
        onRangeSelection={isMosaicView ? handleRangeSelection : undefined}
        querySelection={isFollowersView ? undefined : querySelection}
        // customTooltip disabled - causes WeakMap errors with React components
        // customTooltip={customTooltipConfig}
        selectionLocked={isPersonalOnlyView || isMembersView || isFollowersView}
        variant="standard"
        config={viewConfig}
        theme={embeddingTheme}
        onReady={onGraphReady}
        viewportState={viewportState}
        onViewportState={handleViewportState}
      />
    </div>
  );
}
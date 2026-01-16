'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/hooks/useTheme';
import { usePersonalNetwork } from '@/hooks/usePersonalNetwork';
import { useGraphData, graphDataEvents } from '@/contexts/GraphDataContext';
import { FloatingStatsPanel } from './panels/FloatingStatsPanel';
import { FloatingAccountsPanel } from './panels/FloatingAccountsPanel';
import { FloatingDiscoverPanel } from './panels/FloatingDiscoverPanel';
import { FloatingProgressPanel } from './panels/FloatingProgressPanel';
import { FloatingFollowersCommunityPanel } from './panels/FloatingFollowersCommunityPanel';
import { MobileFollowersCommunityStats } from './panels/MobileFollowersCommunityStats';
import { FloatingLassoSelectionPanel } from './panels/FloatingLassoSelectionPanel';
import { ParticulesBackground } from '../layouts/ParticulesBackground';
import { CommunityColorPicker } from './CommunityColorPicker';
import { useCommunityColors } from '@/hooks/useCommunityColors';
import { useAuthRefresh } from '@/hooks/useAuthRefresh';
import { GraphNode } from '@/lib/types/graph';
import { MatchingTarget } from '@/lib/types/matching';
import { ReconnectLoginModal } from '../modales/ReconnectLoginModal';
import { MigrationSuccessModal } from '../modales/MigrationSuccessModal';
import { IntroOverlay } from './IntroOverlay';
import { ConsentLabelModal } from './ConsentLabelModal';
import { Lock } from 'lucide-react';

// Dynamic import to avoid SSR issues with embedding-atlas WASM
const ReconnectGraphVisualization = dynamic(
  () => import('./ReconnectGraphVisualization').then(mod => mod.ReconnectGraphVisualization),
  { ssr: false }
);

interface PlatformResult {
  succeeded: number;
  failed: number;
  failures: { handle: string; error: string }[];
}

interface ReconnectGraphDashboardProps {
  session: any;
  stats: any;
  accountsToProcess: MatchingTarget[];
  setAccountsToProcess: (accounts: MatchingTarget[]) => void;
  isAutomaticReconnect: boolean;
  isMigrating?: boolean;
  migrationResults: {
    bluesky: PlatformResult | null;
    mastodon: PlatformResult | null;
  } | null;
  onStartMigration: (selectedAccounts: string[], onComplete?: () => void, onUpdateFollowingStatus?: (coordHashes: string[], platform: 'bluesky' | 'mastodon', followed: boolean) => void) => void;
  onToggleAutomaticReconnect: () => void;
  onStartAutomaticReconnection?: () => void;
  onStopMigration?: () => void;
  selectedAccountsCount?: number;
  mastodonInstances?: string[];
  invalidTokenProviders?: string[];
  onClearInvalidTokenProviders?: () => void;
  selectedBreakdown?: { bluesky: number; mastodon: number } | null;
  globalStats?: {
    users: { total: number; onboarded: number };
    connections: {
      followers: number;
      following: number;
      followedOnBluesky: number;
      followedOnMastodon: number;
    };
  };
}

export function ReconnectGraphDashboard({
  session,
  stats,
  accountsToProcess,
  setAccountsToProcess,
  isAutomaticReconnect,
  isMigrating = false,
  migrationResults,
  onStartMigration,
  onToggleAutomaticReconnect,
  onStartAutomaticReconnection,
  onStopMigration,
  selectedAccountsCount = 0,
  mastodonInstances = [],
  invalidTokenProviders = [],
  onClearInvalidTokenProviders,
  selectedBreakdown,
  globalStats,
}: ReconnectGraphDashboardProps) {
  const { isDark } = useTheme();
  const { colors: communityColors } = useCommunityColors();
  const t = useTranslations('reconnectDashboard');
  
  // Mobile detection - on mobile we skip graph loading and only show accounts panel
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  
  // Update isMobile on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Loader contrast color: light on dark theme, dark on light theme
  const loaderContrastColor = isDark 
    ? (communityColors[9] || communityColors[8] || '#fad541')
    : (communityColors[0] || communityColors[1] || '#011959');
  
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  // View mode: 'discover' = Mosaic (DuckDB), 'followings' = following network, 'followers' = followers network
  const hasOnboarded = session?.user?.has_onboarded ?? false;
  const hasTwitterUsername = !!session?.user?.twitter_username;
  
  // Use GraphDataContext for personal data (matching + hashes)
  const graphData = useGraphData();
  
  // Get initial view mode from cookie - always start with cookie value or 'discover'
  // On mobile: always force 'followings' mode to show FloatingAccountsPanel
  // We'll switch to 'followings' later once hashes are confirmed loaded
  const getInitialViewMode = (): 'discover' | 'followings' | 'followers' => {
    if (typeof window !== 'undefined') {
      // On mobile, always force followings mode
      if (window.innerWidth < 768) {
        return 'followings';
      }

      const savedUi = document.cookie
        .split('; ')
        .find(row => row.startsWith('graph_ui_state='))
        ?.split('=')[1];

      if (savedUi) {
        try {
          const parsed = JSON.parse(decodeURIComponent(savedUi));
          const savedViewMode = parsed?.viewMode as 'discover' | 'followings' | 'followers' | undefined;
          if (savedViewMode && ['discover', 'followings', 'followers'].includes(savedViewMode)) {
            return savedViewMode;
          }
        } catch {
          // ignore malformed cookie
        }
      }
      
      const savedViewMode = document.cookie
        .split('; ')
        .find(row => row.startsWith('graph_view_mode='))
        ?.split('=')[1] as 'discover' | 'followings' | 'followers' | undefined;
      
      if (savedViewMode && ['discover', 'followings', 'followers'].includes(savedViewMode)) {
        return savedViewMode;
      }
    }
    // Default to discover - we'll switch to followings once hashes are loaded
    return 'discover';
  };
  
  const [viewMode, setViewModeState] = useState<'discover' | 'followings' | 'followers'>(getInitialViewMode);
  const hasAutoSwitchedToFollowings = useRef(false);
  const hasFetchedLassoStats = useRef(false);
  
  // Wrapper to save view mode to cookie when it changes
  const setViewMode = useCallback((mode: 'discover' | 'followings' | 'followers') => {
    setViewModeState(mode);
    // Save to cookie with 30 day expiry
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    document.cookie = `graph_view_mode=${mode}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
      return null;
    };

    const setCookie = (name: string, value: string, days: number): void => {
      const exp = new Date();
      exp.setTime(exp.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp.toUTCString()};path=/;SameSite=Lax`;
    };

    let viewport: any = null;
    const existingUi = getCookie('graph_ui_state');
    if (existingUi) {
      try {
        const parsed = JSON.parse(decodeURIComponent(existingUi));
        viewport = parsed?.viewport ?? null;
      } catch {
        viewport = null;
      }
    }
    if (!viewport) {
      const legacyViewport = getCookie('graph_viewport_state');
      if (legacyViewport) {
        try {
          viewport = JSON.parse(decodeURIComponent(legacyViewport));
        } catch {
          viewport = null;
        }
      }
    }
    setCookie('graph_ui_state', JSON.stringify({ viewMode: mode, viewport: viewport || undefined }), 30);
  }, []);
  // Nœuds récupérés depuis Mosaic (DuckDB)
  const [mosaicNodes, setMosaicNodes] = useState<GraphNode[]>([]);
  // État pour savoir si le graphe est complètement rendu (overlay de chargement)
  const [isGraphRendered, setIsGraphRendered] = useState(false);
  const [loadingMessageKey, setLoadingMessageKey] = useState<'graph' | 'initializing'>('graph');
  // Key to force remount of graph component (for reset view)
  const [viewResetKey, setViewResetKey] = useState(0);
  // Membres sélectionnés via lasso
  const [lassoSelectedMembers, setLassoSelectedMembersState] = useState<GraphNode[]>([]);
  const [isLassoSelectionLoaded, setIsLassoSelectionLoaded] = useState(false);
  
  // Highlighted node from search (in discover mode)
  const [highlightedSearchNode, setHighlightedSearchNode] = useState<{
    x: number;
    y: number;
    label: string;
    description: string | null;
    community: number | null;
  } | null>(null);
  
  // V2 Intro overlay state - use cookie to avoid repeated checks
  // Check if user should see intro (cookie or session)
  const shouldShowIntro = useMemo(() => {
    if (typeof document === 'undefined') return false;
    
    // Check cookie first
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('hqx_seen_v2='))
      ?.split('=')[1];
    if (cookieValue === 'true') return false;
    
    // Then check session
    if (session?.user?.have_seen_v2) return false;
    
    return true;
  }, [session?.user?.have_seen_v2]);
  
  // Only show overlay AFTER graph is rendered
  const [showIntroOverlay, setShowIntroOverlay] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [introInitialStep, setIntroInitialStep] = useState(0);
  
  // Trigger intro overlay when graph is ready
  useEffect(() => {
    if (isGraphRendered && shouldShowIntro && !showIntroOverlay) {
      setShowIntroOverlay(true);
    }
  }, [isGraphRendered, shouldShowIntro]);
  
  const setIntroSeenCookie = useCallback(() => {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
    document.cookie = `hqx_seen_v2=true;expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }, []);

  // Consent label modal state - show after intro is dismissed (if authenticated)
  const CONSENT_COOKIE_NAME = 'hqx_consent_label_shown';
  
  const shouldShowConsentModal = useMemo(() => {
    if (typeof document === 'undefined') return false;
    if (!session?.user?.id) return false; // Only for authenticated users
    
    // Check cookie
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${CONSENT_COOKIE_NAME}=`))
      ?.split('=')[1];
    if (cookieValue === 'true') return false;
    
    return true;
  }, [session?.user?.id]);
  
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  // Show consent modal after intro is dismissed (or immediately if intro was already seen)
  // On mobile, we don't wait for graph to render (graph is not loaded on mobile)
  useEffect(() => {
    const isReady = isMobile || isGraphRendered;
    if (isReady && shouldShowConsentModal && !showIntroOverlay && !showConsentModal) {
      // Small delay after intro dismissal
      const timer = setTimeout(() => {
        setShowConsentModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isMobile, isGraphRendered, shouldShowConsentModal, showIntroOverlay]);
  
  const setConsentSeenCookie = useCallback(() => {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
    document.cookie = `${CONSENT_COOKIE_NAME}=true;expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }, []);
  
  const handleConsentDismiss = useCallback(() => {
    setShowConsentModal(false);
    setConsentSeenCookie();
  }, [setConsentSeenCookie]);
  
  const handleConsentSaved = useCallback(() => {
    setConsentSeenCookie();
  }, [setConsentSeenCookie]);
  
  const LASSO_STORAGE_KEY = 'hqx_lasso_selection';
  
  // Helper to get/set sessionStorage for lasso selection (RGPD compliant - no cookies)
  const getLassoSelection = useCallback((): string[] | null => {
    if (typeof window === 'undefined') return null;
    try {
      const value = sessionStorage.getItem(LASSO_STORAGE_KEY);
      if (value) {
        return JSON.parse(value);
      }
    } catch {
      return null;
    }
    return null;
  }, []);
  
  const setLassoSelection = useCallback((nodeIds: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(LASSO_STORAGE_KEY, JSON.stringify(nodeIds));
    } catch {
      // Ignore storage errors
    }
  }, []);
  
  const deleteLassoSelection = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(LASSO_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);
  
  // Wrapper to save lasso selection to sessionStorage when it changes
  const setLassoSelectedMembers = useCallback((members: GraphNode[]) => {
    setLassoSelectedMembersState(members);
    if (members.length > 0) {
      const nodeIds = members.map(m => m.id);
      setLassoSelection(nodeIds);
    } else {
      deleteLassoSelection();
    }
  }, [setLassoSelection, deleteLassoSelection]);

  // Theme colors for background
  const { colors } = useTheme();

  // Community colors - managed at Dashboard level to share between picker and visualization
  const communityColorsHook = useCommunityColors();

  // Auth refresh check - determines if user can access personal network views
  const {
    isChecking: isCheckingAuth,
    isValid: isAuthValid,
    requiresReauth,
    invalidProviders,
    noAccountsConfigured,
    recheckAuth,
  } = useAuthRefresh();

  // Modal state for login prompt
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [hasUserDismissedModal, setHasUserDismissedModal] = useState(false);
  
  // Modal state for migration success
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Modal state for lasso migration success
  const [showLassoSuccessModal, setShowLassoSuccessModal] = useState(false);
  
  // State to control progress panel visibility (user can close it)
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  // Key to force re-mount of FloatingProgressPanel when a new migration starts
  // This resets internal state (initialTotals, hasCalledComplete)
  const [migrationKey, setMigrationKey] = useState(0);
  
  // State for lasso migration (separate from main migration flow)
  const [lassoMigrationResults, setLassoMigrationResults] = useState<{
    bluesky: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null;
    mastodon: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null;
  } | null>(null);
  const [lassoSelectedBreakdown, setLassoSelectedBreakdown] = useState<{ bluesky: number; mastodon: number } | null>(null);
  const [lassoSelectedCount, setLassoSelectedCount] = useState(0);
  const [isLassoMigrating, setIsLassoMigrating] = useState(false);
  
  // Handlers for lasso migration callbacks
  const handleLassoMigrationStart = useCallback((breakdown: { bluesky: number; mastodon: number }, selectedCount: number) => {
    setLassoSelectedBreakdown(breakdown);
    setLassoSelectedCount(selectedCount);
    setLassoMigrationResults({
      bluesky: { succeeded: 0, failed: 0, failures: [] },
      mastodon: { succeeded: 0, failed: 0, failures: [] }
    });
    setIsLassoMigrating(true);
    setShowProgressPanel(true);
  }, []);
  
  const handleLassoMigrationProgress = useCallback((results: {
    bluesky: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null;
    mastodon: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null;
  }) => {
    setLassoMigrationResults(results);
  }, []);
  
  const handleLassoMigrationComplete = useCallback(() => {
    setIsLassoMigrating(false);
    // Show success modal when lasso migration completes
    setShowLassoSuccessModal(true);
    setShowProgressPanel(false);
  }, []);
  
  // State for lasso panel active tab (to control highlight)
  const [lassoActiveTab, setLassoActiveTab] = useState<'found' | 'connected'>('found');
  
  // State for hint mode (single step overlay, click to dismiss)
  const [introHintMode, setIntroHintMode] = useState(false);
  
  // Handler to show lasso help overlay (step 2 of intro) as a hint
  const handleShowLassoHelp = useCallback(() => {
    setIntroInitialStep(2); // Step 2 is the lasso tutorial
    setIntroHintMode(true); // Enable hint mode
    setShowIntroOverlay(true);
  }, []);
  
  // State for highlight controls (re-trigger highlight when user clicks buttons)
  const [highlightVersion, setHighlightVersion] = useState(0);
  const [highlightMode, setHighlightMode] = useState<'network' | 'node' | 'connected' | 'members' | null>(null);
  
  // Listen for followingHashes updates (after follow actions) to refresh visualization
  useEffect(() => {
    const unsubscribe = graphData.subscribeToUpdates('followingHashesUpdated', () => {
      setHighlightVersion(v => v + 1);
    });
    return unsubscribe;
  }, [graphData]);
  
  // Callbacks for highlight buttons
  const handleShowMyNetwork = useCallback(() => {
    setHighlightMode('network');
    setHighlightVersion(v => v + 1);
  }, []);
  
  const handleShowMyNode = useCallback(() => {
    setHighlightMode('node');
    setHighlightVersion(v => v + 1);
  }, []);
  
  const handleShowConnected = useCallback(() => {
    setHighlightMode('connected');
    setHighlightVersion(v => v + 1);
  }, []);

  const handleShowEffectiveFollowers = useCallback(() => {
    setHighlightMode('effective');
    setHighlightVersion(v => v + 1);
  }, []);
  
  // Derive showFollowing/showFollowers from viewMode
  const showFollowing = viewMode === 'followings';
  const showFollowers = viewMode === 'followers';
  
  // Flag to force show panels during intro regardless of view mode
  const isOnIntro = showIntroOverlay;
  const introShowLassoPanel = isOnIntro && introStep === 2;
  const introShowAccountsPanel = isOnIntro && introStep === 3;
  // Hide stats panel during entire intro
  const introHideStatsPanel = isOnIntro;
  // Hide accounts panel when showing lasso panel (step 2)
  const introHideAccountsPanel = isOnIntro && introStep === 2;
  // Hide lasso panel when showing accounts panel (step 3)
  const introHideLassoPanel = isOnIntro && introStep === 3;
  // Hide all panels during step 1 (graph canvas focus)
  const introHidePanels = isOnIntro && introStep === 0;

  // Note: On ne force plus le mode followings automatiquement
  // L'utilisateur peut rester en mode discover même s'il a un réseau personnel

  // Show login modal when auth check fails (but only once)
  // Don't show modal if user has twitter_username - they can still see their network from matching_found
  useEffect(() => {
    if (!isCheckingAuth && requiresReauth && !hasUserDismissedModal && !hasTwitterUsername) {
      setShowLoginModal(true);
    }
  }, [isCheckingAuth, requiresReauth, hasUserDismissedModal, hasTwitterUsername]);

  // Show login modal when token validation fails during migration (from useReconnectState)
  useEffect(() => {
    if (invalidTokenProviders && invalidTokenProviders.length > 0) {
      setShowLoginModal(true);
    }
  }, [invalidTokenProviders]);

  // Handle modal close - user chose to continue with discover view only
  const handleLoginModalClose = useCallback(() => {
    setShowLoginModal(false);
    setHasUserDismissedModal(true);
    // Force discover view when user dismisses modal
    setViewMode('discover');
  }, []);

  // Handle successful login
  const handleLoginComplete = useCallback(() => {
    setShowLoginModal(false);
    recheckAuth();
    // Clear invalid token providers after successful login
    onClearInvalidTokenProviders?.();
  }, [recheckAuth, onClearInvalidTokenProviders]);

  // Handle migration complete - show success modal
  const handleMigrationComplete = useCallback(() => {
    setShowSuccessModal(true);
  }, []);

  // Determine if personal views are blocked
  // NOT blocked if user has twitter_username (can show network from matching_found even without Bluesky/Mastodon)
  const isPersonalViewBlocked = !isAuthValid && requiresReauth && !hasTwitterUsername;

  // Les nœuds viennent de Mosaic (DuckDB)
  const baseNodes = mosaicNodes;
  
  // Restore lasso selection from sessionStorage when nodes are loaded
  useEffect(() => {
    if (baseNodes.length > 0 && !isLassoSelectionLoaded) {
      const savedNodeIds = getLassoSelection();
      if (savedNodeIds && savedNodeIds.length > 0) {
        // Find the nodes by ID
        const nodeMap = new Map(baseNodes.map((n: GraphNode) => [n.id, n]));
        const restoredNodes: GraphNode[] = [];
        for (const id of savedNodeIds) {
          const node = nodeMap.get(id);
          if (node) restoredNodes.push(node);
        }
        if (restoredNodes.length > 0) {
          setLassoSelectedMembersState(restoredNodes);
        }
        // Delete from sessionStorage after restoring
        deleteLassoSelection();
      }
      setIsLassoSelectionLoaded(true);
    }
  }, [baseNodes.length, isLassoSelectionLoaded, getLassoSelection, deleteLassoSelection]);

  // Callback pour récupérer les nœuds depuis Mosaic
  const handleMosaicNodesReady = useCallback((nodes: GraphNode[]) => {
    setMosaicNodes(nodes);
    setLoadingMessageKey('initializing');
  }, []);

  // Callback quand le graphe est complètement rendu
  const handleGraphReady = useCallback(() => {
    setIsGraphRendered(true);
  }, []);

  // Callback to reset the graph view (forces remount of EmbeddingView)
  const handleResetView = useCallback(() => {
    // Clear viewport cookies so the view resets to default position
    if (typeof document !== 'undefined') {
      document.cookie = 'graph_viewport_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'graph_ui_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    setViewResetKey(prev => prev + 1);
  }, []);

  // usePersonalNetwork is now only used for lasso-related functionality
  // Personal data (matching + hashes) is loaded via GraphDataContext
  const {
    fetchLassoStats,
    // Lasso connections
    lassoStats,
    lassoCompleted,
    lassoLoading,
    // Connected nodes hashes for graph highlighting (lasso feature)
    connectedHashes,
  } = usePersonalNetwork(baseNodes);

  // Auto-fetch lasso stats once we have a session so the lasso panel isn't empty.
  // (Lasso is managed by usePersonalNetwork, not GraphDataContext.)
  useEffect(() => {
    if (!session?.user?.id) return;
    if (hasFetchedLassoStats.current) return;
    if (lassoLoading) return;
    if (lassoStats) return;
    // Only fetch when the lasso UI can be relevant (discover mode)
    if (viewMode !== 'discover') return;

    hasFetchedLassoStats.current = true;
    fetchLassoStats();
  }, [session?.user?.id, viewMode, lassoLoading, lassoStats, fetchLassoStats]);

  // State to track labels version for triggering lasso panel refresh
  const [labelsVersion, setLabelsVersion] = useState(0);

  // Listen for label changes and refresh lasso stats when labels are updated
  // This ensures the lasso panel shows updated data when another user changes their consent
  useEffect(() => {
    const handleLabelsUpdated = () => {
      console.log('🔄 [LassoPanel] Labels updated, incrementing version to trigger refresh...');
      
      // Increment version to trigger re-fetch in FloatingLassoSelectionPanel
      setLabelsVersion(v => v + 1);
      
      // Also refresh lasso stats if there's a selection
      if (lassoSelectedMembers.length > 0) {
        console.log('🔄 [LassoPanel] Lasso selection exists, refreshing stats...');
        fetchLassoStats();
      }
    };

    graphDataEvents.on('personalLabelsUpdated', handleLabelsUpdated);
    
    return () => {
      graphDataEvents.off('personalLabelsUpdated', handleLabelsUpdated);
    };
  }, [fetchLassoStats, lassoSelectedMembers.length]);
  
  
  // Wrapper for onStartMigration that updates graph highlights after completion
  // Note: We no longer refetch all hashes - the local state is already updated in useReconnectState
  // and the graph highlighting will be updated via the followingHashes Map
  const handleStartMigrationWithRefresh = useCallback((selectedAccounts: string[]) => {
    // Show progress panel when migration starts
    setShowProgressPanel(true);
    // Increment key to force re-mount of FloatingProgressPanel (resets internal state)
    setMigrationKey(k => k + 1);
    onStartMigration(
      selectedAccounts, 
      () => {
        // After migration, only refetch matching data (for panel updates)
        // Don't refetch hashes - they're updated locally and would be wasteful
        // The graph highlighting is handled by the followingHashes Map which is already updated
        // Only refetch matching data without hashes to update the panel
        graphData.fetchPersonalData({ includeHashes: false });
      },
      // Pass updateFollowingStatus callback to update IndexedDB cache after each batch
      graphData.updateFollowingStatus
    );
  }, [onStartMigration, graphData]);

  // UNIFIED: Load personal data (matching + hashes) via GraphDataContext
  // Step 1: Always fetch matching data immediately (for FloatingAccountsPanel)
  // Step 2: On desktop, fetch hashes when graph nodes are ready (for highlighting)
  
  // Step 1: Fetch matching data immediately (both mobile and desktop)
  // Use session.user.id as the trigger - don't wait for isAuthValid (which takes 8+ seconds)
  const hasSession = !!session?.user?.id;
  // User needs twitter_id OR has_onboarded to fetch personal data
  const canFetchPersonalData = hasSession && (hasOnboarded || !!session?.user?.twitter_id);
  
  useEffect(() => {
    // Skip if user can't fetch personal data (no twitter_id and not onboarded)
    // This prevents infinite 400 error loops for users in "discover only" mode
    if (!canFetchPersonalData) return;
    
    // Skip if matching already loaded or loading
    if (graphData.matchingData.length > 0 || graphData.isPersonalDataLoading) return;
    
    // Fetch matching data without hashes first (fast, for panel)
    // This ensures FloatingAccountsPanel gets data even if graph is slow to load
    graphData.fetchPersonalData({ includeHashes: false });
  }, [canFetchPersonalData, graphData.matchingData.length, graphData.isPersonalDataLoading, graphData.fetchPersonalData]);
  
  // Step 2: On desktop, fetch hashes when graph nodes are ready
  useEffect(() => {
    // Skip on mobile (no graph to highlight)
    if (isMobile) return;
    
    // Skip if user can't fetch personal data (no twitter_id and not onboarded)
    if (!canFetchPersonalData) return;
    
    // Skip if already loaded or loading
    if (graphData.hashesLoaded || graphData.isHashesLoading) return;
    
    // Wait for graph nodes to be loaded
    if (baseNodes.length === 0) return;
    
    // Fetch hashes for graph highlighting (fetchHashes checks each type independently)
    // It will only fetch what's not already cached
    graphData.fetchHashes();
  }, [baseNodes.length, canFetchPersonalData, graphData.hashesLoaded, graphData.isHashesLoading, graphData.fetchHashes, isMobile]);

  // Auto-switch to followings mode once hashes are loaded (if user has personal network)
  // Now uses GraphDataContext as the source of truth
  // This runs as soon as followingHashes is populated, without waiting for isPersonalDataLoaded
  useEffect(() => {
    // Skip if already switched
    if (hasAutoSwitchedToFollowings.current) return;
    
    // Check if there's a saved cookie preference FIRST
    const savedViewMode = typeof window !== 'undefined' 
      ? document.cookie.split('; ').find(row => row.startsWith('graph_view_mode='))?.split('=')[1]
      : null;
    
    // If user has a saved preference, respect it and mark as switched
    if (savedViewMode && ['discover', 'followings', 'followers'].includes(savedViewMode)) {
      hasAutoSwitchedToFollowings.current = true;
      return;
    }
    
    // No cookie - determine mode based on data availability
    // Switch to followings as soon as we have following hashes (don't wait for isPersonalDataLoaded)
    if (graphData.followingHashes.size > 0) {
      hasAutoSwitchedToFollowings.current = true;
      if (viewMode === 'discover') {
        setViewMode('followings');
      }
    }
  }, [graphData.followingHashes.size, viewMode, setViewMode]);

  // Switch to discover mode if personal network is empty after loading
  // This ensures users without personal network nodes see the discover view
  useEffect(() => {
    // Only check after personal data has been loaded and auto-switch has been attempted
    if (!graphData.isPersonalDataLoaded || !hasAutoSwitchedToFollowings.current) return;
    
    // If we're in followings mode but have no following hashes, switch to discover
    // if (viewMode === 'followings' && graphData.followingHashes.size === 0) {
    //   setViewMode('discover');
    // }
  }, [graphData.isPersonalDataLoaded, viewMode, graphData.followingHashes.size, setViewMode]);

  // Déterminer quelles données afficher selon le mode de vue
  // NOTE: All modes now use the same baseNodes (loaded from /api/mosaic/query)
  // Highlighting is done via hashes (followingHashes/followerHashes) in ReconnectGraphVisualization
  // No more merging of different node sets - just use baseNodes and let visualization handle highlighting
  const displayNodes = useMemo(() => {
    // All modes use the same base graph - highlighting is done via coordinate hashes
    return baseNodes;
  }, [baseNodes]);

  // Gérer le redimensionnement
  useEffect(() => {
    const updateSize = () => {
      const container = document.getElementById('reconnect-graph-container');
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    };

    // Initial measurement with multiple retries
    updateSize();
    const timeoutId1 = setTimeout(updateSize, 100);
    const timeoutId2 = setTimeout(updateSize, 500);
    const timeoutId3 = setTimeout(updateSize, 1000);
    
    window.addEventListener('resize', updateSize);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Recalculer quand les nœuds sont chargés
  useEffect(() => {
    if (baseNodes.length > 0 && containerSize.width === 0) {
      const container = document.getElementById('reconnect-graph-container');
      if (container) {
        setContainerSize({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    }
  }, [baseNodes.length, containerSize.width]);

  const handleNodeSelect = (node: GraphNode | null) => {
    setSelectedNode(node);
  };

  const handleChangeView = useCallback((mode: 'discover' | 'followings' | 'followers') => {
    // If trying to access personal views while blocked, show login modal
    if (isPersonalViewBlocked && (mode === 'followings' || mode === 'followers')) {
      setShowLoginModal(true);
      return;
    }
    
    // Reset highlight mode when changing views to avoid stale selections
    setHighlightMode(null);
    setViewMode(mode);
  }, [isPersonalViewBlocked, setViewMode]);

  const isGraphReady = baseNodes.length > 0;
  // hasPersonalNetwork is now based on hashes from context (RGPD-friendly)
  const hasPersonalNetwork = graphData.followingHashes.size > 0 || graphData.followerHashes.size > 0;
  
  // For personal views (followings/followers), wait for hashes to be loaded before showing graph
  // This prevents showing the graph without highlighting when there's no cache
  const isPersonalDataReadyForView = useMemo(() => {
    // In discover mode, no need to wait for hashes
    if (viewMode === 'discover') return true;
    
    // If user can't fetch personal data, don't block
    if (!canFetchPersonalData) return true;
    
    // In followings mode, wait for followingHashes to be loaded
    if (viewMode === 'followings') {
      // If hashes are loaded (from cache or API), we're ready
      // Note: hashesLoaded becomes true when at least one hash type is loaded
      return graphData.followingHashes.size > 0 || graphData.isPersonalDataLoaded;
    }
    
    // In followers mode, wait for followerHashes to be loaded
    if (viewMode === 'followers') {
      return graphData.followerHashes.size > 0 || graphData.isPersonalDataLoaded;
    }
    
    return true;
  }, [viewMode, canFetchPersonalData, graphData.followingHashes.size, graphData.followerHashes.size, graphData.isPersonalDataLoaded]);
  
  // Compute followerNodesFromHashes from baseNodes filtered by followerHashes (from context)
  // This allows FloatingFollowersCommunityPanel to display community breakdown
  const followerNodesFromHashes = useMemo(() => {
    if (graphData.followerHashes.size === 0 || baseNodes.length === 0) return [];
    
    // Helper to create coordinate hash (same format as used in visualization)
    const coordHash = (x: number, y: number): string => `${x.toFixed(6)}_${y.toFixed(6)}`;
    
    return baseNodes.filter((node: GraphNode) => {
      const hash = coordHash(node.x, node.y);
      return graphData.followerHashes.has(hash);
    });
  }, [baseNodes, graphData.followerHashes]);

  // Header height ~40px, Footer height varies by screen size
  // Mobile: ~40px (compact footer), Desktop: ~84px (full footer + EmbeddingAtlas status bar)
  const headerHeight = 40;
  const [footerHeight, setFooterHeight] = useState(84);
  
  // Adjust footer height based on screen size
  useEffect(() => {
    const updateFooterHeight = () => {
      const isMobile = window.innerWidth < 768;
      setFooterHeight(isMobile ? 40 : 84);
    };
    updateFooterHeight();
    window.addEventListener('resize', updateFooterHeight);
    return () => window.removeEventListener('resize', updateFooterHeight);
  }, []);

  return (
    <div 
      className="relative w-full overflow-hidden" 
      style={{ 
        backgroundColor: colors.background,
        height: '100vh',
        paddingTop: `${headerHeight}px`,
        paddingBottom: `${footerHeight}px`,
      }}
    >
      {/* Loading Overlay avec ParticulesBackground - DESKTOP ONLY (no graph on mobile) */}
      {/* Show loading when: graph not rendered OR personal data not ready for view */}
      {!isMobile && (!isGraphRendered || !isPersonalDataReadyForView) && (
        <div className="absolute inset-0 z-50" style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px` }}>
          <ParticulesBackground />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div 
                className="w-10 h-10 border-3 rounded-full animate-spin" 
                style={{ 
                  borderLeftColor: loaderContrastColor,
                  borderRightColor: loaderContrastColor,
                  borderBottomColor: loaderContrastColor,
                  borderTopColor: 'transparent'
                }}
              />
              <p 
                className="font-mono tracking-wider text-sm"
                style={{ color: loaderContrastColor }}
              >
                {/* Show different message when waiting for personal data vs graph */}
                {isGraphRendered && !isPersonalDataReadyForView 
                  ? t('loading.personalNetwork')
                  : t(`loading.${loadingMessageKey}`)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Background - ParticulesBackground */}
      {isMobile && (
        <div className="absolute inset-0" style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px` }}>
          <ParticulesBackground />
        </div>
      )}

      {/* Graph Container - Between Header and Footer - DESKTOP ONLY */}
      {!isMobile && (
      <div id="reconnect-graph-container" data-intro="graph-canvas" className="absolute left-0 right-0" style={{ top: `${headerHeight}px`, bottom: `${footerHeight}px` }}>
        {containerSize.width > 0 && containerSize.height > 0 && (
          <ReconnectGraphVisualization
            key={`graph-${viewResetKey}`}
            nodes={displayNodes}
            width={containerSize.width}
            height={containerSize.height}
            hasPersonalNetwork={hasPersonalNetwork}
            isPersonalOnlyView={viewMode === 'followings'}
            isMembersView={false}
            isFollowersView={viewMode === 'followers'}
            viewMode={viewMode}
            userNode={graphData.userNode}
            onNodeSelect={handleNodeSelect}
            onMosaicNodesReady={handleMosaicNodesReady}
            onGraphReady={handleGraphReady}
            communityColors={communityColorsHook.colors}
            userPointSize={communityColorsHook.pointSize}
            onLassoMembers={setLassoSelectedMembers}
            lassoSelectedMembers={lassoSelectedMembers}
            lassoConnectedIds={connectedHashes}
            lassoActiveTab={lassoActiveTab}
            highlightVersion={highlightVersion}
            highlightMode={highlightMode}
            followingHashes={graphData.followingHashes}
            followerHashes={graphData.followerHashes}
            effectiveFollowerHashes={graphData.effectiveFollowerHashes}
            hasOnboarded={hasOnboarded}
            highlightedSearchNode={highlightedSearchNode}
          />
        )}
      </div>
      )}

      {/* Floating Panels */}

      {/* Left Panel - Followers by Community - Hide during intro step 1 */}
      {showFollowers && !introHidePanels && (
        <FloatingFollowersCommunityPanel
          followerNodes={followerNodesFromHashes}
          communityColors={communityColorsHook.colors}
          totalFollowersFromStats={stats?.connections?.following ?? 0}
        />
      )}
     

      {/* Mobile Layout - Stacked column with AccountsPanel on top, then CommunityStats */}
      {isMobile && (
        <div 
          className="absolute left-2 right-2 z-50 flex flex-col gap-3 overflow-y-auto"
          style={{ top: `${headerHeight + 8}px`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 100}px)` }}
        >
          {/* Accounts Panel - or Discover Panel for users without personal data */}
          <div data-intro="accounts-panel">
            {canFetchPersonalData ? (
              <FloatingAccountsPanel
                matches={accountsToProcess}
                setMatches={setAccountsToProcess}
                session={session}
                onStartMigration={handleStartMigrationWithRefresh}
                onShowLoginModal={() => setShowLoginModal(true)}
                selectedNode={selectedNode}
                lassoMembers={lassoSelectedMembers}
                onClearLassoSelection={() => setLassoSelectedMembers([])}
                lassoCompleted={lassoCompleted}
                inline={true}
              />
            ) : (
              <FloatingDiscoverPanel />
            )}
          </div>
          {/* Community Stats */}
          <MobileFollowersCommunityStats 
            totalFollowersFromStats={stats?.connections?.following || 0}
          />
        </div>
      )}

      {/* Desktop: Right Panel - Accounts List - Show when Following mode OR during intro step 4 */}
      {!isMobile && (showFollowing || introShowAccountsPanel) && !introHidePanels && !introHideAccountsPanel && canFetchPersonalData && (
        <div data-intro="accounts-panel" style={introShowAccountsPanel ? { position: 'relative', zIndex: 101 } : undefined}>
          <FloatingAccountsPanel
            matches={accountsToProcess}
            setMatches={setAccountsToProcess}
            session={session}
            onStartMigration={handleStartMigrationWithRefresh}
            onShowLoginModal={() => setShowLoginModal(true)}
            selectedNode={selectedNode}
            lassoMembers={lassoSelectedMembers}
            onClearLassoSelection={() => setLassoSelectedMembers([])}
            lassoCompleted={lassoCompleted}
          />
        </div>
      )}

      {/* Desktop: Left Panel - Discover Panel for users without personal data */}
      {/* Hide when in Discover mode (LassoSelectionPanel takes precedence) */}
      {!isMobile && !canFetchPersonalData && viewMode !== 'discover' && !introHidePanels && (
        <FloatingDiscoverPanel />
      )}

      {/* Mobile Notice - Invite users to use desktop for optimal experience */}
      {isMobile && (
        <div className="absolute left-2 right-2 bottom-20 z-30">
          <div className="bg-gradient-to-r from-blue-900/95 to-indigo-900/95 backdrop-blur-sm rounded-lg border border-blue-500/30 shadow-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">
                  {t('mobileNotice.title')}
                </h3>
                <p className="text-xs text-blue-200/80 leading-relaxed">
                  {t('mobileNotice.message')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lasso Selection Panel - Show in Discover mode OR during intro step 3, hide during accounts intro */}
      {(viewMode === 'discover' || introShowLassoPanel) && !introHidePanels && !introHideLassoPanel && (
        <div data-intro="lasso-panel" style={introShowLassoPanel ? { position: 'relative', zIndex: 101 } : undefined}>
          <FloatingLassoSelectionPanel
            lassoMembers={lassoSelectedMembers}
            onClearSelection={() => setLassoSelectedMembers([])}
            communityColors={communityColorsHook.colors}
            session={session}
            onShowLoginModal={() => setShowLoginModal(true)}
            lassoStats={lassoStats}
            lassoCompleted={lassoCompleted}
            lassoLoading={lassoLoading}
            onRefreshLassoStats={fetchLassoStats}
            onTabChange={setLassoActiveTab}
            onMigrationStart={handleLassoMigrationStart}
            onMigrationProgress={handleLassoMigrationProgress}
            onMigrationComplete={handleLassoMigrationComplete}
            onShowLassoHelp={handleShowLassoHelp}
            onHighlightNode={setHighlightedSearchNode}
            viewMode={viewMode}
            labelsVersion={labelsVersion}
          />
        </div>
      )}

      {/* Right Panel - Stats - Hide during entire intro */}
      {!introHideStatsPanel && (
        <FloatingStatsPanel
          stats={stats}
          session={session}
          totalNodes={baseNodes.length}
          isLoadingPersonal={graphData.isPersonalDataLoading}
          isGraphReady={isGraphReady}
          hasPersonalNetwork={hasPersonalNetwork}
          accountsToProcess={accountsToProcess}
          mastodonInstances={mastodonInstances}
          showFollowing={showFollowing}
          showFollowers={showFollowers}
          onToggleFollowing={() => handleChangeView('followings')}
          onToggleFollowers={() => handleChangeView('followers')}
          onShowMyNetwork={handleShowMyNetwork}
          onShowMyNode={handleShowMyNode}
          onShowConnected={handleShowConnected}
          onShowEffectiveFollowers={handleShowEffectiveFollowers}
          onResetView={handleResetView}
          lassoConnectedCount={connectedHashes.size}
          globalStats={globalStats}
        />
      )}

      {/* Bottom Panel - Progress (automatic or manual migration, or lasso migration) */}
      {(isAutomaticReconnect || isMigrating || isLassoMigrating || showProgressPanel) && (
        <FloatingProgressPanel
          key={isLassoMigrating ? `lasso-${migrationKey}` : `main-${migrationKey}`}
          results={isLassoMigrating ? lassoMigrationResults : migrationResults}
          stats={stats}
          session={session}
          onPause={isAutomaticReconnect ? onToggleAutomaticReconnect : (onStopMigration || (() => {}))}
          onComplete={isLassoMigrating ? handleLassoMigrationComplete : handleMigrationComplete}
          onClose={() => {
            setShowProgressPanel(false);
            if (isLassoMigrating) {
              setIsLassoMigrating(false);
              setLassoSelectedBreakdown(null);
            }
          }}
          isManualMode={!isAutomaticReconnect && (isMigrating || isLassoMigrating)}
          selectedCount={isLassoMigrating ? lassoSelectedCount : selectedAccountsCount}
          selectedBreakdown={isLassoMigrating ? (lassoSelectedBreakdown ?? undefined) : (selectedBreakdown ?? undefined)}
        />
      )}

      {/* View Mode Toggle - Scientific Style - Below Header - DESKTOP ONLY */}
      {!isMobile && (
      <div 
        data-intro="view-modes"
        className="absolute left-1/2 -translate-x-1/2 z-40 flex items-center bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl"
        style={{ top: `${headerHeight + 16}px` }}
      >
        {/* Followings (default) */}
        <button
          onClick={() => handleChangeView('followings')}
          className={`relative px-4 py-2 text-[11px] font-medium tracking-wide transition-all flex items-center gap-1.5 ${
            viewMode === 'followings'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          } ${!isGraphReady || isPersonalViewBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
          disabled={!isGraphReady}
        >
          {viewMode === 'followings' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500" />
          )}
          {isPersonalViewBlocked && <Lock className="w-3 h-3" />}
          Followings
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-slate-700/50" />

        {/* Followers */}
        <button
          onClick={() => handleChangeView('followers')}
          className={`relative px-4 py-2 text-[11px] font-medium tracking-wide transition-all flex items-center gap-1.5 ${
            viewMode === 'followers'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          } ${!isGraphReady || isPersonalViewBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
          disabled={!isGraphReady}
        >
          {viewMode === 'followers' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-500" />
          )}
          {isPersonalViewBlocked && <Lock className="w-3 h-3" />}
          Followers
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-slate-700/50" />

        {/* Discover View */}
        <button
          onClick={() => handleChangeView('discover')}
          className={`relative px-4 py-2 text-[11px] font-medium tracking-wide transition-all ${
            viewMode === 'discover'
              ? 'text-white bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          {viewMode === 'discover' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500" />
          )}
          Discover
        </button>
      </div>
      )}

      {/* Corner Accents */}
      {/* <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-[#007bff] pointer-events-none" 
           style={{ boxShadow: '0 0 10px #007bff' }} />
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-[#007bff] pointer-events-none"
           style={{ boxShadow: '0 0 10px #007bff' }} />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-[#ff007f] pointer-events-none"
           style={{ boxShadow: '0 0 10px #ff007f' }} />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-[#ff007f] pointer-events-none"
           style={{ boxShadow: '0 0 10px #ff007f' }} /> */}

      {/* Community Color Picker - bottom left, above Footer */}
      {!isMobile && (
        <div className="absolute left-4 z-40" style={{ bottom: `${footerHeight + 16}px` }}>
          <CommunityColorPicker
            communityLabels={{
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
            }}
            colorHook={communityColorsHook}
          />
        </div>
      )}

      {/* Status Bar - above Footer */}
      {/* <div 
        className="absolute right-6 flex items-center gap-3 px-4 py-2 rounded-lg border border-[#e5e7eb] backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', bottom: `${footerHeight + 16}px` }}
      >
        <div className={`w-2 h-2 rounded-full ${viewMode === 'global' ? 'bg-[#3b82f6]' : 'bg-[#10b981]'}`} 
             style={{ boxShadow: viewMode === 'global' ? '0 0 8px rgba(59, 130, 246, 0.7)' : '0 0 8px rgba(16, 185, 129, 0.7)' }} />
      
      </div> */}

      {/* Login Modal - shown when auth is invalid */}
      <ReconnectLoginModal
        isOpen={showLoginModal}
        onClose={handleLoginModalClose}
        invalidProviders={[...new Set([...invalidProviders, ...invalidTokenProviders])]}
        noAccountsConfigured={noAccountsConfigured}
        mastodonInstances={mastodonInstances}
        connectedServices={{
          twitter: !!session?.user?.twitter_username,
          bluesky: !!session?.user?.bluesky_username,
          mastodon: !!session?.user?.mastodon_username,
        }}
        onLoginComplete={handleLoginComplete}
        userId={session?.user?.id}
      />

      {/* Migration Success Modal - shown when migration completes */}
      <MigrationSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        blueskySucceeded={migrationResults?.bluesky?.succeeded || 0}
        blueskyTotal={stats?.matches?.bluesky?.notFollowed || 0}
        blueskyFailed={migrationResults?.bluesky?.failed || 0}
        mastodonSucceeded={migrationResults?.mastodon?.succeeded || 0}
        mastodonTotal={stats?.matches?.mastodon?.notFollowed || 0}
        mastodonFailed={migrationResults?.mastodon?.failed || 0}
        failures={[
          ...(migrationResults?.bluesky?.failures || []).map(f => ({ 
            platform: 'bluesky' as const, 
            handle: f.handle, 
            error: f.error 
          })),
          ...(migrationResults?.mastodon?.failures || []).map(f => ({ 
            platform: 'mastodon' as const, 
            handle: f.handle, 
            error: f.error 
          })),
        ]}
        session={session}
      />

      {/* Lasso Migration Success Modal - shown when lasso follow completes */}
      <MigrationSuccessModal
        isOpen={showLassoSuccessModal}
        onClose={() => {
          setShowLassoSuccessModal(false);
          // Reset lasso migration state
          setLassoMigrationResults(null);
          setLassoSelectedBreakdown(null);
          setLassoSelectedCount(0);
        }}
        blueskySucceeded={lassoMigrationResults?.bluesky?.succeeded || 0}
        blueskyTotal={lassoSelectedBreakdown?.bluesky || 0}
        blueskyFailed={lassoMigrationResults?.bluesky?.failed || 0}
        mastodonSucceeded={lassoMigrationResults?.mastodon?.succeeded || 0}
        mastodonTotal={lassoSelectedBreakdown?.mastodon || 0}
        mastodonFailed={lassoMigrationResults?.mastodon?.failed || 0}
        failures={[
          ...(lassoMigrationResults?.bluesky?.failures || []).map(f => ({ 
            platform: 'bluesky' as const, 
            handle: f.handle, 
            error: f.error 
          })),
          ...(lassoMigrationResults?.mastodon?.failures || []).map(f => ({ 
            platform: 'mastodon' as const, 
            handle: f.handle, 
            error: f.error 
          })),
        ]}
        session={session}
        isLassoMode={true}
      />

      {/* V2 Intro Overlay - shown once for new users or on-demand for lasso help */}
      {showIntroOverlay && (
        <IntroOverlay
          onDismiss={() => {
            setShowIntroOverlay(false);
            setIntroStep(0);
            setIntroInitialStep(0); // Reset initial step for next time
            setIntroHintMode(false); // Reset hint mode
            // Only set cookie if this was the initial intro (not lasso help)
            if (!introHintMode) {
              setIntroSeenCookie();
              // Also persist to database (fire and forget)
              fetch('/api/user/seen-v2', { method: 'POST' }).catch(() => {});
            }
          }}
          onStepChange={setIntroStep}
          initialStep={introInitialStep}
          hintMode={introHintMode}
        />
      )}

      {/* Consent Label Modal - shown after intro for authenticated users */}
      {showConsentModal && (
        <ConsentLabelModal
          onDismiss={handleConsentDismiss}
          onConsentSaved={handleConsentSaved}
        />
      )}
    </div>
  );
}

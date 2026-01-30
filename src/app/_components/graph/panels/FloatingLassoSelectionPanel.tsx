'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { GraphNode } from '@/lib/types/graph';
import { LassoConnection, LassoStats } from '@/hooks/usePersonalNetwork';
import { 
  Lasso,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  ExternalLink,
  Check,
  Zap,
  CheckCircle,
  Clock,
  Search,
  MapPin,
} from 'lucide-react';

// Helper to create a hash from coordinates (same as useFollowersCoordinates)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

// Community labels mapping
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

// Helper to build Mastodon profile URL from handle
function getMastodonProfileUrl(handle: string): string | null {
  // Handle format: @username@instance.social or username@instance.social
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  const parts = cleanHandle.split('@');
  if (parts.length === 2) {
    const [username, instance] = parts;
    return `https://${instance}/@${username}`;
  }
  return null;
}

// Type for enriched node data from API
interface EnrichedNode {
  twitter_id: string;
  hash: string;
  label: string | null;
  x: number;
  y: number;
  community: number | null;
  tier: string | null;
  graph_label: string | null;
  node_type: string | null;
  bluesky_handle: string | null;
  mastodon_handle: string | null;
  mastodon_username: string | null;
  mastodon_instance: string | null;
  has_follow_bluesky: boolean;
  has_follow_mastodon: boolean;
}

type TabType = 'search' | 'found' | 'connected';

// Search result type
interface SearchResult {
  twitter_id: string;
  display_label: string;
  description: string | null;
  hash: string;
  x: number;
  y: number;
  community: number | null;
  bluesky_handle: string | null;
  mastodon_handle: string | null;
}

// Migration result type for progress panel
interface MigrationResult {
  bluesky: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null;
  mastodon: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null;
}

interface FloatingLassoSelectionPanelProps {
  lassoMembers: GraphNode[];
  onClearSelection: () => void;
  communityColors: string[];
  session?: {
    user?: {
      id?: string;
      bluesky_username?: string | null;
      mastodon_username?: string | null;
    };
  } | null;
  onShowLoginModal?: () => void;
  // Lasso connections from usePersonalNetwork
  lassoStats?: LassoStats | null;
  lassoCompleted?: LassoConnection[];
  lassoLoading?: boolean;
  onRefreshLassoStats?: () => void;
  onTabChange?: (tab: 'found' | 'connected') => void;
  // Callbacks for progress panel integration
  onMigrationStart?: (breakdown: { bluesky: number; mastodon: number }, selectedCount: number) => void;
  onMigrationProgress?: (results: MigrationResult) => void;
  onMigrationComplete?: () => void;
  // Callback to show lasso help overlay (step 2 of intro)
  onShowLassoHelp?: () => void;
  // Callback to highlight a node on the graph (for search)
  onHighlightNode?: (node: { x: number; y: number; label: string; description: string | null; community: number | null }) => void;
  // View mode to show/hide search tab
  viewMode?: 'discover' | 'followings' | 'followers';
  // Labels version to trigger re-fetch when labels change (cross-client sync)
  labelsVersion?: number;
}

export function FloatingLassoSelectionPanel({
  lassoMembers,
  onClearSelection,
  communityColors,
  session,
  onShowLoginModal,
  lassoStats,
  lassoCompleted = [],
  lassoLoading = false,
  onRefreshLassoStats,
  onTabChange,
  onMigrationStart,
  onMigrationProgress,
  onMigrationComplete,
  onShowLassoHelp,
  onHighlightNode,
  viewMode = 'discover',
  labelsVersion = 0,
}: FloatingLassoSelectionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [enrichedNodes, setEnrichedNodes] = useState<EnrichedNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const itemsPerPage = 50;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);

  // Check if user has connected accounts
  const hasBluesky = !!session?.user?.bluesky_username;
  const hasMastodon = !!session?.user?.mastodon_username;
  const isLoggedIn = !!session?.user?.id;

  // Set initial expanded state based on screen size
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setIsExpanded(!isMobile);
  }, []);

  // Reset page and selection when members change
  useEffect(() => {
    setCurrentPage(0);
    setSelectedAccounts(new Set());
  }, [lassoMembers]);

  // Auto-switch tabs based on data availability
  // - In discover mode with no lasso selection: show search tab
  // - Show Found tab if lasso has members
  // - Show Connected tab if found=0 and connected>0
  useEffect(() => {
    const foundCount = enrichedNodes.length;
    const connectedCount = lassoCompleted?.length || 0;
    const hasLassoSelection = lassoMembers.length > 0;
    
    if (isLoading) return;
    
    // If in discover mode with no lasso selection, show search tab
    if (viewMode === 'discover' && !hasLassoSelection) {
      setActiveTab('search');
      return;
    }
    
    if (foundCount > 0) {
      setActiveTab('found');
      onTabChange?.('found');
    } else if (connectedCount > 0) {
      setActiveTab('connected');
      onTabChange?.('connected');
    }
  }, [enrichedNodes.length, lassoCompleted?.length, isLoading, onTabChange, viewMode, lassoMembers.length]);

  // Search function with debounce
  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/graph/search?q=${encodeURIComponent(query.trim())}&multiple=true&limit=8`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
        if (response.status === 404) {
          setSearchError('No users found');
        } else {
          setSearchError(data.error || 'Search failed');
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Handle selecting a search result
  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    setSelectedSearchResult(result);
    onHighlightNode?.({
      x: result.x,
      y: result.y,
      label: result.display_label,
      description: result.description,
      community: result.community,
    });
  }, [onHighlightNode]);

  // Fetch enriched node data from API when members change
  useEffect(() => {
    if (lassoMembers.length === 0) {
      setEnrichedNodes([]);
      return;
    }

    const fetchEnrichedNodes = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const hashes = lassoMembers.map(m => coordHash(m.x, m.y));

        const response = await fetch('/api/migrate/lasso_found', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashes }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.nodes) {
          setEnrichedNodes(data.nodes);
          if (hashes.length !== data.nodes.length) {
            console.warn(`⚠️ [LassoPanel] MISMATCH: ${hashes.length - data.nodes.length} nodes lost between frontend and API`);
          }
        } else {
          setEnrichedNodes([]);
        }
      } catch (err) {
        console.error('Failed to fetch enriched nodes:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setEnrichedNodes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnrichedNodes();
  }, [lassoMembers, labelsVersion]);

  // Paginate
  const paginatedNodes = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return enrichedNodes.slice(start, start + itemsPerPage);
  }, [enrichedNodes, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(enrichedNodes.length / itemsPerPage);
  const memberCount = enrichedNodes.length;

  // Toggle account selection
  const toggleAccount = useCallback((twitterId: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(twitterId)) {
        next.delete(twitterId);
      } else {
        next.add(twitterId);
      }
      return next;
    });
  }, []);

  // Select all accounts
  const selectAll = useCallback(() => {
    setSelectedAccounts(new Set(enrichedNodes.map(n => n.twitter_id)));
  }, [enrichedNodes]);

  // Deselect all accounts
  const deselectAll = useCallback(() => {
    setSelectedAccounts(new Set());
  }, []);

  // Handle follow action
  const handleFollow = useCallback(async (followAll: boolean) => {
    if (!isLoggedIn) {
      onShowLoginModal?.();
      return;
    }

    if (!hasBluesky && !hasMastodon) {
      onShowLoginModal?.();
      return;
    }

    const accountsToFollow = followAll 
      ? enrichedNodes 
      : enrichedNodes.filter((n: EnrichedNode) => selectedAccounts.has(n.twitter_id));

    if (accountsToFollow.length === 0) {
      setError('No accounts selected');
      return;
    }

    setIsFollowing(true);
    setError(null);

    // Calculate breakdown for progress panel
    // Count accounts that have handles for each platform AND are not already followed
    let blueskyCount = 0;
    let mastodonCount = 0;
    accountsToFollow.forEach((acc: EnrichedNode) => {
      const hasBlueskyHandle = !!acc.bluesky_handle;
      const hasMastodonHandle = !!(acc.mastodon_handle || acc.mastodon_username);
      
      // Only count if user has the platform connected AND account has handle AND not already followed
      if (hasBluesky && hasBlueskyHandle && !acc.has_follow_bluesky) blueskyCount++;
      if (hasMastodon && hasMastodonHandle && !acc.has_follow_mastodon) mastodonCount++;
    });
    
    // Notify parent that migration is starting
    onMigrationStart?.({ bluesky: blueskyCount, mastodon: mastodonCount }, accountsToFollow.length);

    try {
      // Send hashes instead of twitter_ids (RGPD-friendly)
      const hashesToFollow = accountsToFollow.map((acc: EnrichedNode) => acc.hash);
      
      const response = await fetch('/api/migrate/send_follow_lasso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashes: hashesToFollow,
        }),
      });

      const result = await response.json();

      // Check if reauth is required
      if (result.requiresReauth) {
        console.log('🔐 [LassoPanel] Reauth required for providers:', result.providers);
        onShowLoginModal?.();
        onMigrationComplete?.();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || `API error: ${response.status}`);
      }
      
      // Format results for progress panel
      const migrationResults: MigrationResult = {
        bluesky: result.bluesky ? {
          succeeded: result.bluesky.succeeded || 0,
          failed: result.bluesky.failed || 0,
          failures: result.bluesky.failures || []
        } : null,
        mastodon: result.mastodon ? {
          succeeded: result.mastodon.succeeded || 0,
          failed: result.mastodon.failed || 0,
          failures: result.mastodon.failures || []
        } : null
      };
      
      // Notify parent of progress
      onMigrationProgress?.(migrationResults);
      
      const totalSucceeded = (result.bluesky?.succeeded || 0) + (result.mastodon?.succeeded || 0);
      const totalFailed = (result.bluesky?.failed || 0) + (result.mastodon?.failed || 0);
            
      // Clear selection and refresh lasso stats after successful follow
      if (totalSucceeded > 0) {
        setSelectedAccounts(new Set());
        // Clear the lasso selection (this also clears the cookie)
        onClearSelection();
        // Refresh lasso stats to show new connections
        onRefreshLassoStats?.();
      }

    } catch (err) {
      console.error('Failed to follow accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to follow accounts');
      onMigrationComplete?.();
    } finally {
      setIsFollowing(false);
    }
  }, [isLoggedIn, hasBluesky, hasMastodon, enrichedNodes, selectedAccounts, onShowLoginModal, onRefreshLassoStats, onClearSelection, onMigrationStart, onMigrationProgress, onMigrationComplete]);

  const hasSelection = lassoMembers && lassoMembers.length > 0;

  return (
    <div 
      className="absolute top-28 md:top-16 left-2 md:left-6 w-[45%] md:w-80 bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl overflow-hidden transition-all duration-300 z-30"
      style={{ maxHeight: isExpanded ? '75vh' : '44px' }}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 border-b border-slate-700/50 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Lasso className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
            Lasso
          </span>
          {isLoading ? (
            <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
          ) : (
            <span className="text-[11px] text-slate-400 tabular-nums">
              {memberCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedAccounts.size > 0 && (
            <span className="text-[10px] text-emerald-400 tabular-nums">
              {selectedAccounts.size} selected
            </span>
          )}
          {hasSelection && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearSelection();
              }}
              className="p-1 hover:bg-slate-800 rounded transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Tab Navigation */}
          <div className="px-3 py-2 border-b border-slate-700/50 flex gap-1">
            {/* Search tab - only in discover mode */}
            {viewMode === 'discover' && (
              <button
                onClick={() => { setActiveTab('search'); setCurrentPage(0); }}
                className={`flex-1 px-2 py-1.5 text-[10px] font-medium tracking-wide transition-all rounded relative ${
                  activeTab === 'search' 
                    ? 'text-white bg-slate-800' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <Search className="w-3 h-3 inline mr-1" />
                Search
                {activeTab === 'search' && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-amber-500" />
                )}
              </button>
            )}
            <button
              onClick={() => { setActiveTab('found'); setCurrentPage(0); onTabChange?.('found'); }}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium tracking-wide transition-all rounded relative ${
                activeTab === 'found' 
                  ? 'text-white bg-slate-800' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <Clock className="w-3 h-3 inline mr-1" />
              Found
              <span className={`ml-1 tabular-nums ${activeTab === 'found' ? 'text-slate-400' : 'text-slate-600'}`}>
                {memberCount}
              </span>
              {activeTab === 'found' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-500" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab('connected'); setCurrentPage(0); onTabChange?.('connected'); }}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium tracking-wide transition-all rounded relative ${
                activeTab === 'connected' 
                  ? 'text-white bg-slate-800' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Connected
              <span className={`ml-1 tabular-nums ${activeTab === 'connected' ? 'text-emerald-400' : 'text-slate-600'}`}>
                {lassoStats?.completed || 0}
              </span>
              {activeTab === 'connected' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-emerald-500" />
              )}
            </button>
          </div>

          {/* SEARCH TAB CONTENT */}
          {activeTab === 'search' && viewMode === 'discover' && (
            <div className="px-3 py-3">
              {/* Search input */}
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                />
                {isSearching && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
                )}
              </div>

              {/* Search error */}
              {searchError && (
                <div className="text-[10px] text-red-400 mb-2">{searchError}</div>
              )}

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-[35vh] overflow-y-auto">
                  {searchResults.map((result) => {
                    const community = (result.community ?? 0) % 10;
                    const color = communityColors[community] || '#888888';
                    const isSelected = selectedSearchResult?.twitter_id === result.twitter_id;
                    
                    return (
                      <button
                        key={result.twitter_id}
                        onClick={() => handleSelectSearchResult(result)}
                        className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                          isSelected 
                            ? 'bg-amber-900/30 border border-amber-500/50' 
                            : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-white font-medium truncate">
                              {result.display_label}
                            </div>
                            {/* Bluesky handle */}
                            {result.bluesky_handle && (
                              <div className="text-[10px] text-blue-400 truncate">
                                @{result.bluesky_handle}
                              </div>
                            )}
                            {/* Mastodon handle */}
                            {result.mastodon_handle && (
                              <div className="text-[10px] text-purple-400 truncate">
                                {result.mastodon_handle}
                              </div>
                            )}
                            {result.description && (
                              <div className="text-[9px] text-slate-400 truncate mt-0.5">
                                {result.description}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {searchQuery.length < 2 && searchResults.length === 0 && !searchError && (
                <div className="text-center py-4">
                  <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-[10px] text-slate-500">
                    Type at least 2 characters to search
                  </p>
                </div>
              )}

              {/* Selected result info */}
              {selectedSearchResult && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-[10px] text-amber-400">
                    <MapPin className="w-3 h-3" />
                    <span>Highlighted on graph</span>
                  </div>
                  <div className="mt-1 text-[9px] text-slate-500">
                    Community: {COMMUNITY_LABELS[selectedSearchResult.community ?? 0] || `Community ${selectedSearchResult.community}`}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FOUND TAB CONTENT */}
          {activeTab === 'found' && (
            <>
              {/* Empty state - no lasso selection - clickable to show lasso help */}
              {!hasSelection && (
            <button
              onClick={() => onShowLassoHelp?.()}
              className="w-full px-4 py-6 text-center hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <Lasso className="w-8 h-8 text-slate-600 mx-auto mb-3 group-hover:text-amber-400" />
              <p className="text-[11px] text-slate-400 mb-1">
                Use the lasso tool to select accounts
              </p>
              <p className="text-[9px] text-slate-500">
                Draw a selection around nodes on the graph to discover and follow accounts
              </p>
              <p className="text-[9px] text-amber-400/70 mt-2">
                Click here to see how
              </p>
            </button>
          )}

          {/* Action Buttons - only show when there's a selection */}
          {hasSelection && (
            <div className="px-3 py-2 border-b border-slate-700/50 flex gap-2">
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  onShowLoginModal?.();
                  return;
                }
                handleFollow(false);
              }}
              disabled={selectedAccounts.size === 0 || isFollowing || isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-medium text-white transition-all"
            >
              {isFollowing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              Follow ({selectedAccounts.size})
            </button>
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  onShowLoginModal?.();
                  return;
                }
                handleFollow(true);
              }}
              disabled={memberCount === 0 || isFollowing || isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-gradient-to-l from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-medium text-white transition-all"
            >
              {isFollowing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Users className="w-3 h-3" />
              )}
              All ({memberCount})
            </button>
            </div>
          )}

          {/* Select All / Deselect All - only show when there's a selection */}
          {hasSelection && memberCount > 0 && (
            <div className="px-3 py-1.5 border-b border-slate-700/50 flex justify-between items-center">
              <button
                onClick={selectAll}
                className="text-[9px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Select all
              </button>
              <button
                onClick={deselectAll}
                className="text-[9px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Deselect all
              </button>
            </div>
          )}

          {/* Loading indicator - only show when there's a selection */}
          {hasSelection && isLoading && (
            <div className="px-3 py-4 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              <span className="text-[10px] text-slate-400">Loading accounts...</span>
            </div>
          )}

          {/* Error message */}
          {hasSelection && error && (
            <div className="px-3 py-2 bg-red-900/20 border-b border-red-500/30">
              <span className="text-[10px] text-red-400">{error}</span>
            </div>
          )}

          {/* Members List - only show when there's a selection */}
          {hasSelection && (
          <div className="max-h-[40vh] overflow-y-auto">
            {!isLoading && paginatedNodes.length === 0 && (
              <div className="px-3 py-4 text-center">
                <span className="text-[10px] text-slate-500">
                  No member accounts found in selection
                </span>
              </div>
            )}
            {paginatedNodes.map((node, index) => {
              const community = (node.community ?? 0) % 10;
              const color = communityColors[community] || '#888888';
              const isSelected = selectedAccounts.has(node.twitter_id);
              
              return (
                <div
                  key={`${node.twitter_id}-${index}`}
                  onClick={() => toggleAccount(node.twitter_id)}
                  className={`px-3 py-2 border-b border-slate-800/50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-emerald-900/20' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>

                    {/* Community color dot */}
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: color }}
                    />
                    
                    {/* Account handles and community */}
                    <div className="flex-1 min-w-0">
                      {node.bluesky_handle && (
                        <a
                          href={`https://bsky.app/profile/${node.bluesky_handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate">@{node.bluesky_handle}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      )}
                      {node.mastodon_handle && (
                        (() => {
                          const mastodonUrl = getMastodonProfileUrl(node.mastodon_handle);
                          return mastodonUrl ? (
                            <a
                              href={mastodonUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[12px] text-purple-400 hover:text-purple-300 transition-colors font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">{node.mastodon_handle}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="text-[12px] text-purple-400 truncate block font-medium">
                              {node.mastodon_handle}
                            </span>
                          );
                        })()
                      )}
                      {/* Community label */}
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                        {COMMUNITY_LABELS[community] || `Community ${community}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Pagination - only show when there's a selection */}
          {hasSelection && totalPages > 1 && (
            <div className="px-3 py-2 border-t border-slate-700/50 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}

          {/* Footer for Pending tab */}
          {activeTab === 'found' && (
            <div className="px-3 py-2 border-t border-slate-700/50 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-slate-500" />
                  <span className="text-[9px] text-slate-500">
                    {memberCount} accounts
                  </span>
                </div>
                {!isLoggedIn && (
                  <span className="text-[9px] text-amber-400">
                    Login to follow
                  </span>
                )}
              </div>
            </div>
          )}
            </>
          )}

          {/* CONNECTED TAB CONTENT */}
          {activeTab === 'connected' && (
            <>
              {/* Loading state */}
              {lassoLoading && (
                <div className="px-3 py-4 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  <span className="text-[10px] text-slate-400">Loading connections...</span>
                </div>
              )}

              {/* Empty state */}
              {!lassoLoading && lassoCompleted.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <CheckCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-[11px] text-slate-400 mb-1">
                    No connections yet
                  </p>
                  <p className="text-[9px] text-slate-500">
                    Use the lasso tool to select and follow accounts
                  </p>
                </div>
              )}

              {/* Connected accounts list */}
              {!lassoLoading && lassoCompleted.length > 0 && (
                <div className="max-h-[40vh] overflow-y-auto">
                  {lassoCompleted.map((connection, index) => (
                    <div
                      key={`${connection.id}-${index}`}
                      className="px-3 py-2 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {/* Account handles */}
                        <div className="flex-1 min-w-0">
                          {connection.bluesky_handle && (
                            <a
                              href={`https://bsky.app/profile/${connection.bluesky_handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">@{connection.bluesky_handle}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          )}
                          {connection.mastodon_handle && (
                            (() => {
                              const mastodonUrl = getMastodonProfileUrl(connection.mastodon_handle);
                              return mastodonUrl ? (
                                <a
                                  href={mastodonUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[12px] text-purple-400 hover:text-purple-300 transition-colors font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="truncate">{connection.mastodon_handle}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ) : (
                                <span className="text-[12px] text-purple-400 truncate block font-medium">
                                  {connection.mastodon_handle}
                                </span>
                              );
                            })()
                          )}
                          {!connection.bluesky_handle && !connection.mastodon_handle && (
                            <span className="text-[12px] text-slate-500 font-medium">
                              ID: {connection.target_twitter_id}
                            </span>
                          )}
                        </div>
                        
                        {/* Platform badge */}
                        <span className={`text-[8px] px-1 py-0.5 rounded flex-shrink-0 ${
                          connection.platform === 'bluesky' ? 'bg-blue-900/50 text-blue-400' :
                          'bg-purple-900/50 text-purple-400'
                        }`}>
                          {connection.platform}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer for Connected tab */}
              <div className="px-3 py-2 border-t border-slate-700/50 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] text-slate-500">
                      {lassoStats?.completed || 0} connected
                    </span>
                  </div>
                  {lassoStats && lassoStats.failed > 0 && (
                    <span className="text-[9px] text-red-400">
                      {lassoStats.failed} failed
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

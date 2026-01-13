'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { GraphNode } from '@/lib/types/graph';
import { 
  Lasso,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  MapPin,
  LogIn,
  ExternalLink,
} from 'lucide-react';

// Helper to get Mastodon profile URL
function getMastodonProfileUrl(handle: string): string | null {
  if (!handle) return null;
  // Handle format: @user@instance.social or user@instance.social
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  const parts = cleanHandle.split('@');
  if (parts.length === 2) {
    const [username, instance] = parts;
    return `https://${instance}/@${username}`;
  }
  return null;
}

// Helper to create a hash from coordinates
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

// Search result type
interface SearchResult {
  twitter_id: string;
  display_label: string;
  description: string | null;
  hash: string;
  x: number;
  y: number;
  community: number | null;
}

// Enriched node from lasso selection (public info only)
interface EnrichedNodeLight {
  twitter_id: string;
  hash: string;
  label: string | null;
  x: number;
  y: number;
  community: number | null;
  tier: string | null;
  graph_label: string | null;
  bluesky_handle: string | null;
  mastodon_handle: string | null;
}

type TabType = 'search' | 'found';

interface FloatingLassoSelectionPanelLightProps {
  lassoMembers: GraphNode[];
  onClearSelection: () => void;
  communityColors: string[];
  onLoginClick?: () => void;
  onHighlightNode?: (node: { x: number; y: number; label: string; description: string | null; community: number | null }) => void;
}

export function FloatingLassoSelectionPanelLight({
  lassoMembers,
  onClearSelection,
  communityColors,
  onLoginClick,
  onHighlightNode,
}: FloatingLassoSelectionPanelLightProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [enrichedNodes, setEnrichedNodes] = useState<EnrichedNodeLight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const itemsPerPage = 50;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);

  // Set initial expanded state based on screen size
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setIsExpanded(!isMobile);
  }, []);

  // Reset page when members change
  useEffect(() => {
    setCurrentPage(0);
  }, [lassoMembers]);

  // Auto-switch tabs based on data availability
  useEffect(() => {
    const hasLassoSelection = lassoMembers.length > 0;
    
    if (isLoading) return;
    
    // If no lasso selection, show search tab
    if (!hasLassoSelection) {
      setActiveTab('search');
      return;
    }
    
    // If we have lasso selection, show found tab
    if (enrichedNodes.length > 0) {
      setActiveTab('found');
    }
  }, [enrichedNodes.length, isLoading, lassoMembers.length]);

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

  // Fetch enriched node data from lasso_found API when members change
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

        // Use lasso_found API - works without auth and returns enriched nodes with handles
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
        } else {
          // Fallback: use basic node info from lassoMembers
          const basicNodes: EnrichedNodeLight[] = lassoMembers.map(m => ({
            twitter_id: m.id,
            hash: coordHash(m.x, m.y),
            label: m.label || null,
            x: m.x,
            y: m.y,
            community: m.community ?? null,
            tier: m.tier || null,
            graph_label: m.label || null,
            bluesky_handle: null,
            mastodon_handle: null,
          }));
          setEnrichedNodes(basicNodes);
        }
      } catch (err) {
        console.error('Failed to fetch enriched nodes:', err);
        // Fallback to basic node info
        const basicNodes: EnrichedNodeLight[] = lassoMembers.map(m => ({
          twitter_id: m.id,
          hash: coordHash(m.x, m.y),
          label: m.label || null,
          x: m.x,
          y: m.y,
          community: m.community ?? null,
          tier: m.tier || null,
          graph_label: m.label || null,
          bluesky_handle: null,
          mastodon_handle: null,
        }));
        setEnrichedNodes(basicNodes);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnrichedNodes();
  }, [lassoMembers]);

  // Paginate
  const paginatedNodes = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return enrichedNodes.slice(start, start + itemsPerPage);
  }, [enrichedNodes, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(enrichedNodes.length / itemsPerPage);
  const memberCount = enrichedNodes.length;

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
            <button
              onClick={() => { setActiveTab('found'); setCurrentPage(0); }}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium tracking-wide transition-all rounded relative ${
                activeTab === 'found' 
                  ? 'text-white bg-slate-800' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <Lasso className="w-3 h-3 inline mr-1" />
              Found
              <span className={`ml-1 tabular-nums ${activeTab === 'found' ? 'text-slate-400' : 'text-slate-600'}`}>
                {memberCount}
              </span>
              {activeTab === 'found' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-500" />
              )}
            </button>
          </div>

          {/* SEARCH TAB CONTENT */}
          {activeTab === 'search' && (
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
              {/* Empty state - no lasso selection */}
              {!hasSelection && (
                <div className="px-4 py-6 text-center">
                  <Lasso className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-[11px] text-slate-400 mb-1">
                    Use the lasso tool to select accounts
                  </p>
                  <p className="text-[9px] text-slate-500">
                    Draw a selection around nodes on the graph to discover accounts
                  </p>
                </div>
              )}

              {/* Loading indicator */}
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

              {/* Members List */}
              {hasSelection && (
                <div className="max-h-[40vh] overflow-y-auto">
                  {!isLoading && paginatedNodes.length === 0 && (
                    <div className="px-3 py-4 text-center">
                      <span className="text-[10px] text-slate-500">
                        No accounts found in selection
                      </span>
                    </div>
                  )}
                  {paginatedNodes.map((node, index) => {
                    const community = (node.community ?? 0) % 10;
                    const color = communityColors[community] || '#888888';
                    
                    return (
                      <div
                        key={`${node.twitter_id}-${index}`}
                        className="px-3 py-2 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
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
                            {/* Fallback to graph label if no handles */}
                            {!node.bluesky_handle && !node.mastodon_handle && (
                              <div className="text-[12px] text-white font-medium truncate">
                                {node.graph_label || node.label || `Node ${node.twitter_id.slice(0, 8)}...`}
                              </div>
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

              {/* Pagination */}
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

              {/* Login CTA */}
              {hasSelection && memberCount > 0 && onLoginClick && (
                <div className="px-3 py-3 border-t border-slate-700/50 bg-gradient-to-r from-blue-900/30 to-purple-900/30">
                  <button
                    onClick={onLoginClick}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-[11px] font-medium text-white transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Login to follow these accounts
                  </button>
                  <p className="text-[9px] text-slate-400 text-center mt-2">
                    Create an account to reconnect with your network
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

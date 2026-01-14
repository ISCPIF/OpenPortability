'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MatchingTarget } from '@/lib/types/matching';
import { GraphNode } from '@/lib/types/graph';
import { LassoConnection } from '@/hooks/usePersonalNetwork';
import { 
  Users, 
  Check,
  Play, 
  Zap, 
  ChevronDown,
  ChevronUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ban,
  XCircle,
  Lasso,
  X,
  Loader2,
  Upload,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations as useTranslationsStats } from 'next-intl';

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

interface FloatingAccountsPanelProps {
  matches: MatchingTarget[];
  setMatches: (matches: MatchingTarget[]) => void;
  session: {
    user: {
      bluesky_username?: string | null;
      mastodon_username?: string | null;
      has_onboarded?: boolean;
    };
  };
  onStartMigration: (selectedAccounts: string[]) => void;
  onShowLoginModal: () => void;
  selectedNode: GraphNode | null;
  lassoMembers?: GraphNode[];
  onClearLassoSelection?: () => void;
  // Lasso completed connections (with enriched data)
  lassoCompleted?: LassoConnection[];
  // When true, removes absolute positioning for use in flex containers (mobile)
  inline?: boolean;
}

type FilterType = 'pending' | 'connected' | 'ignored' | 'lasso';

export function FloatingAccountsPanel({
  matches,
  setMatches,
  session,
  onStartMigration,
  onShowLoginModal,
  selectedNode,
  lassoMembers = [],
  onClearLassoSelection,
  lassoCompleted = [],
  inline = false,
}: FloatingAccountsPanelProps) {
  const t = useTranslations('floatingAccountsPanel');
  const tStats = useTranslationsStats('floatingStatsPanel');
  
  const COOKIE_NAME = 'hqx_selected_accounts';
  const COOKIE_EXPIRY_DAYS = 1; // 1 day expiry
  
  // Collapsed state - always expanded by default
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [isSelectionLoaded, setIsSelectionLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 100;
  
  // Helper to get cookie value (same pattern as useCommunityColors)
  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
  }, []);
  
  // Helper to set cookie (same pattern as useCommunityColors)
  const setCookie = useCallback((name: string, value: string, days: number) => {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }, []);
  
  // Helper to delete cookie
  const deleteCookie = useCallback((name: string) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }, []);
  
  // Load selection from cookie on mount (same pattern as useCommunityColors)
  useEffect(() => {
    const cookieValue = getCookie(COOKIE_NAME);
    if (cookieValue) {
      try {
        const parsed = JSON.parse(cookieValue) as string[];
        setSelectedAccounts(new Set(parsed));
        // Delete cookie after restoring to avoid stale data
        deleteCookie(COOKIE_NAME);
      } catch (e) {
        console.warn('[FloatingAccountsPanel] Invalid cookie, ignoring:', e);
      }
    }
    setIsSelectionLoaded(true);
  }, [getCookie, deleteCookie]);
  
  // Save selection to cookie before OAuth redirect
  const saveSelectionToStorage = useCallback(() => {
    if (typeof document !== 'undefined' && selectedAccounts.size > 0) {
      try {
        const data = JSON.stringify(Array.from(selectedAccounts));
        setCookie(COOKIE_NAME, data, COOKIE_EXPIRY_DAYS);
      } catch (e) {
        console.warn('[FloatingAccountsPanel] Failed to save selection to cookie:', e);
      }
    }
  }, [selectedAccounts, setCookie]);

  // Check connected platforms and onboarding status
  const hasBluesky = !!session?.user?.bluesky_username;
  const hasMastodon = !!session?.user?.mastodon_username;
  const hasOnboarded = session?.user?.has_onboarded ?? false;

  // Helper to check if account has Mastodon (can be mastodon_handle OR mastodon_username)
  const hasMastodonAccount = (m: MatchingTarget) => !!(m.mastodon_handle || m.mastodon_username);

  // Debug: Log when matches prop changes
  useEffect(() => {
    const pendingInMatches = matches.filter(m => 
      hasBluesky && m.bluesky_handle && !m.has_follow_bluesky
    ).length;
    const connectedInMatches = matches.filter(m => 
      hasBluesky && m.bluesky_handle && m.has_follow_bluesky
    ).length;
  
  }, [matches, hasBluesky]);

  // Filter matches to only include accounts relevant to connected platforms
  // An account is relevant if it has a handle for at least one connected platform
  const relevantMatches = useMemo(() => {
    // If no platform connected, show all accounts (they can still browse)
    if (!hasBluesky && !hasMastodon) {
      return matches;
    }
    
    // Filter to only show accounts that can be followed on connected platforms
    return matches.filter(m => {
      const canFollowOnBluesky = hasBluesky && !!m.bluesky_handle;
      const canFollowOnMastodon = hasMastodon && hasMastodonAccount(m);
      return canFollowOnBluesky || canFollowOnMastodon;
    });
  }, [matches, hasBluesky, hasMastodon]);

  // Helper to check if a follow attempt failed (has followed_at but has_follow is false)
  const hasFailedBluesky = (m: MatchingTarget) => !m.has_follow_bluesky && !!m.followed_at_bluesky;
  const hasFailedMastodon = (m: MatchingTarget) => !m.has_follow_mastodon && !!m.followed_at_mastodon;

  // Calculate counts based on connected platforms
  // For users without connected platforms, show all accounts with handles as pending
  // Exclude accounts that have failed (have followed_at but has_follow is false)
  const pendingCount = useMemo(() => {
    return relevantMatches.filter(m => {
      if (m.dismissed) return false;
      // If no platform connected, show all accounts with any handle as pending (exclude failed)
      if (!hasBluesky && !hasMastodon) {
        const hasBsHandle = m.bluesky_handle && !hasFailedBluesky(m);
        const hasMastoHandle = hasMastodonAccount(m) && !hasFailedMastodon(m);
        return hasBsHandle || hasMastoHandle;
      }
      // Needs follow = has handle, not followed yet, and not failed
      const needsBluesky = hasBluesky && m.bluesky_handle && !m.has_follow_bluesky && !hasFailedBluesky(m);
      const needsMastodon = hasMastodon && hasMastodonAccount(m) && !m.has_follow_mastodon && !hasFailedMastodon(m);
      return needsBluesky || needsMastodon;
    }).length;
  }, [relevantMatches, hasBluesky, hasMastodon]);

  const connectedCount = useMemo(() => {
    return relevantMatches.filter(m => {
      const followedBluesky = hasBluesky && m.bluesky_handle && m.has_follow_bluesky;
      const followedMastodon = hasMastodon && hasMastodonAccount(m) && m.has_follow_mastodon;
      return followedBluesky || followedMastodon;
    }).length;
  }, [relevantMatches, hasBluesky, hasMastodon]);

  const ignoredCount = useMemo(() => {
    return relevantMatches.filter(m => m.dismissed).length;
  }, [relevantMatches]);

  // Count ALL accounts available on platforms NOT connected (to show connection prompts)
  // Shows total count of accounts with handles on each platform
  const missingPlatformCounts = useMemo(() => {
    let blueskyTotal = 0;
    let mastodonTotal = 0;

    matches.forEach(m => {
      if (m.dismissed) return;
      const hasBs = !!m.bluesky_handle;
      const hasMasto = hasMastodonAccount(m);
      
      // Count ALL accounts with Bluesky handle (if user hasn't connected Bluesky)
      if (!hasBluesky && hasBs) {
        blueskyTotal++;
      }
      // Count ALL accounts with Mastodon handle (if user hasn't connected Mastodon)
      if (!hasMastodon && hasMasto) {
        mastodonTotal++;
      }
    });

    return { blueskyAvailable: blueskyTotal, mastodonAvailable: mastodonTotal };
  }, [matches, hasBluesky, hasMastodon]);

  // Filter matches based on current tab
  const filteredMatches = useMemo(() => {
    let filtered = relevantMatches;

    switch (filter) {
      case 'pending':
        filtered = filtered.filter(m => {
          if (m.dismissed) return false;
          // If no platform connected, show all accounts with any handle as pending (exclude failed)
          if (!hasBluesky && !hasMastodon) {
            const hasBsHandle = m.bluesky_handle && !hasFailedBluesky(m);
            const hasMastoHandle = hasMastodonAccount(m) && !hasFailedMastodon(m);
            return hasBsHandle || hasMastoHandle;
          }
          // Needs follow = has handle, not followed yet, and not failed
          const needsBluesky = hasBluesky && m.bluesky_handle && !m.has_follow_bluesky && !hasFailedBluesky(m);
          const needsMastodon = hasMastodon && hasMastodonAccount(m) && !m.has_follow_mastodon && !hasFailedMastodon(m);
          return needsBluesky || needsMastodon;
        });
        break;
      case 'connected':
        filtered = filtered.filter(m => {
          const followedBluesky = hasBluesky && m.bluesky_handle && m.has_follow_bluesky;
          const followedMastodon = hasMastodon && hasMastodonAccount(m) && m.has_follow_mastodon;
          return followedBluesky || followedMastodon;
        });
        break;
      case 'ignored':
        filtered = filtered.filter(m => m.dismissed);
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        (hasBluesky && m.bluesky_handle?.toLowerCase().includes(query)) ||
        (hasMastodon && (m.mastodon_handle?.toLowerCase().includes(query) || m.mastodon_username?.toLowerCase().includes(query)))
      );
    }

    return filtered;
  }, [relevantMatches, filter, searchQuery, hasBluesky, hasMastodon]);

  // Pagination
  const paginatedMatches = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredMatches.slice(start, start + itemsPerPage);
  }, [filteredMatches, currentPage]);

  const totalPages = Math.ceil(filteredMatches.length / itemsPerPage);

  const handleToggleSelect = (nodeId: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleStartMigration = () => {
    // Show login modal if no platforms connected
    if (!hasBluesky && !hasMastodon) {
      // Save selection before OAuth redirect
      saveSelectionToStorage();
      onShowLoginModal();
      return;
    }
    onStartMigration(Array.from(selectedAccounts));
    // Clear selection after starting migration
    setSelectedAccounts(new Set());
    // Also clear the cookie
    deleteCookie(COOKIE_NAME);
  };

  const handleIgnoreSelected = async () => {
    const accountsToIgnore = Array.from(selectedAccounts);
    
    try {
      // Call API for each selected account
      await Promise.all(accountsToIgnore.map(async (nodeId) => {
        const response = await fetch("/api/migrate/ignore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetTwitterId: nodeId, action: "ignore" }),
        });
        if (!response.ok) throw new Error("Failed to ignore account");
      }));

      // Update local state to mark accounts as dismissed
      const updatedMatches = matches.map(match => {
        if (accountsToIgnore.includes(match.node_id)) {
          return { ...match, dismissed: true };
        }
        return match;
      });
      setMatches(updatedMatches);

      // Clear selection
      setSelectedAccounts(new Set());
    } catch (error) {
      console.error("Error ignoring accounts:", error);
    }
  };

  const handleUnignoreSelected = async () => {
    const accountsToUnignore = Array.from(selectedAccounts);
    
    try {
      // Call API for each selected account
      await Promise.all(accountsToUnignore.map(async (nodeId) => {
        const response = await fetch("/api/migrate/ignore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetTwitterId: nodeId, action: "unignore" }),
        });
        if (!response.ok) throw new Error("Failed to unignore account");
      }));

      // Update local state to mark accounts as not dismissed
      const updatedMatches = matches.map(match => {
        if (accountsToUnignore.includes(match.node_id)) {
          return { ...match, dismissed: false };
        }
        return match;
      });
      setMatches(updatedMatches);

      // Clear selection
      setSelectedAccounts(new Set());
    } catch (error) {
      console.error("Error unignoring accounts:", error);
    }
  };

  // Lasso follow state
  const [isLassoFollowing, setIsLassoFollowing] = useState(false);
  const [lassoFollowResult, setLassoFollowResult] = useState<{
    bluesky?: { succeeded: number; failed: number };
    mastodon?: { succeeded: number; failed: number };
  } | null>(null);

  // Handle lasso follow
  const handleLassoFollow = useCallback(async () => {
    if (lassoMembers.length === 0) return;
    
    setIsLassoFollowing(true);
    setLassoFollowResult(null);
    
    try {
      const twitterIds = lassoMembers.map(m => m.id);
      
      const response = await fetch('/api/migrate/lasso_follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twitterIds }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to follow lasso selection');
      }
      
      const result = await response.json();
      setLassoFollowResult({
        bluesky: result.bluesky,
        mastodon: result.mastodon,
      });
      
    } catch (error) {
      console.error('Error following lasso selection:', error);
    } finally {
      setIsLassoFollowing(false);
    }
  }, [lassoMembers]);

  const filterTabs: { key: FilterType; label: string; count: number; icon: typeof Clock }[] = [
    { key: 'pending', label: t('tabs.pending'), count: pendingCount, icon: Clock },
    { key: 'connected', label: t('tabs.connected'), count: connectedCount, icon: Check },
    { key: 'ignored', label: t('tabs.ignored'), count: ignoredCount, icon: Ban },
    // Show lasso tab only if there are completed lasso connections
    ...(lassoCompleted.length > 0 ? [{ key: 'lasso' as FilterType, label: t('tabs.lasso'), count: lassoCompleted.length, icon: Lasso }] : []),
  ];

  // Get all pending accounts (not dismissed, not already followed, not failed)
  const pendingAccounts = useMemo(() => {
    return relevantMatches.filter(m => {
      if (m.dismissed) return false;
      if (!hasBluesky && !hasMastodon) {
        const hasBsHandle = m.bluesky_handle && !hasFailedBluesky(m);
        const hasMastoHandle = hasMastodonAccount(m) && !hasFailedMastodon(m);
        return hasBsHandle || hasMastoHandle;
      }
      const needsBluesky = hasBluesky && m.bluesky_handle && !m.has_follow_bluesky && !hasFailedBluesky(m);
      const needsMastodon = hasMastodon && hasMastodonAccount(m) && !m.has_follow_mastodon && !hasFailedMastodon(m);
      return needsBluesky || needsMastodon;
    });
  }, [relevantMatches, hasBluesky, hasMastodon]);

  // Handle reconnect button click - select all pending accounts and send to API
  const handleReconnectClick = useCallback(() => {
    
    // Show login modal if no platforms connected
    if (!hasBluesky && !hasMastodon) {
      // Save all pending accounts as selection before OAuth redirect
      const allPendingIds = pendingAccounts.map(m => m.node_id);
      setSelectedAccounts(new Set(allPendingIds));
      saveSelectionToStorage();
      onShowLoginModal();
      return;
    }
    
    // Get all pending account node_ids and send to migration
    const allPendingIds = pendingAccounts.map(m => m.node_id);
    if (allPendingIds.length === 0) {
      return;
    }
    
    onStartMigration(allPendingIds);
    
    // Clear selection after starting migration
    setSelectedAccounts(new Set());
    deleteCookie(COOKIE_NAME);
  }, [hasBluesky, hasMastodon, pendingAccounts, onShowLoginModal, saveSelectionToStorage, onStartMigration, deleteCookie]);

  // Early return AFTER all hooks (React rules of hooks)
  if (!matches || matches.length === 0) {
    return null;
  }

  return (
    <div 
      className={`${inline ? '' : 'absolute top-16 left-2 right-2 md:left-6 md:right-auto'} w-auto md:w-80 bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl overflow-hidden transition-all duration-300`}
      style={{ maxHeight: isExpanded ? (inline ? '50vh' : '75vh') : '44px' }}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 border-b border-slate-700/50 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
            {t('header')}
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {relevantMatches.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedAccounts.size > 0 && (
            <span className="text-[10px] text-emerald-400 tabular-nums">
              {t('selected', { count: selectedAccounts.size })}
            </span>
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
          {/* Filter Tabs */}
          <div className="px-3 py-2 border-b border-slate-700/50 flex gap-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key); setCurrentPage(0); }}
                className={`relative flex-1 px-2 py-1.5 text-[10px] font-medium tracking-wide transition-all rounded ${
                  filter === tab.key 
                    ? 'text-white bg-slate-800' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
                <span className={`ml-1 tabular-nums ${filter === tab.key ? 'text-slate-400' : 'text-slate-600'}`}>
                  {tab.count}
                </span>
                {filter === tab.key && (
                  <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 ${
                    tab.key === 'pending' ? 'bg-blue-500' : 
                    tab.key === 'connected' ? 'bg-emerald-500' : 'bg-slate-500'
                  }`} />
                )}
              </button>
            ))}
          </div>

          {/* Reconnect Button - Show upload button if no pending and not onboarded, show reconnect if pending > 0, hide otherwise */}
          <div className="px-3 py-2 border-b border-slate-700/50">
            {pendingCount === 0 && !hasOnboarded ? (
              <Link
                href="/upload"
                className="flex items-center gap-3 py-3 px-3 rounded bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 transition-all group"
              >
                <Upload className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                <div className="flex-1">
                  <span className="text-[11px] text-white font-medium block">{tStats('network.importArchive')}</span>
                  <span className="text-[9px] text-white">{tStats('network.findConnections')}</span>
                </div>
              </Link>
            ) : pendingCount > 0 ? (
              <button
                onClick={handleReconnectClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-[11px] font-medium text-white transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                {t('reconnectButton')}
              </button>
            ) : null}

            {/* Missing platform prompts - Show when user is missing a platform connection */}
            {filter === 'pending' && (
              <>
                {/* Bluesky not connected but has accounts */}
                {!hasBluesky && missingPlatformCounts.blueskyAvailable > 0 && (
                  <button
                    onClick={onShowLoginModal}
                    className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded bg-sky-600/10 hover:bg-sky-600/20 border border-sky-500/20 transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
                    <span className="text-[10px] text-sky-300 group-hover:text-sky-200 flex-1 text-left">
                      {t('missingPlatform.bluesky', { count: missingPlatformCounts.blueskyAvailable })}
                    </span>
                  </button>
                )}

                {/* Mastodon not connected but has accounts */}
                {!hasMastodon && missingPlatformCounts.mastodonAvailable > 0 && (
                  <button
                    onClick={onShowLoginModal}
                    className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                    <span className="text-[10px] text-purple-300 group-hover:text-purple-200 flex-1 text-left">
                      {t('missingPlatform.mastodon', { count: missingPlatformCounts.mastodonAvailable })}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Search - Hide when pending tab is empty */}
          {!(filter === 'pending' && pendingCount === 0) && (
            <div className="px-3 py-2 border-b border-slate-700/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder={t('search.placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-800/50 border border-slate-700/50 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>
            </div>
          )}

          {/* Action Bar - Show on pending tab with selections */}
          {filter === 'pending' && selectedAccounts.size > 0 && (
            <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-end gap-2">
              <button
                onClick={handleIgnoreSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] font-medium text-slate-300 transition-colors"
              >
                <XCircle className="w-3 h-3" />
                {t('actions.ignore', { count: selectedAccounts.size })}
              </button>
              <button
                onClick={handleStartMigration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-medium text-white transition-colors"
              >
                <Play className="w-3 h-3" />
                {t('actions.follow', { count: selectedAccounts.size })}
              </button>
            </div>
          )}

          {/* Action Bar - Show on ignored tab with selections */}
          {filter === 'ignored' && selectedAccounts.size > 0 && (
            <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-end gap-2">
              <button
                onClick={handleUnignoreSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-[10px] font-medium text-white transition-colors"
              >
                <Check className="w-3 h-3" />
                {t('actions.restore', { count: selectedAccounts.size })}
              </button>
            </div>
          )}

          {/* Lasso Tab Content - Shows completed lasso connections */}
          {filter === 'lasso' && (
            <div className="p-3 space-y-3">
              {/* Lasso Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lasso className="w-4 h-4 text-blue-400" />
                  <span className="text-[11px] text-slate-300">
                    {t('lasso.connectedAccounts', { count: lassoCompleted.length })}
                  </span>
                </div>
              </div>

              {/* Lasso Connected List */}
              <div className="max-h-[25vh] overflow-y-auto space-y-1">
                {lassoCompleted.length === 0 ? (
                  <div className="text-center py-4">
                    <span className="text-[11px] text-slate-500">
                      {t('lasso.noConnections')}
                    </span>
                  </div>
                ) : (
                  lassoCompleted.slice(0, 50).map((connection) => (
                    <div
                      key={connection.id}
                      className="px-2 py-1.5 rounded bg-slate-800/50"
                    >
                      <div className="flex-1 min-w-0">
                        {connection.bluesky_handle && (
                          <a
                            href={`https://bsky.app/profile/${connection.bluesky_handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
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
                                className="flex items-center gap-1.5 text-[12px] text-purple-400 hover:text-purple-300 transition-colors font-medium"
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
                          <span className="text-[12px] text-slate-500 truncate font-medium">
                            {connection.tier || 'Unknown'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {lassoCompleted.length > 50 && (
                  <div className="text-center py-2">
                    <span className="text-[11px] text-slate-500">
                      {t('lasso.moreConnections', { count: lassoCompleted.length - 50 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Accounts List (for non-lasso tabs) */}
          {/* Account List - Hide empty state when pending tab has no accounts */}
          {filter !== 'lasso' && !(filter === 'pending' && pendingCount === 0) && (
          <div className="max-h-[35vh] overflow-y-auto">
            {paginatedMatches.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="w-6 h-6 mx-auto text-slate-600 mb-2" />
                <p className="text-[11px] text-slate-500">{t('empty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {paginatedMatches.map((match) => {
                  const isSelected = selectedAccounts.has(match.node_id);
                  const isHighlighted = selectedNode?.id === match.node_id;
                  const isConnectedTab = filter === 'connected';
                  const mastodonHandle = match.mastodon_handle || (match.mastodon_username && match.mastodon_instance ? `@${match.mastodon_username}@${match.mastodon_instance.replace('https://', '')}` : null);
                  const mastodonUrl = mastodonHandle ? getMastodonProfileUrl(mastodonHandle) : null;
                  
                  return (
                    <div
                      key={match.node_id}
                      className={`px-3 py-2.5 flex items-center gap-2.5 transition-all ${
                        isConnectedTab ? '' : 'cursor-pointer'
                      } ${
                        isHighlighted ? 'bg-amber-500/10' : isConnectedTab ? '' : 'hover:bg-slate-800/50'
                      }`}
                      onClick={isConnectedTab ? undefined : () => handleToggleSelect(match.node_id)}
                    >
                      {/* Checkbox - Hide on connected tab */}
                      {!isConnectedTab && (
                        <div 
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                            isSelected 
                              ? 'bg-emerald-500 border-emerald-500' 
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      )}

                      {/* Account Info */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        {match.bluesky_handle && (
                          <a
                            href={`https://bsky.app/profile/${match.bluesky_handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">@{match.bluesky_handle}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {match.has_follow_bluesky && (
                              <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            )}
                          </a>
                        )}
                        {mastodonHandle && (
                          mastodonUrl ? (
                            <a
                              href={mastodonUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[12px] text-purple-400 hover:text-purple-300 transition-colors font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">{mastodonHandle}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              {match.has_follow_mastodon && (
                                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              )}
                            </a>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] text-purple-400 truncate font-medium">
                                {mastodonHandle}
                              </span>
                              {match.has_follow_mastodon && (
                                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              )}
                            </div>
                          )
                        )}
                      </div>

                      {/* Status Badge */}
                      {isHighlighted && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-wider">
                          {t('status.active')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-3 py-2 border-t border-slate-700/50 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" />
                {t('pagination.prev')}
              </button>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t('pagination.next')}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

        </>
      )}
    </div>
  );
}

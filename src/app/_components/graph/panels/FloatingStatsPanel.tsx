'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowUpRight, Check, Users, UserPlus, Activity, Layers, Star, Upload, LogIn, Info, X, ChevronUp, ChevronDown, Network, UserCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

// Platform icons
import mastodonIcon from '../../../../../public/newSVG/masto.svg';
import blueskyIcon from '../../../../../public/newSVG/BS.svg';
import twitterIcon from '../../../../../public/newSVG/X.svg';
import { ReconnectLoginModal } from '@/app/_components/modales/ReconnectLoginModal';
import { quantico } from '@/app/fonts/plex';
import { useGraphDataOptional } from '@/contexts/GraphDataContext';

// Tooltip component for hover info
function InfoTooltip({ 
  children, 
  isOpen, 
  onClose 
}: { 
  children: React.ReactNode; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`${quantico.className} modal-scrollbar-dark relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl max-w-lg max-h-[80vh] overflow-y-auto`}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

interface MatchingTarget {
  bluesky_handle?: string | null;
  mastodon_handle?: string | null;
  mastodon_username?: string | null;
  has_follow_bluesky?: boolean;
  has_follow_mastodon?: boolean;
  dismissed?: boolean;
}

interface FloatingStatsPanelProps {
  stats: {
    connections: {
      followers: number;
      following: number;
      totalEffectiveFollowers: number;
    };
    matches: {
      bluesky: {
        total: number;
        hasFollowed: number;
        notFollowed: number;
      };
      mastodon: {
        total: number;
        hasFollowed: number;
        notFollowed: number;
      };
    };
  } | null;
  session: {
    user: {
      twitter_username?: string | null;
      bluesky_username?: string | null;
      mastodon_username?: string | null;
      has_onboarded?: boolean;
    };
  } | null;
  totalNodes: number;
  isLoadingPersonal: boolean;
  isGraphReady: boolean;
  hasPersonalNetwork: boolean;
  communityCount?: number;
  accountsToProcess?: MatchingTarget[];
  mastodonInstances?: string[];
  showFollowing?: boolean;
  showFollowers?: boolean;
  onToggleFollowing?: () => void;
  onToggleFollowers?: () => void;
  onShowMyNetwork?: () => void;
  onShowMyNode?: () => void;
  onShowConnected?: () => void;
  onShowEffectiveFollowers?: () => void; // callback to highlight only effective followers (purple) - followers who followed via OP
  onResetView?: () => void; // callback to reset graph viewport to initial state
  lassoConnectedCount?: number; // number of lasso connected nodes to show in legend
  currentConsentLevel?: 'no_consent' | 'only_to_followers_of_followers' | 'all_consent' | null; // current user consent level for visibility
  onConsentLevelChange?: (level: 'no_consent' | 'only_to_followers_of_followers' | 'all_consent') => void; // callback when consent level changes
  globalStats?: {
    users: { total: number; onboarded: number };
    connections: {
      followers: number;
      following: number;
      followedOnBluesky: number;
      followedOnMastodon: number;
    };
  };
  isTileLoading?: boolean;
  maxMemoryNodes?: number;
  onOpenNodeSettings?: () => void;
  addedLabelsCount?: number;
}

export function FloatingStatsPanel({
  stats,
  session,
  totalNodes,
  isLoadingPersonal,
  isGraphReady,
  hasPersonalNetwork,
  communityCount = 10,
  accountsToProcess = [],
  mastodonInstances = [],
  showFollowing = true,
  showFollowers = true,
  onToggleFollowing,
  onToggleFollowers,
  onShowMyNetwork,
  onShowMyNode,
  onShowConnected,
  onShowEffectiveFollowers,
  onResetView,
  lassoConnectedCount = 0,
  currentConsentLevel,
  onConsentLevelChange,
  globalStats,
  isTileLoading = false,
  maxMemoryNodes,
  onOpenNodeSettings,
  addedLabelsCount = 0,
}: FloatingStatsPanelProps) {
  const t = useTranslations('floatingStatsPanel');
  const graphData = useGraphDataOptional();
  
  // Collapsed state - default to collapsed on mobile, expanded on desktop
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Set initial collapsed state based on screen size
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setIsCollapsed(isMobile);
  }, []);
  
  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showImportTooltip, setShowImportTooltip] = useState(false);
  const [showConnectTooltip, setShowConnectTooltip] = useState(false);
  const [showGraphTooltip, setShowGraphTooltip] = useState(false);
  
  // Reset view animation state
  const [isResetting, setIsResetting] = useState(false);

  // Check user state (moved up for useCallback dependency)
  const isLoggedIn = !!session?.user;
  
  // Visibility toggle state
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const isVisible = currentConsentLevel === 'all_consent';
  
  // Handle visibility toggle
  const handleVisibilityToggle = useCallback(async () => {
    if (!isLoggedIn || isUpdatingVisibility) return;
    
    setIsUpdatingVisibility(true);
    setVisibilityError(null);
    
    const newLevel = isVisible ? 'no_consent' : 'all_consent';
    
    try {
      const response = await fetch('/api/graph/consent_labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_level: newLevel }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update visibility');
      }

      // Update local state immediately for responsive UI
      onConsentLevelChange?.(newLevel);
      
      // SSE will handle the incremental label update for other clients
      // No need to refetch all labels - the SSE handler in GraphDataContext
      // will add/remove the single label that changed
    } catch (err) {
      setVisibilityError(err instanceof Error ? err.message : 'An error occurred');
      // Revert on error
      onConsentLevelChange?.(isVisible ? 'all_consent' : 'no_consent');
    } finally {
      setIsUpdatingVisibility(false);
    }
  }, [isLoggedIn, isUpdatingVisibility, isVisible, graphData, onConsentLevelChange]);
  const hasOnboarded = session?.user?.has_onboarded ?? false;
  const hasTwitter = !!session?.user?.twitter_username;
  const hasBluesky = !!session?.user?.bluesky_username;
  const hasMastodon = !!session?.user?.mastodon_username;
  const hasAnyPlatform = hasBluesky || hasMastodon;

  // Helper to check if account has Mastodon
  const hasMastodonAccount = (m: MatchingTarget) => !!(m.mastodon_handle || m.mastodon_username);

  // Calculate unique account counts from accountsToProcess
  const { toConnect, connected } = useMemo(() => {
    let toConnectCount = 0;
    let connectedCount = 0;

    accountsToProcess.forEach(m => {
      if (m.dismissed) return;

      const hasBS = !!m.bluesky_handle;
      const hasMasto = hasMastodonAccount(m);
      
      const needsBluesky = hasBluesky && hasBS && !m.has_follow_bluesky;
      const needsMastodon = hasMastodon && hasMasto && !m.has_follow_mastodon;
      
      const followedBluesky = hasBluesky && hasBS && m.has_follow_bluesky;
      const followedMastodon = hasMastodon && hasMasto && m.has_follow_mastodon;

      if (needsBluesky || needsMastodon) {
        toConnectCount++;
      } 
      else if ((hasBluesky && hasBS ? followedBluesky : true) && 
               (hasMastodon && hasMasto ? followedMastodon : true) &&
               (followedBluesky || followedMastodon)) {
        connectedCount++;
      }
    });

    return { toConnect: toConnectCount, connected: connectedCount };
  }, [accountsToProcess, hasBluesky, hasMastodon]);

  const importedFollowers = stats?.connections?.followers ?? 0;
  const importedFollowing = stats?.connections?.following ?? 0;
  const effectiveFollowers = stats?.connections?.totalEffectiveFollowers ?? 0;

  // Determine title and description based on user state and view mode
  const getTitleInfo = () => {
    if (!isLoggedIn) {
      return {
        description: t('header.exploration.description'),
        status: t('header.exploration.status'),
        statusColor: 'text-slate-500',
      };
    }
    if (!hasOnboarded) {
      return {
        description: t('header.discovery.description'),
        status: t('header.discovery.status'),
        statusColor: 'text-blue-400',
      };
    }
    
    // Adapt description based on view mode
    let modeDescription = t('header.yourNetwork.description');
    if (showFollowers && !showFollowing) {
      modeDescription = t('header.modes.followers.description');
    } else if (showFollowing && !showFollowers) {
      modeDescription = t('header.modes.following.description');
    } else if (!showFollowers && !showFollowing) {
      modeDescription = t('header.modes.discover.description');
    }
    
    return {
      description: modeDescription,
      status: hasPersonalNetwork ? t('header.yourNetwork.statusReady') : isLoadingPersonal ? t('header.yourNetwork.statusLoading') : t('header.yourNetwork.statusPending'),
      statusColor: hasPersonalNetwork ? 'text-emerald-500' : isLoadingPersonal ? 'text-amber-500' : 'text-slate-500',
    };
  };

  const titleInfo = getTitleInfo();

  return (
    <>
      <div className={`${quantico.className} hidden md:block absolute md:top-16 md:right-6 md:w-64 bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl overflow-hidden transition-all duration-300`}>
        
        {/* Header Section - Always visible with dynamic title and collapse button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full px-4 py-3 border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity 
                className={`w-3 h-3 ${titleInfo.statusColor} ${isLoadingPersonal ? 'animate-pulse' : ''}`}
              />
              <span className={`text-[9px] uppercase tracking-wider ${titleInfo.statusColor}`}>
                {titleInfo.status}
              </span>
            </div>
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </div>
          {!isCollapsed && (
            <p className="text-[10px] text-white leading-relaxed text-left mt-1">
              {titleInfo.description}
            </p>
          )}
        </button>

        {/* Collapsible Content */}
        {!isCollapsed && (
          <>
        {addedLabelsCount > 0 && (
          <div className="px-4 py-2 border-b border-emerald-500/20 bg-emerald-900/20">
            <div className="text-[9px] uppercase tracking-wider text-emerald-300">
              {t('labelsRefresh.title')}
            </div>
            <div className="text-[11px] text-emerald-100 font-medium">
              {t('labelsRefresh.added', { count: addedLabelsCount })}
            </div>
          </div>
        )}
        {/* Platform Section - Now first */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white uppercase tracking-wider">{t('platforms.title')}</span>
            <button
              onClick={() => setShowConnectTooltip(true)}
              className="p-0.5 rounded hover:bg-slate-700 transition-colors"
            >
              <Info className="w-3 h-3 text-slate-400 hover:text-slate-300" />
            </button>
          </div>
          
          {/* Non-connected platforms FIRST with logos + notification badge */}
          {!hasTwitter && (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full flex items-center justify-between py-2 px-3 rounded bg-slate-600/20 hover:bg-slate-600/30 border border-slate-500/30 transition-all group"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Image src={twitterIcon} alt="X" width={16} height={16} className="opacity-70 group-hover:opacity-100" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">!</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-300 group-hover:text-white">{t('platforms.twitter')}</span>
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-white font-medium">{t('platforms.connect')}</span>
            </button>
          )}

          {!hasBluesky && (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full flex items-center justify-between py-2 px-3 rounded bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 transition-all group"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Image src={blueskyIcon} alt="Bluesky" width={16} height={16} className="opacity-80 group-hover:opacity-100" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">!</span>
                  </div>
                </div>
                <span className="text-[11px] text-sky-200 group-hover:text-white">{t('platforms.bluesky')}</span>
              </div>
              <span className="text-[10px] text-sky-300 group-hover:text-sky-100 font-medium">{t('platforms.connect')}</span>
            </button>
          )}
          
          {!hasMastodon && (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full flex items-center justify-between py-2 px-3 rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all group"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Image src={mastodonIcon} alt="Mastodon" width={16} height={16} className="opacity-80 group-hover:opacity-100" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">!</span>
                  </div>
                </div>
                <span className="text-[11px] text-purple-200 group-hover:text-white">{t('platforms.mastodon')}</span>
              </div>
              <span className="text-[10px] text-purple-300 group-hover:text-purple-100 font-medium">{t('platforms.connect')}</span>
            </button>
          )}

          {/* Connected platforms after - with logos and green tick badge */}
          {hasTwitter && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Image src={twitterIcon} alt="X" width={14} height={14} className="opacity-60" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">✓</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">{t('platforms.twitter')}</span>
              </div>
              <span className="text-[10px] text-emerald-400">{t('platforms.connected')}</span>
            </div>
          )}

          {hasBluesky && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Image src={blueskyIcon} alt="Bluesky" width={14} height={14} className="opacity-60" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">✓</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">{t('platforms.bluesky')}</span>
              </div>
              <span className="text-[10px] text-emerald-400">{t('platforms.connected')}</span>
            </div>
          )}
          
          {hasMastodon && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Image src={mastodonIcon} alt="Mastodon" width={14} height={14} className="opacity-60" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">✓</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">{t('platforms.mastodon')}</span>
              </div>
              <span className="text-[10px] text-emerald-400">{t('platforms.connected')}</span>
            </div>
          )}
        </div>

        {/* Network Stats - Only for logged in users */}
        {isLoggedIn && (
          <div className="px-4 py-3 border-t border-slate-700/50 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white uppercase tracking-widest font-medium">
                {t('header.yourNetwork.title')}
              </span>
              <button
                onClick={() => setShowImportTooltip(true)}
                className="p-0.5 rounded hover:bg-slate-700 transition-colors"
              >
                <Info className="w-3 h-3 text-slate-400 hover:text-slate-300" />
              </button>
            </div>

            {/* Following/Followers buttons - adapt label based on hasOnboarded */}
            {hasOnboarded ? (
              <>
                {/* Imported Following (people I follow) - clickable to toggle */}
                {importedFollowing > 0 && (
                  <button
                    onClick={onToggleFollowing}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded transition-colors cursor-pointer ${
                      showFollowing 
                        ? 'bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30' 
                        : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className={`w-3.5 h-3.5 ${showFollowing ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className={`text-[11px] ${showFollowing ? 'text-white' : 'text-slate-400'}`}>{t('stats.importedFollowing')}</span>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${showFollowing ? 'text-white' : 'text-slate-400'}`}>
                      {importedFollowing.toLocaleString()}
                    </span>
                  </button>
                )}

                {/* Imported Followers (people who follow me) - clickable to toggle */}
                {importedFollowers > 0 && (
                  <button
                    onClick={onToggleFollowers}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded transition-colors cursor-pointer ${
                      showFollowers 
                        ? 'bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30' 
                        : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className={`w-3.5 h-3.5 ${showFollowers ? 'text-purple-400' : 'text-slate-500'}`} />
                      <span className={`text-[11px] ${showFollowers ? 'text-white' : 'text-slate-400'}`}>{t('stats.importedFollowers')}</span>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${showFollowers ? 'text-white' : 'text-slate-400'}`}>
                      {importedFollowers.toLocaleString()}
                    </span>
                  </button>
                )}
              </>
            ) : (
              /* Retrieved stats for users who haven't onboarded */
              <>
                {/* Retrieved Following - clickable to toggle */}
                {importedFollowers > 0 && (
                  <button
                    onClick={onToggleFollowing}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded transition-colors cursor-pointer ${
                      showFollowing 
                        ? 'bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30' 
                        : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className={`w-3.5 h-3.5 ${showFollowing ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className={`text-[11px] ${showFollowing ? 'text-white' : 'text-slate-400'}`}>{t('stats.retrievedFollowing')}</span>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${showFollowing ? 'text-white' : 'text-slate-400'}`}>
                      {importedFollowers.toLocaleString()}
                    </span>
                  </button>
                )}

                {/* Retrieved Followers - clickable to toggle */}
                {importedFollowing > 0 && (
                  <button
                    onClick={onToggleFollowers}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded transition-colors cursor-pointer ${
                      showFollowers 
                        ? 'bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30' 
                        : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className={`w-3.5 h-3.5 ${showFollowers ? 'text-purple-400' : 'text-slate-500'}`} />
                      <span className={`text-[11px] ${showFollowers ? 'text-white' : 'text-slate-400'}`}>{t('stats.retrievedFollowers')}</span>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${showFollowers ? 'text-white' : 'text-slate-400'}`}>
                      {importedFollowing.toLocaleString()}
                    </span>
                  </button>
                )}

                {/* Upload button - only for non-onboarded users */}
                <Link
                  href="/upload"
                  className="flex items-center gap-3 py-3 px-3 rounded bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 transition-all group"
                >
                  <Upload className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                  <div className="flex-1">
                    <span className="text-[11px] text-white font-medium block">{t('network.importArchive')}</span>
                    <span className="text-[9px] text-white">{t('network.findConnections')}</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        )}

        {/* Graph Section - Always visible */}
        <div className="px-4 py-3 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white uppercase tracking-widest font-medium">
                {t('graph.title')}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowGraphTooltip(true); }}
                className="p-0.5 rounded hover:bg-slate-700 transition-colors"
              >
                <Info className="w-3 h-3 text-slate-400 hover:text-slate-300" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {isTileLoading ? (
                <>
                  <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                  <span className="text-[9px] uppercase tracking-wider text-blue-400">
                    {t('graph.statusLoadingTiles')}
                  </span>
                </>
              ) : !isGraphReady ? (
                <>
                  <Activity className="w-3 h-3 text-amber-500 animate-pulse" />
                  <span className="text-[9px] uppercase tracking-wider text-amber-500">
                    {t('graph.statusLoading')}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          
          <div className="space-y-2">
            {/* Total Nodes */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white">{t('graph.totalNodes')}</span>
              <span className="text-[13px] text-white font-medium tabular-nums">
                {totalNodes.toLocaleString()}
              </span>
            </div>
            
            {/* Max Nodes with settings button */}
            {maxMemoryNodes !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{t('graph.maxNodes')}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-slate-400 font-medium tabular-nums">
                    {(maxMemoryNodes / 1000).toFixed(0)}k
                  </span>
                  {onOpenNodeSettings && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenNodeSettings(); }}
                      className="p-0.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-blue-400"
                      title={t('graph.adjustMaxNodes')}
                    >
                      <Layers className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* OpenPortability Stats */}
            {globalStats && (
              <>
                <div className="mt-2 pt-2 border-t border-slate-700/30">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">OPENPORTABILITY</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] text-white">Total users</span>
                  </div>
                  <span className="text-[13px] text-white font-medium tabular-nums">
                    {globalStats.users.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] text-white">Total connections</span>
                  </div>
                  <span className="text-[13px] text-white font-medium tabular-nums">
                    {(globalStats.connections.followers + globalStats.connections.following).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 text-purple-400" />
                    <span className="text-[11px] text-white">Total reconnections</span>
                  </div>
                  <span className="text-[13px] text-purple-300 font-medium tabular-nums">
                    {(globalStats.connections.followedOnBluesky + globalStats.connections.followedOnMastodon).toLocaleString()}
                  </span>
                </div>
              </>
            )}

            {/* Reconnection Stats per Platform - Both on same line */}
            {stats && (hasBluesky || hasMastodon) && (stats.matches.bluesky.total > 0 || stats.matches.mastodon.total > 0) && (
              <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {hasOnboarded ? t('reconnectionStats.reconnected') : t('reconnectionStats.found')}
                </span>
                
                {/* Both platforms on same line */}
                <div className="flex items-center justify-between gap-3">
                  {hasBluesky && stats.matches.bluesky.total > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-sky-400" />
                      <span className="text-[10px] text-slate-300">Bluesky</span>
                      <span className="text-[10px] text-white tabular-nums">
                        {stats.matches.bluesky.total.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {hasMastodon && stats.matches.mastodon.total > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-[10px] text-slate-300">Mastodon</span>
                      <span className="text-[10px] text-white tabular-nums">
                        {stats.matches.mastodon.total.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Effective Followers - Only show in followers mode */}
                {showFollowers && !showFollowing && effectiveFollowers > 0 && (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-purple-300">{t('reconnectionStats.effectiveFollowers')}</span>
                    </div>
                    <span className="text-[10px] text-purple-300 font-medium tabular-nums">
                      {effectiveFollowers.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Highlight Legend - Only show when in followings/followers view */}
          {(showFollowing || showFollowers) && hasPersonalNetwork && (
            <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Highlight Legend</span>
              <div className="space-y-1.5">
                {/* Following mode legend */}
                {showFollowing && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <span className="text-[10px] text-slate-300">Followed accounts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-pink-500" />
                      <span className="text-[10px] text-slate-300">Accounts to follow</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span className="text-[10px] text-slate-300">Accounts not yet on OpenPortability</span>
                    </div>
                  </>
                )}
                {/* Followers mode legend */}
                {showFollowers && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-[10px] text-slate-300">Gained followers (via OP)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <span className="text-[10px] text-slate-300">Other followers</span>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-[10px] text-slate-300">You are here</span>
                </div>
                {lassoConnectedCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-[10px] text-slate-300">Discovered via lasso</span>
                  </div>
                )}
              </div>

              {/* Re-highlight buttons */}
              <div className="flex flex-col gap-1.5 mt-2">
                {onShowMyNetwork && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={onShowMyNetwork}
                      className="flex-1 py-1.5 px-2 text-[10px] font-medium text-amber-300 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded transition-colors"
                    >
                      {showFollowers && !showFollowing ? t('buttons.showAllFollowers') : t('buttons.showMyNetwork')}
                    </button>
                    <div className="relative group">
                      <Info className="w-3.5 h-3.5 text-amber-400 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-slate-800 border border-slate-600 rounded text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {showFollowers && !showFollowing ? t('buttons.showAllFollowersTooltip') : t('buttons.showMyNetworkTooltip')}
                      </div>
                    </div>
                  </div>
                )}
                {onShowMyNode && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={onShowMyNode}
                      className="flex-1 py-1.5 px-2 text-[10px] font-medium text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded transition-colors"
                    >
                      {t('buttons.showMyNode')}
                    </button>
                    <div className="relative group">
                      <Info className="w-3.5 h-3.5 text-emerald-400 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-slate-800 border border-slate-600 rounded text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {t('buttons.showMyNodeTooltip')}
                      </div>
                    </div>
                  </div>
                )}
                {/* Hide Show Discovered in FOLLOWER mode (showFollowers && !showFollowing) */}
                {onShowConnected && lassoConnectedCount > 0 && !(showFollowers && !showFollowing) && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={onShowConnected}
                      className="flex-1 py-1.5 px-2 text-[10px] font-medium text-blue-300 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded transition-colors"
                    >
                      {t('buttons.showDiscovered')}
                    </button>
                    <div className="relative group">
                      <Info className="w-3.5 h-3.5 text-blue-400 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-slate-800 border border-slate-600 rounded text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {t('buttons.showDiscoveredTooltip')}
                      </div>
                    </div>
                  </div>
                )}
                {onShowEffectiveFollowers && showFollowers && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={onShowEffectiveFollowers}
                      className="flex-1 py-1.5 px-2 text-[10px] font-medium text-purple-300 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded transition-colors"
                    >
                      {t('buttons.showEffectiveFollowers')}
                    </button>
                    <div className="relative group">
                      <Info className="w-3.5 h-3.5 text-purple-400 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-slate-800 border border-slate-600 rounded text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {t('buttons.showEffectiveFollowersTooltip')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visibility Toggle - Only in Discover mode for logged in users */}
          {isLoggedIn && !showFollowers && !showFollowing && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isVisible ? (
                    <Eye className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-500" />
                  )}
                  <div>
                    <span className="text-[11px] text-white block">{t('visibility.title')}</span>
                    <span className="text-[9px] text-slate-400">{isVisible ? t('visibility.visible') : t('visibility.hidden')}</span>
                  </div>
                </div>
                <button
                  onClick={handleVisibilityToggle}
                  disabled={isUpdatingVisibility}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    isUpdatingVisibility ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                  } ${isVisible ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  {isUpdatingVisibility ? (
                    <Loader2 className="w-3 h-3 text-white absolute top-1 left-1/2 -translate-x-1/2 animate-spin" />
                  ) : (
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      isVisible ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  )}
                </button>
              </div>
              {visibilityError && (
                <p className="text-[9px] text-red-400 mt-1">{visibilityError}</p>
              )}
            </div>
          )}

          {/* Reset View Button - Always visible */}
          {onResetView && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <button
                onClick={() => {
                  setIsResetting(true);
                  onResetView();
                  // Reset animation after delay
                  setTimeout(() => setIsResetting(false), 800);
                }}
                disabled={isResetting}
                className={`w-full py-2 px-3 text-[11px] font-medium border rounded transition-all flex items-center justify-center gap-2 ${
                  isResetting 
                    ? 'text-blue-300 bg-blue-600/30 border-blue-500/50 cursor-wait' 
                    : 'text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 border-slate-600/50'
                }`}
              >
                <svg 
                  className={`w-3.5 h-3.5 transition-transform ${isResetting ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isResetting ? t('buttons.resetting') : t('buttons.resetView')}
              </button>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Import Archive Tooltip */}
      <InfoTooltip isOpen={showImportTooltip} onClose={() => setShowImportTooltip(false)}>
        <h3 className="text-lg font-semibold text-white mb-2">{t('tooltips.importArchive.title')}</h3>
        <p className="text-sm text-slate-300">{t('tooltips.importArchive.description')}</p>
      </InfoTooltip>

      {/* Connect Platform Tooltip */}
      <InfoTooltip isOpen={showConnectTooltip} onClose={() => setShowConnectTooltip(false)}>
        <h3 className="text-lg font-semibold text-white mb-2">{t('tooltips.connectPlatform.title')}</h3>
        <p className="text-sm text-slate-300">{t('tooltips.connectPlatform.description')}</p>
      </InfoTooltip>

      {/* Graph Methodology Tooltip */}
      <InfoTooltip isOpen={showGraphTooltip} onClose={() => setShowGraphTooltip(false)}>
        <h3 className="text-lg font-semibold text-white mb-4">{t('tooltips.graph.title')}</h3>
        
        <div className="space-y-4 text-sm">
          {/* Challenge */}
          <div>
            <h4 className="font-medium text-blue-400 mb-1">{t('tooltips.graph.sections.challenge.title')}</h4>
            <p className="text-slate-300">{t('tooltips.graph.sections.challenge.content')}</p>
          </div>

          {/* Node2Vec */}
          <div>
            <h4 className="font-medium text-emerald-400 mb-1">{t('tooltips.graph.sections.node2vec.title')}</h4>
            <p className="text-slate-300">{t('tooltips.graph.sections.node2vec.content')}</p>
          </div>

          {/* UMAP */}
          <div>
            <h4 className="font-medium text-purple-400 mb-1">{t('tooltips.graph.sections.umap.title')}</h4>
            <p className="text-slate-400 text-xs mb-1">{t('tooltips.graph.sections.umap.subtitle')}</p>
            <p className="text-slate-300 mb-2">{t('tooltips.graph.sections.umap.content')}</p>
            <p className="text-slate-400 text-xs italic">{t('tooltips.graph.sections.umap.howItWorks')}</p>
          </div>

          {/* Result */}
          <div>
            <h4 className="font-medium text-amber-400 mb-1">{t('tooltips.graph.sections.result.title')}</h4>
            <p className="text-slate-300">{t('tooltips.graph.sections.result.content')}</p>
          </div>

          {/* Summary */}
          <div className="bg-slate-700/50 rounded p-3">
            <h4 className="font-medium text-white mb-2">{t('tooltips.graph.sections.summary.title')}</h4>
            <ul className="text-slate-300 space-y-1 text-xs">
              <li>• {t('tooltips.graph.sections.summary.points.0')}</li>
              <li>• {t('tooltips.graph.sections.summary.points.1')}</li>
              <li>• {t('tooltips.graph.sections.summary.points.2')}</li>
            </ul>
          </div>

          {/* Communities */}
          <div className="border-t border-slate-600 pt-4">
            <h4 className="font-medium text-cyan-400 mb-1">{t('tooltips.graph.sections.communities.title')}</h4>
            <p className="text-slate-400 text-xs mb-2">{t('tooltips.graph.sections.communities.subtitle')}</p>
            
            <div className="space-y-3">
              <div>
                <h5 className="text-xs font-medium text-slate-200 mb-1">{t('tooltips.graph.sections.communities.step1.title')}</h5>
                <p className="text-slate-300 text-xs">{t('tooltips.graph.sections.communities.step1.content')}</p>
                <p className="text-slate-400 text-xs mt-1">{t('tooltips.graph.sections.communities.step1.why')}</p>
              </div>
              
              <div>
                <h5 className="text-xs font-medium text-slate-200 mb-1">{t('tooltips.graph.sections.communities.step2.title')}</h5>
                <p className="text-slate-300 text-xs">{t('tooltips.graph.sections.communities.step2.content')}</p>
              </div>
            </div>
          </div>
        </div>
      </InfoTooltip>

      {/* Login Modal */}
      <ReconnectLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        invalidProviders={[]}
        noAccountsConfigured={!hasAnyPlatform}
        mastodonInstances={mastodonInstances}
        connectedServices={{
          twitter: hasTwitter,
          bluesky: hasBluesky,
          mastodon: hasMastodon,
        }}
        onLoginComplete={() => setShowLoginModal(false)}
        allowDismiss={true}
        mode={hasAnyPlatform ? 'addPlatform' : 'default'}
      />
    </>
  );
}

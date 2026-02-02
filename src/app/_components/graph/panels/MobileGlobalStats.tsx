'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Network, UserCheck, ChevronUp, ChevronDown } from 'lucide-react';

interface GlobalStats {
  users: { total: number; onboarded: number };
  connections: {
    followers: number;
    following: number;
    followedOnBluesky: number;
    followedOnMastodon: number;
  };
}

interface MobileGlobalStatsProps {
  globalStats?: GlobalStats | null;
}

export function MobileGlobalStats({ globalStats }: MobileGlobalStatsProps) {
  const t = useTranslations('dashboard.globalStats');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Don't render if no stats
  if (!globalStats) {
    return null;
  }

  const totalConnections = globalStats.connections.followers + globalStats.connections.following;
  const totalReconnections = globalStats.connections.followedOnBluesky + globalStats.connections.followedOnMastodon;

  return (
    <div 
      className="bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl overflow-hidden transition-all duration-300"
      style={{ maxHeight: isCollapsed ? '44px' : '200px' }}
    >
      {/* Header - Always visible, clickable to toggle */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="px-4 py-3 border-b border-slate-700/50 cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Network className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{t('title')}</span>
        </div>
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>
      
      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="px-4 py-3 space-y-2.5">
          {/* Total users */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-white/80">{t('totalUsers')}</span>
            </div>
            <span className="text-sm text-white font-medium tabular-nums">
              {globalStats.users.total.toLocaleString()}
            </span>
          </div>
          
          {/* Total connections */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-white/80">{t('totalConnections')}</span>
            </div>
            <span className="text-sm text-white font-medium tabular-nums">
              {totalConnections.toLocaleString()}
            </span>
          </div>
          
          {/* Total reconnections */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-white/80">{t('totalReconnections')}</span>
            </div>
            <span className="text-sm text-purple-300 font-medium tabular-nums">
              {totalReconnections.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

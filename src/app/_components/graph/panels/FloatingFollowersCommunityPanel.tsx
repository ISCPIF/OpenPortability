'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Users, ChevronUp, ChevronDown } from 'lucide-react';
import { GraphNode } from '@/lib/types/graph';

// Community labels
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

interface FloatingFollowersCommunityPanelProps {
  followerNodes: GraphNode[];
  communityColors: Record<number, string>;
  totalFollowersFromStats: number; // Total followers from stats.connections.following
}

export function FloatingFollowersCommunityPanel({
  followerNodes,
  communityColors,
  totalFollowersFromStats,
}: FloatingFollowersCommunityPanelProps) {
  const t = useTranslations('dashboard.followersPanel');
  
  // Collapsed state - default to collapsed on mobile, expanded on desktop
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Set initial collapsed state based on screen size
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setIsCollapsed(isMobile);
  }, []);

  // Calculate followers by community
  const followersByCommunity = useMemo(() => {
    const communityCount: Record<number, number> = {};
    
    followerNodes.forEach(node => {
      const community = node.community ?? 0;
      // Normalize community to 0-9 range
      const normalizedCommunity = community % 10;
      communityCount[normalizedCommunity] = (communityCount[normalizedCommunity] || 0) + 1;
    });
    
    return communityCount;
  }, [followerNodes]);

  const followersFound = followerNodes.length;

  // Don't render if no followers found
  if (followersFound === 0 || Object.keys(followersByCommunity).length === 0) {
    return null;
  }

  return (
    <div 
      className="absolute top-28 md:top-16 left-2 md:left-4 rounded-lg backdrop-blur-md border border-white/10 shadow-xl z-20 overflow-hidden transition-all duration-300"
      style={{ backgroundColor: 'rgba(10, 15, 31, 0.85)', maxWidth: '280px', minWidth: isCollapsed ? '160px' : '240px' }}
    >
      {/* Header - Always visible, clickable to toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between gap-2 p-3 md:p-4 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs md:text-sm font-semibold text-white">{t('title')}</h3>
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>
      
      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="px-4 pb-4">
      <div className="space-y-2">
        {Object.entries(followersByCommunity)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .map(([communityId, count]) => {
            const comm = parseInt(communityId);
            const countNum = count as number;
            const percentage = ((countNum / followersFound) * 100).toFixed(1);
            const label = COMMUNITY_LABELS[comm] || `Communauté ${comm}`;
            const color = communityColors[comm] || '#888888';
            
            return (
              <div key={communityId} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/80 truncate">{label}</div>
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-1.5 rounded-full" 
                      style={{ 
                        backgroundColor: color, 
                        width: `${Math.max(4, parseFloat(percentage))}%`,
                        opacity: 0.8 
                      }}
                    />
                    <span className="text-xs text-white/60 flex-shrink-0">
                      {percentage}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>
      
      <div className="mt-3 pt-2 border-t border-white/10">
        <div className="text-xs text-white/50">
          {t('foundInGraph', { count: followersFound.toLocaleString() })}
        </div>
        <div className="text-xs text-white/70 mt-1 font-medium">
          {t('openPortabilityMembers', { count: totalFollowersFromStats.toLocaleString() })}
        </div>
      </div>
        </div>
      )}
    </div>
  );
}

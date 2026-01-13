'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Users, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

interface CommunityStatWithMeta {
  community: number;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

interface FollowersCommunityStatsResponse {
  communities: CommunityStatWithMeta[];
  totalFollowersInGraph: number;
  meta: {
    labels: Record<number, string>;
    colors: Record<number, string>;
  };
}

interface MobileFollowersCommunityStatsProps {
  totalFollowersFromStats?: number;
}

export function MobileFollowersCommunityStats({
  totalFollowersFromStats = 0,
}: MobileFollowersCommunityStatsProps) {
  const t = useTranslations('dashboard.followersPanel');
  
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FollowersCommunityStatsResponse | null>(null);

  // Fetch community stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/graph/followers-community-stats');
        
        if (!response.ok) {
          throw new Error('Failed to fetch community stats');
        }
        
        const result: FollowersCommunityStatsResponse = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching follower community stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Don't render if no data or error
  if (error || (!isLoading && (!data || data.communities.length === 0))) {
    return null;
  }

  return (
    <div 
      className="bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl overflow-hidden transition-all duration-300"
      style={{ maxHeight: isCollapsed ? '44px' : '40vh' }}
    >
      {/* Header - Always visible, clickable to toggle */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="px-4 py-3 border-b border-slate-700/50 cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{t('title')}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>
      
      {/* Collapsible content with scrollbar */}
      {!isCollapsed && (
        <div className="overflow-y-auto max-h-[calc(40vh-44px)] scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
          <div className="px-3 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            ) : data && (
              <>
                <div className="space-y-2">
                  {data.communities.map(({ community, label, color, count, percentage }) => (
                    <div key={community} className="flex items-center gap-2">
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
                              width: `${Math.max(4, percentage)}%`,
                              opacity: 0.8 
                            }}
                          />
                          <span className="text-xs text-white/60 flex-shrink-0">
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 pt-2 border-t border-slate-700/50">
                  <div className="text-xs text-slate-500">
                    {t('foundInGraph', { count: data.totalFollowersInGraph.toLocaleString() })}
                  </div>
                  {totalFollowersFromStats > 0 && (
                    <div className="text-xs text-slate-400 mt-1 font-medium">
                      {t('openPortabilityMembers', { count: totalFollowersFromStats.toLocaleString() })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

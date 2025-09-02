'use client'

import React from 'react';
import { useTranslations } from 'next-intl';
import type { GraphData } from '@/lib/types/graph';
import type { GlobalStats } from '@/lib/types/stats';

interface StatsOverlayProps {
    graphData?: GraphData | null;
    userNetworkData?: any;
    showUserNetwork?: boolean;
    globalStats?: GlobalStats | null;
    globalStatsLoading?: boolean;
    className?: string;
  }

interface StatItemProps {
  label: string;
  value: string | number;
  icon?: string;
}

function StatItem({ label, value, icon }: StatItemProps) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/10 last:border-b-0">
      <span className="text-sm opacity-90 flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        {label}
      </span>
      <span className="font-bold text-green-300 text-lg">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

export function StatsOverlay({ 
  graphData, 
  userNetworkData, 
  showUserNetwork,
  className = '' ,
  globalStats,
  globalStatsLoading,     
}: StatsOverlayProps) {
  const t = useTranslations('graph');

  // Calculer les statistiques du graphe
  const stats = React.useMemo(() => {
    if (!graphData) return null;

    const nodes = graphData.nodes || [];
    const edges = graphData.edges || [];
    
    // Compter les communautés uniques
    const communities = new Set(
      nodes
        .map(node => node.community)
        .filter(community => community !== undefined && community !== null)
    );

    // Compter les reconnexions (nœuds avec isReconnected = true)
    const reconnectedNodes = nodes.filter(node => 
      node.isReconnected || (node as any).reconnected
    );

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      communities: communities.size,
      reconnections: reconnectedNodes.length,
      // Stats réseau utilisateur si disponibles
      userFollowing: userNetworkData?.stats?.totalFollowing || 0,
      userFollowers: userNetworkData?.stats?.totalFollowers || 0,
      userFoundInGraph: userNetworkData?.stats?.foundInGraph || 0,
    };
  }, [graphData, userNetworkData]);

  if (!stats) {
    return null;
  }

  return (
    <div className={`fixed top-20 md:top-24 right-4 md:right-8 z-30 ${className}`}>
      <div className="bg-blue-900/95 backdrop-blur-[20px] rounded-2xl p-6 border border-white/20 text-white min-w-[250px] shadow-2xl">
        {/* Titre */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📊</span>
          <h3 className="text-lg font-bold">
            {t('stats.title') || 'Statistiques de l\'archipel'}
          </h3>
        </div>

        {/* Statistiques principales */}
        <div className="space-y-1">
          <StatItem
            icon="🏝️"
            label={t('stats.connectedIslands') || 'Îlots connectés'}
            value={stats.totalNodes}
          />
          
          <StatItem
            icon="🌊"
            label={t('stats.activeLinks') || 'Liaisons actives'}
            value={stats.totalEdges}
          />
          
          {stats.communities > 0 && (
            <StatItem
              icon="🏘️"
              label={t('stats.communities') || 'Communautés'}
              value={stats.communities}
            />
          )}
          
          {stats.reconnections > 0 && (
            <StatItem
              icon="⚓"
              label={t('stats.successfulMigrations') || 'Migrations réussies'}
              value={stats.reconnections}
            />
          )}
        </div>

        {/* Statistiques du réseau utilisateur */}
        {showUserNetwork && userNetworkData && (
          <>
            <div className="border-t border-white/20 mt-4 pt-4">
              <div className="text-sm font-semibold mb-2 opacity-80 uppercase tracking-wider">
                🧭 {t('stats.myNetwork') || 'Mon réseau'}
              </div>
              <div className="space-y-1">
                <StatItem
                  icon="👥"
                  label={t('stats.following') || 'Abonnements'}
                  value={stats.userFollowing}
                />
                
                <StatItem
                  icon="👤"
                  label={t('stats.followers') || 'Abonnés'}
                  value={stats.userFollowers}
                />
                
                <StatItem
                  icon="🎯"
                  label={t('stats.foundInGraph') || 'Trouvés ici'}
                  value={stats.userFoundInGraph}
                />
              </div>
            </div>
          </>
        )}

        {/* Statistiques globales */}
            {globalStats && (
            <>
                <StatItem 
                label={t('stats.totalUsers')} 
                value={globalStats.users.total} 
                icon="👥" 
                />
                <StatItem 
                label={t('stats.totalConnections')} 
                value={globalStats.connections.followers + globalStats.connections.following} 
                icon="🔗" 
                />
                <StatItem 
                label={t('stats.reconnections')} 
                value={globalStats.connections.withHandle} 
                icon="🌉" 
                />
            </>
            )}

        {/* Indicateur de mise à jour */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-center gap-2 text-xs opacity-60">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>{t('stats.liveUpdate') || 'Mise à jour en temps réel'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

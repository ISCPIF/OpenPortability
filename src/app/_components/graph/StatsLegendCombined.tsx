'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useGraphMode, type GraphMode } from './GraphModeProvider';
import type { GraphData } from '@/lib/types/graph';
import type { GlobalStats } from '@/lib/types/stats';
import { plex } from '@/app/fonts/plex';

interface StatsLegendCombinedProps {
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

interface LegendItemProps {
  symbol: React.ReactNode;
  label: string;
  description?: string;
}

interface Position {
  x: number;
  y: number;
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

function LegendItem({ symbol, label, description }: LegendItemProps) {
  return (
    <div className="flex items-center gap-3 mb-3 last:mb-0">
      <div className="flex-shrink-0">
        {symbol}
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium text-white">{label}</span>
        {description && (
          <p className="text-xs text-white/70 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

export function StatsLegendCombined({ 
  graphData, 
  userNetworkData, 
  showUserNetwork,
  className = '',
  globalStats,
  globalStatsLoading,     
}: StatsLegendCombinedProps) {
  const t = useTranslations('graph');
  const { 
    currentMode, 
    setMode, 
    showLabels, 
    toggleLabels, 
    resetZoom 
  } = useGraphMode();
  const [activeTab, setActiveTab] = useState<'stats' | 'legend' | 'commands'>('stats');
  
  // État pour le drag & drop
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [initialPosition, setInitialPosition] = useState<Position>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialiser la position par défaut (top-right)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const defaultX = window.innerWidth - 320 - 32; // largeur composant + marge
      const defaultY = 80; // top offset
      setPosition({ x: defaultX, y: defaultY });
    }
  }, []);

  // Gestionnaires de drag & drop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Ne pas déclencher le drag si on clique sur un bouton ou un élément interactif
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPosition(position);
    
    // Empêcher la sélection de texte pendant le drag
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const newX = Math.max(0, Math.min(window.innerWidth - 320, initialPosition.x + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - 400, initialPosition.y + deltaY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, initialPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Ajouter les event listeners globaux
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

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

  // Symboles de base pour la légende
  const baseSymbols = [
    {
      symbol: (
        <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
      ),
      label: t('legend.smallCommunity') || 'Petite communauté',
      description: t('legend.smallCommunityDesc') || 'Moins de 50 membres'
    },
    {
      symbol: (
        <div className="w-5 h-5 bg-pink-500 rounded-full"></div>
      ),
      label: t('legend.largeCommunity') || 'Grande communauté',
      description: t('legend.largeCommunityDesc') || 'Plus de 50 membres'
    },
    {
      symbol: (
        <div className="w-4 h-4 bg-green-400 rounded-sm transform rotate-45"></div>
      ),
      label: t('legend.successfulReconnection') || 'Reconnexion réussie',
      description: t('legend.reconnectionDesc') || 'Compte retrouvé sur une autre plateforme'
    },
    {
      symbol: (
        <div className="w-4 h-4 bg-slate-300 rounded-full"></div>
      ),
      label: t('legend.inactiveConnection') || 'Connexion inactive',
      description: t('legend.inactiveDesc') || 'Compte non migré ou inactif'
    }
  ];

  // Symboles spécifiques selon le mode
  const getModeSpecificSymbols = () => {
    switch (currentMode) {
      case 'connexions':
        return [
          {
            symbol: (
              <div className="w-4 h-4 bg-blue-500 rounded-full ring-2 ring-blue-300"></div>
            ),
            label: t('legend.myConnections') || 'Mes connexions',
            description: t('legend.myConnectionsDesc') || 'Comptes que vous suivez ou qui vous suivent'
          },
          {
            symbol: (
              <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
            ),
            label: t('legend.mutualConnections') || 'Connexions mutuelles',
            description: t('legend.mutualDesc') || 'Vous vous suivez mutuellement'
          }
        ];
      
      case 'migrations':
        return [
          {
            symbol: (
              <div className="w-4 h-4 bg-emerald-500 rounded-full"></div>
            ),
            label: t('legend.migratedAccounts') || 'Comptes migrés',
            description: t('legend.migratedDesc') || 'Utilisateurs ayant migré vers de nouvelles plateformes'
          },
          {
            symbol: (
              <div className="w-4 h-4 bg-orange-400 rounded-full"></div>
            ),
            label: t('legend.pendingMigration') || 'Migration en cours',
            description: t('legend.pendingDesc') || 'Migration en cours de traitement'
          }
        ];
      
      default:
        return [];
    }
  };

  const modeSpecificSymbols = getModeSpecificSymbols();

  // Modes disponibles pour les commandes
  const modes: { key: GraphMode; label: string; icon: string; color: string }[] = [
    {
      key: 'anonyme',
      label: t('modes.overview') || 'Vue d\'ensemble',
      icon: '🗺️',
      color: 'bg-pink-500'
    },
    {
      key: 'connexions',
      label: t('modes.myConnections') || 'Mes amarres',
      icon: '⚓',
      color: 'bg-green-400'
    },
    {
      key: 'migrations',
      label: t('modes.newPorts') || 'Nouveaux ports',
      icon: '🚢',
      color: 'bg-red-400'
    }
  ];

  const handleModeChange = (mode: GraphMode) => {
    setMode(mode);
  };

  if (!stats) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={`fixed z-30 ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className={`${plex.className} bg-blue-900/95 backdrop-blur-[20px] rounded-2xl border border-white/20 text-white min-w-[280px] max-w-[320px] shadow-2xl transition-all duration-200 ${
        isDragging ? 'scale-105 shadow-3xl' : 'hover:shadow-3xl'
      }`}>
        {/* Indicateur de drag */}
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white/30 rounded-full"></div>
        
        {/* Onglets */}
        <div className="flex border-b border-white/20">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 px-3 py-3 text-xs font-medium rounded-tl-2xl transition-colors ${
              activeTab === 'stats'
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              📊 {t('stats.title') || 'Stats'}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('legend')}
            className={`flex-1 px-3 py-3 text-xs font-medium transition-colors ${
              activeTab === 'legend'
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              🧭 {t('legend.title') || 'Légende'}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`flex-1 px-3 py-3 text-xs font-medium rounded-tr-2xl transition-colors ${
              activeTab === 'commands'
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              ⚙️ {t('commands') || 'Commandes'}
            </span>
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {activeTab === 'stats' && (
            <>
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
            </>
          )}
          {activeTab === 'legend' && (
            <>
              {/* Symboles de base */}
              <div className="space-y-2">
                {baseSymbols.map((item, index) => (
                  <LegendItem
                    key={`base-${index}`}
                    symbol={item.symbol}
                    label={item.label}
                    description={item.description}
                  />
                ))}
              </div>

              {/* Symboles spécifiques au mode */}
              {modeSpecificSymbols.length > 0 && (
                <>
                  <div className="border-t border-white/20 my-4"></div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">
                      {t(`legend.mode.${currentMode}`) || `Mode ${currentMode}`}
                    </div>
                    {modeSpecificSymbols.map((item, index) => (
                      <LegendItem
                        key={`mode-${index}`}
                        symbol={item.symbol}
                        label={item.label}
                        description={item.description}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Interactions */}
              <div className="border-t border-white/20 mt-4 pt-4">
                <div className="text-xs text-white/70 space-y-1">
                  <p>🖱️ {t('legend.clickDrag') || 'Cliquez-glissez pour naviguer'}</p>
                  <p>🔍 {t('legend.mouseWheel') || 'Molette pour zoomer'}</p>
                  <p>🔍 {t('legend.searchToLocate') || 'Recherchez pour localiser'}</p>
                </div>
              </div>

              {/* Indicateur de mode actuel */}
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex items-center justify-center gap-2 text-xs text-white/80">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>
                    {t('legend.currentMode') || 'Mode actuel'}: {' '}
                    <span className="font-medium capitalize">{currentMode}</span>
                  </span>
                </div>
              </div>
            </>
          )}
          {activeTab === 'commands' && (
            <>
              {/* Modes de vue */}
              <div className="mb-4">
                <div className="text-white/80 text-sm font-semibold mb-3 uppercase tracking-wider">
                  🗺️ {t('viewModes') || 'Modes de vue'}
                </div>
                <div className="flex flex-col gap-2">
                  {modes.map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => handleModeChange(mode.key)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left
                        ${currentMode === mode.key 
                          ? 'bg-pink-500 text-white shadow-lg' 
                          : 'bg-white/10 text-white hover:bg-white/20'
                        }
                      `}
                    >
                      <span 
                        className={`w-4 h-4 rounded-full flex-shrink-0 ${
                          currentMode === mode.key ? 'bg-white/30' : mode.color
                        }`}
                      ></span>
                      <span className="text-sm font-medium">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contrôles d'affichage */}
              <div className="border-t border-white/20 pt-4">
                <div className="text-white/80 text-sm font-semibold mb-3 uppercase tracking-wider">
                  ⚙️ {t('display') || 'Affichage'}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={toggleLabels}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-left"
                  >
                    <span className="text-lg">🏷️</span>
                    <span className="text-sm font-medium">
                      {showLabels ? t('hideLabels') || 'Masquer étiquettes' : t('showLabels') || 'Afficher étiquettes'}
                    </span>
                  </button>
                  
                  <button
                    onClick={resetZoom}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-left"
                  >
                    <span className="text-lg">🔍</span>
                    <span className="text-sm font-medium">
                      {t('recenter') || 'Recentrer'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Indicateur de mode actuel */}
              <div className="mt-4 pt-3 border-t border-white/20">
                <div className="flex items-center justify-center gap-2 text-xs text-white/80">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>
                    {t('legend.currentMode') || 'Mode actuel'}: {' '}
                    <span className="font-medium capitalize">{currentMode}</span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

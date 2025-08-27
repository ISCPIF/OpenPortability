'use client'

import React from 'react';
import { useTranslations } from 'next-intl';
import { useGraphMode } from './GraphModeProvider';

interface GraphLegendNewProps {
  className?: string;
}

interface LegendItemProps {
  symbol: React.ReactNode;
  label: string;
  description?: string;
}

function LegendItem({ symbol, label, description }: LegendItemProps) {
  return (
    <div className="flex items-center gap-3 mb-3 last:mb-0">
      <div className="flex-shrink-0">
        {symbol}
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

export function GraphLegendNew({ className = '' }: GraphLegendNewProps) {
  const t = useTranslations('graph');
  const { currentMode } = useGraphMode();

  // Symboles de base
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

  return (
    <div className={`fixed bottom-4 md:bottom-8 left-4 md:left-8 z-30 ${className}`}>
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-black/10 shadow-2xl max-w-[300px]">
        {/* Titre */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🧭</span>
          <h3 className="text-base font-bold text-blue-900">
            {t('legend.title') || 'Légende de navigation'}
          </h3>
        </div>

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
            <div className="border-t border-slate-200 my-4"></div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
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
        <div className="border-t border-slate-200 mt-4 pt-4">
          <div className="text-xs text-slate-500 space-y-1">
            <p>🖱️ {t('legend.clickDrag') || 'Cliquez-glissez pour naviguer'}</p>
            <p>🔍 {t('legend.mouseWheel') || 'Molette pour zoomer'}</p>
            <p>🔍 {t('legend.searchToLocate') || 'Recherchez pour localiser'}</p>
          </div>
        </div>

        {/* Indicateur de mode actuel */}
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>
              {t('legend.currentMode') || 'Mode actuel'}: {' '}
              <span className="font-medium capitalize">{currentMode}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

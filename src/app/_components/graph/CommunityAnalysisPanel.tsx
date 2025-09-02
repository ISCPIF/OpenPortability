'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CommunityAnalysis } from './types';

interface CommunityAnalysisPanelProps {
  communityAnalysis?: CommunityAnalysis[];
  selectedCommunity?: number | null;
  onSelectCommunity: (communityId: number | null) => void;
}

export default function CommunityAnalysisPanel({
  communityAnalysis,
  selectedCommunity,
  onSelectCommunity
}: CommunityAnalysisPanelProps) {
  const t = useTranslations('graph');
  
  if (!communityAnalysis || communityAnalysis.length === 0) {
    return null;
  }

  const selectedData = selectedCommunity !== null && selectedCommunity !== undefined
    ? communityAnalysis.find(c => c.community_id === selectedCommunity)
    : null;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        {t('communityAnalysis.title')}
      </h3>
      
      {/* Sélecteur de communautés */}
      <div className="mb-4">
        <label htmlFor="community-selector" className="block text-sm font-medium text-gray-700 mb-1">
          {t('communityAnalysis.selectCommunity')}
        </label>
        <select
          id="community-selector"
          className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          value={selectedCommunity || ''}
          onChange={(e) => onSelectCommunity(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t('communityAnalysis.allCommunities')}</option>
          {communityAnalysis.map((community) => (
            <option key={community.community_id} value={community.community_id}>
              {community.label} ({community.size} {t('communityAnalysis.members')})
            </option>
          ))}
        </select>
      </div>

      {/* Affichage des métriques globales si aucune communauté n'est sélectionnée */}
      {!selectedData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <h4 className="font-medium text-gray-700 mb-2">{t('communityAnalysis.platformDistribution')}</h4>
            <div className="space-y-2">
              {communityAnalysis.map((community) => (
                <div key={community.community_id} className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: getCommunityColor(community.community_id) }}
                  />
                  <span className="text-sm">{community.label}</span>
                  <div className="ml-auto flex space-x-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      {community.bluesky_percentage}% Bluesky
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                      {community.mastodon_percentage}% Mastodon
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <h4 className="font-medium text-gray-700 mb-2">{t('communityAnalysis.migrationTiming')}</h4>
            <div className="space-y-2">
              {communityAnalysis.map((community) => (
                <div key={community.community_id} className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: getCommunityColor(community.community_id) }}
                  />
                  <span className="text-sm">{community.label}</span>
                  <div className="ml-auto">
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      {community.early_adopters_percentage}% {t('communityAnalysis.earlyAdopters')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Affichage détaillé d'une communauté spécifique */}
      {selectedData && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-3">{selectedData.label}</h4>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-sm text-gray-500">{t('communityAnalysis.size')}</p>
                <p className="text-lg font-semibold">{selectedData.size} {t('communityAnalysis.members')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('communityAnalysis.cohesion')}</p>
                <p className="text-lg font-semibold">{selectedData.cohesion_level}%</p>
              </div>
            </div>

            <h5 className="font-medium text-gray-700 mb-2">{t('communityAnalysis.platformChoice')}</h5>
            <div className="flex space-x-1 mb-4">
              <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${selectedData.bluesky_percentage}%` }}
                />
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full" 
                  style={{ width: `${selectedData.mastodon_percentage}%` }}
                />
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full" 
                  style={{ width: `${selectedData.multi_platform_percentage}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Bluesky: {selectedData.bluesky_percentage}%</span>
              <span>Mastodon: {selectedData.mastodon_percentage}%</span>
              <span>Multi-plateforme: {selectedData.multi_platform_percentage}%</span>
            </div>

            <h5 className="font-medium text-gray-700 mt-4 mb-2">{t('communityAnalysis.migrationPattern')}</h5>
            <div className="p-3 bg-white rounded border border-gray-200">
              <p className="text-sm">{t(`communityAnalysis.patterns.${selectedData.dominant_migration_pattern}`)}</p>
            </div>

            <h5 className="font-medium text-gray-700 mt-4 mb-2">{t('communityAnalysis.keyMetrics')}</h5>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(selectedData.key_metrics).map(([key, value]) => (
                <div key={key} className="bg-white p-2 rounded border border-gray-200">
                  <p className="text-xs text-gray-500">{t(`communityAnalysis.metrics.${key}`)}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fonction utilitaire pour générer des couleurs cohérentes pour les communautés
function getCommunityColor(communityId: number): string {
  const colors = [
    '#d6356f', // Rose (couleur principale)
    '#6366f1', // Indigo
    '#10b981', // Émeraude
    '#f59e0b', // Ambre
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
    '#ef4444', // Rouge
    '#3b82f6', // Bleu
    '#84cc16', // Lime
  ];
  
  return colors[communityId % colors.length];
}

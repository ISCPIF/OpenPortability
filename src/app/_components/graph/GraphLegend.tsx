'use client';

import { useState } from 'react';
import { useTranslations } from 'use-intl';

interface GraphLegendProps {
  communities: Community[];
  totalNodes: number;
  selectedCommunity: number | null;
  onCommunitySelect: (id: number | null) => void;
}

export default function GraphLegend({
  communities,
  totalNodes,
  selectedCommunity,
  onCommunitySelect
}: GraphLegendProps) {
  const t = useTranslations('graph');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* En-tête simplifié */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
        <h3 className="font-semibold text-gray-900">
          Communautés ({communities.length})
        </h3>
      </div>

      {/* Stats rapides */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Nœuds total</span>
          <span className="font-semibold">{totalNodes}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Communautés</span>
          <span className="font-semibold">{communities.length}</span>
        </div>
      </div>

      {/* Liste des communautés - version simplifiée */}
      <div className="space-y-2">
        {communities.map((community) => (
          <button
            key={community.id}
            onClick={() => onCommunitySelect(
              selectedCommunity === community.id ? null : community.id
            )}
            className={`w-full p-3 rounded-lg border transition-all ${
              selectedCommunity === community.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: community.color }}
              />
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900">
                  Communauté {community.id}
                </div>
                <div className="text-sm text-gray-600">
                  {community.size} membres
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Instructions simplifiées */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-800">
          💡 <strong>Conseil :</strong> Cliquez sur une communauté pour la mettre en évidence
        </p>
      </div>
    </div>
  );
}
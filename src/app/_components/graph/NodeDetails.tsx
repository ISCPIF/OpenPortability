'use client';

import { useTranslations } from 'next-intl';
import { GraphNode } from './types';

interface NodeDetailsProps {
  node: GraphNode;
}

export default function NodeDetails({ node }: NodeDetailsProps) {
  const t = useTranslations('graph');
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{t('nodeDetails')}</h3>
        <p className="text-sm text-gray-500">Informations détaillées</p>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Node Info */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Identifiant</span>
              <span className="font-semibold text-gray-800 truncate ml-2">{node.label || node.id}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Type</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {t(`type.${node.type}`)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Connexions</span>
              <span className="font-bold text-2xl text-blue-600">{node.connection_count}</span>
            </div>
            
            {node.community !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Communauté</span>
                <div className="flex items-center">
                  <span 
                    className="w-4 h-4 rounded-full mr-2"
                    style={{ backgroundColor: node.color }}
                  ></span>
                  <span className="font-semibold text-gray-800">C{node.community + 1}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Actions */}
        {node.type !== 'user' && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700">Actions</h4>
            <a 
              href={`https://twitter.com/i/user/${node.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
              {t('viewOnTwitter')}
            </a>
          </div>
        )}
        
        {/* Additional Info */}
        <div className="bg-gray-50 rounded-2xl p-4">
          <h4 className="font-semibold text-gray-700 mb-3">Informations techniques</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Position X:</span>
              <span className="font-mono">{node.x?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Position Y:</span>
              <span className="font-mono">{node.y?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Taille:</span>
              <span className="font-mono">{node.size || 'Auto'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
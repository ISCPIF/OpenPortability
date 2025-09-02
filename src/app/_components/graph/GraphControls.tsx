'use client';

import { useTranslations } from 'next-intl';
import { ConnectionType } from './types';

interface GraphControlsProps {
  connectionType: ConnectionType;
  limit: number;
  onTypeChange: (type: ConnectionType) => void;
  onLimitChange: (limit: number) => void;
}

export default function GraphControls({ 
  connectionType, 
  limit, 
  onTypeChange, 
  onLimitChange 
}: GraphControlsProps) {
  const t = useTranslations('graph');
  
  const connectionTypes: ConnectionType[] = ['both', 'followers', 'following'];
  const limitOptions = [50, 100, 200, 500];
  
  return (
    <div className="flex flex-wrap gap-6 items-center">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 rounded-xl">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
          </div>
          <span className="font-semibold text-gray-700">{t('showConnections')}</span>
        </div>
        
        <div className="flex gap-2">
          {connectionTypes.map((type) => (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                connectionType === type
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(type)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-green-500/10 rounded-xl">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z"></path>
            </svg>
          </div>
          <span className="font-semibold text-gray-700">{t('limitNodes')}</span>
        </div>
        
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {limitOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
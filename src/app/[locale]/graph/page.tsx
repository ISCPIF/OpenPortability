'use client'

// src/app/[locale]/graph/page.tsx
import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

// Import dynamique avec ssr: false pour éviter le chargement côté serveur
const ConnectionGraph = dynamic(
  () => import('@/app/_components/graph/ConnectionGraph'),
  { ssr: false }
);

function LoadingSkeleton() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 animate-pulse">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin mx-auto" style={{ animationDelay: '0.3s', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-slate-600 font-medium">Construction du graphe de vos connexions...</p>
          <p className="text-slate-400 text-sm mt-2">Analyse des communautés en cours</p>
        </div>
      </div>
    </div>
  );
}

export default function GraphPage() {
  const t = useTranslations('graph');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      {/* Header avec effet glassmorphism */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative container mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              {t('title')}
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {t('description')}
            </p>
          </div>
          
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-white font-semibold">Communautés</p>
                  <p className="text-slate-300 text-sm">Détection automatique</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-white font-semibold">Interactif</p>
                  <p className="text-slate-300 text-sm">Navigation fluide</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z"></path>
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-white font-semibold">Analytics</p>
                  <p className="text-slate-300 text-sm">Insights sociaux</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main graph container */}
      <div className="container mx-auto px-6 pb-12">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="h-[80vh]">
            <Suspense fallback={<LoadingSkeleton />}>
              <ConnectionGraph />
            </Suspense>
          </div>
        </div>
        
        {/* Bottom info */}
        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            ✨ Cliquez sur un nœud pour explorer • Faites glisser pour naviguer • Zoomez avec la molette
          </p>
        </div>
      </div>
    </div>
  );
}
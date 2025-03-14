'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';

import { GlobalStats } from '@/lib/types/stats';

const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface StatsReconnexionProps {
  globalStats?: GlobalStats;
}

export default function StatsReconnexion({ globalStats }: StatsReconnexionProps) {
  const t = useTranslations('ReconnexionOptions');

  console.log("GlobalStats from StatsReconnexion ", globalStats)

  // Calculate total connections safely
  const totalConnections = globalStats ? 
    (globalStats.connections?.followers || 0) + (globalStats.connections?.following || 0) : 0;

  // Get other stats safely
  const sources = globalStats?.users?.onboarded || 0;

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
      {/* Connexions totales */}
      <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white">
        <div className="text-2xl font-bold mb-2 mt-8">
          {formatNumber(totalConnections)}
        </div>
        <div className={`${plex.className} text-sm`}>{t('stats.connections')}</div>
      </div>

      {/* Mappings Bluesky et Mastodon */}
      <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white">
        <div className="mb-4">
          <div className="text-2xl font-bold">
            {formatNumber(globalStats?.connections?.withHandleBluesky || 0)}
          </div>
          <div className={`${plex.className} text-sm`}>{t('stats.bluesky')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold">
            {formatNumber(globalStats?.connections?.withHandleMastodon || 0)}
          </div>
          <div className={`${plex.className} text-sm`}>{t('stats.mastodon')}</div>
        </div>
      </div>

      {/* Followed Stats */}
      <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white">
        <div className="mb-4">
          <div className="text-2xl font-bold">
            {formatNumber(globalStats?.connections?.followedOnBluesky || 0)}
          </div>
          <div className={`${plex.className} text-sm`}>{t('stats.followedBluesky')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold">
            {formatNumber(globalStats?.connections?.followedOnMastodon || 0)}
          </div>
          <div className={`${plex.className} text-sm`}>{t('stats.followedMastodon')}</div>
        </div>
      </div>
    </div>
  );
}
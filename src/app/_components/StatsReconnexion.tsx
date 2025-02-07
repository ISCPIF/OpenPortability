'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import BSIcon from '../../../public/newSVG/BS.svg';
import MastoIcon from '../../../public/newSVG/masto.svg';
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

  // Calculate total connections safely
  const totalConnections = globalStats ? 
    (globalStats.connections?.followers || 0) + (globalStats.connections?.following || 0) : 0;

  // Get other stats safely
  const mappings = globalStats?.connections?.withHandle || 0;
  const sources = globalStats?.users?.onboarded || 0;

  return (
    <div className="mt-12 flex justify-center space-x-12">
      {/* Connexions totales */}
      <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
        <div className="text-4xl font-bold mb-2">
          {formatNumber(totalConnections)}
        </div>
        <div className={`${plex.className} text-sm`}>{t('stats.connections')}</div>
      </div>

      {/* Mappings Bluesky */}
      <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
        <div className="text-4xl font-bold mb-2">
          {formatNumber(mappings)}
        </div>
        <div className={`${plex.className} text-sm`}>{t('stats.bluesky')}</div>
        <div className="flex justify-center gap-2 mb-2">
          <Image src={BSIcon} alt="Bluesky" width={24} height={24} />
          <Image src={MastoIcon} alt="Mastodon" width={24} height={24} />
        </div>
      </div>

      {/* Sources */}
      <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
        <div className="text-4xl font-bold mb-2">
          {formatNumber(sources)}
        </div>
        <div className={`${plex.className} text-sm`}>{t('stats.networks')}</div>
      </div>
    </div>
  );
}
'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import BSIcon from '../../../public/newSVG/BS.svg';
import MastoIcon from '../../../public/newSVG/masto.svg';

interface ReconnexionOptionsProps {
  matchCount: number;
  onAutomatic: () => void;
  onManual: () => void;
}

interface ReconnectionStats {
  connections: number;
  blueskyMappings: number;
  sources: number;
}

export default function ReconnexionOptions({ matchCount, onAutomatic, onManual }: ReconnexionOptionsProps) {
  const t = useTranslations('ReconnexionOptions');
  const [stats, setStats] = useState<ReconnectionStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats/reconnections');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching reconnection stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      <div className="flex w-full gap-8 relative">
        {/* Colonne gauche */}
        <div className="flex-1 flex flex-col items-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAutomatic}
            className="w-full rounded-full bg-[#FF3366] text-white py-4 px-6 font-bold hover:bg-[#FF1F59] transition-colors"
          >
            {t('buttons.automatic')}
          </motion.button>
          <p className={`${plex.className} text-sm text-white text-center mt-4`}>
            {t('descriptions.automatic')}
          </p>
        </div>

        {/* Séparateur vertical qui couvre les deux sections */}
        <div className="w-px bg-white/30 absolute left-1/2 h-full -translate-x-1/2" />

        {/* Colonne droite */}
        <div className="flex-1 flex flex-col items-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onManual}
            className="w-full rounded-full bg-white text-[#2a39a9] py-4 px-6 font-bold hover:bg-gray-50 transition-colors"
          >
            {t('buttons.manual')}
          </motion.button>
          <p className={`${plex.className} text-sm text-white text-center mt-4`}>
            {t('descriptions.manual')}
          </p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="mt-12 flex justify-center space-x-12">
        {/* Connexions totales */}
        <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
          <div className="text-4xl font-bold mb-2">{stats?.connections || 0}</div>
          <div className={`${plex.className} text-sm`}>{t('stats.connections')}</div>
        </div>

        {/* Mappings Bluesky */}
        <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
          <div className="text-4xl font-bold mb-2">{stats?.blueskyMappings || 0}</div>
          <div className={`${plex.className} text-sm`}>{t('stats.bluesky')}</div>
        </div>

        {/* Sources */}
        <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
          <div className="flex justify-center gap-2 mb-2">
            <Image src={BSIcon} alt="Bluesky" width={24} height={24} />
            <Image src={MastoIcon} alt="Mastodon" width={24} height={24} />
          </div>
          <div className="text-4xl font-bold mb-2">{stats?.sources || 0}</div>
          <div className={`${plex.className} text-sm`}>{t('stats.networks')}</div>
        </div>
      </div>
    </div>
  );
}
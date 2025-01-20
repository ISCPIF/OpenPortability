'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { motion } from 'framer-motion';
import { FaPlay } from "react-icons/fa";
import { useEffect, useState } from 'react';
import BSIcon from '../../../public/newSVG/BS.svg';
import MastoIcon from '../../../public/newSVG/masto.svg';

const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface ReconnexionOptionsProps {
  onAutomatic: () => void;
  onManual: () => void;
}

interface ReconnectionStats {
  connections: number;
  blueskyMappings: number;
  sources: number;
}

export default function ReconnexionOptions({ onAutomatic, onManual }: ReconnexionOptionsProps) {
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
      <div className="w-full bg-[#2a39a9] p-4 rounded-lg">
        <h2 className={`${plex.className} text-xl text-white font-bold mb-12 text-center`}>
          {t('title')}
        </h2>
        <div className="flex flex-col space-y-8 max-w-3xl mx-auto">
          {/* First option */}
          <div className="flex items-center gap-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAutomatic}
              className="flex-1 rounded-full bg-[#d6356f] text-white py-4 px-6 font-bold  flex items-center justify-center gap-3"
            >
              {t('buttons.automatic')}
              <FaPlay className="text-sm" />
            </motion.button>
            <div className="text-white text-2xl">›</div>
            <div className={`${plex.className} text-sm text-white text-justify flex-1`}>
              {t('descriptions.automatic')}
            </div>
          </div>

          {/* Second option */}
          <div className="flex items-center gap-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onManual}
              className="flex-1 rounded-full bg-white text-[#2a39a9] py-4 px-6 font-bold hover:bg-gray-50 transition-colors"
            >
              {t('buttons.manual')}
            </motion.button>
            <div className="text-white text-2xl">›</div>
            <div className={`${plex.className} text-sm text-white text-justify flex-1`}>
              {t('descriptions.manual')}
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="mt-12 flex justify-center space-x-12">
          {/* Connexions totales */}
          <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
            <div className="text-4xl font-bold mb-2">{stats ? formatNumber(stats.connections) : 0}</div>
            <div className={`${plex.className} text-sm`}>{t('stats.connections')}</div>
          </div>

          {/* Mappings Bluesky */}
          <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
            <div className="text-4xl font-bold mb-2">{stats ? formatNumber(stats.blueskyMappings) : 0}</div>
            <div className={`${plex.className} text-sm`}>{t('stats.bluesky')}</div>
            <div className="flex justify-center gap-2 mb-2">
              <Image src={BSIcon} alt="Bluesky" width={24} height={24} />
              <Image src={MastoIcon} alt="Mastodon" width={24} height={24} />
            </div>
          </div>

          {/* Sources */}
          <div className="bg-[#1A237E] rounded-lg p-4 text-center text-white min-w-[140px]">
            <div className="text-4xl font-bold mb-2">{stats ? formatNumber(stats.sources) : 0}</div>
            <div className={`${plex.className} text-sm`}>{t('stats.networks')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
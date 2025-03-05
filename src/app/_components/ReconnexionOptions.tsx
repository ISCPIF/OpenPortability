'use client';

import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { motion } from 'framer-motion';
import { FaPlay } from "react-icons/fa";
import { GlobalStats } from '@/lib/types/stats';
import { useRouter } from 'next/navigation';

const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface ReconnexionOptionsProps {
  onAutomatic: () => void;
  onManual: () => void;
  globalStats?: GlobalStats;
  has_onboarded?: boolean;
}

export default function ReconnexionOptions({ onAutomatic, onManual, globalStats, has_onboarded = false }: ReconnexionOptionsProps) {
  const t = useTranslations('ReconnexionOptions');
  const tt = useTranslations('dashboard');
  const router = useRouter();

  // Calculate total connections safely
  const totalConnections = globalStats ? 
    (globalStats.connections?.followers || 0) + (globalStats.connections?.following || 0) : 0;

  // Get other stats safely
  const mappings = globalStats?.connections?.withHandle || 0;
  const sources = globalStats?.users?.onboarded || 0;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4 sm:px-0">
      <div className="w-full bg-[#2a39a9] p-3 sm:p-4 rounded-lg">
        {!has_onboarded && (
          <div className="border border-[#2a39a9] rounded-lg p-4 sm:p-6 mb-4 sm:mb-8">
            <div className="text-white mb-4 sm:mb-6">
              <p className="font-bold text-center mb-2 text-sm sm:text-base">{t('not_onboarded_title')}</p>
              <p className="text-xs sm:text-sm text-justify">{t('not_onboarded_description')}</p>
            </div>
            <div className="flex justify-center p-2 sm:p-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/upload')}
                className="rounded-full bg-[#d6356f] text-white py-2 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-bold flex items-center justify-center gap-2 sm:gap-3"
              >
                {tt('importButton')}
              </motion.button>
            </div>
          </div>
        )}
        
        <h2 className={`${plex.className} text-lg sm:text-xl text-white font-bold mb-6 sm:mb-12 text-center`}>
          {t('title')}
        </h2>
        <div className="flex flex-col space-y-6 sm:space-y-8 max-w-3xl mx-auto">
          {/* First option */}
          {has_onboarded && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onAutomatic}
                  className="flex-shrink-0 sm:flex-1 rounded-full bg-[#d6356f] text-white py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-bold flex items-center justify-center gap-2 sm:gap-3"
                >
                  {t('buttons.automatic')}
                  <FaPlay className="text-xs sm:text-sm" />
                </motion.button>
                <div className="text-white text-xl sm:text-2xl hidden sm:block">›</div>
                <div className={`${plex.className} text-xs sm:text-sm text-white flex-1 text-center sm:text-left`}>
                  {t('descriptions.automatic')}
                </div>
              </div>
            )}

          {/* Second option */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onManual}
              className="flex-shrink-0 sm:flex-1 rounded-full bg-white text-[#2a39a9] py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-bold hover:bg-gray-50 transition-colors"
            >
              {t('buttons.manual')}
            </motion.button>
            <div className="text-white text-xl sm:text-2xl hidden sm:block">›</div>
            <div className={`${plex.className} text-xs sm:text-sm text-white flex-1 text-center sm:text-left`}>
              {t('descriptions.manual')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
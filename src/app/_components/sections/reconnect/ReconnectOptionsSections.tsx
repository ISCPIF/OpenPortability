import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlobalStats } from '@/lib/types/stats';

type ReconnectOptionsSectionProps = {
  onAutomatic: () => void;
  onManual: () => void;
  globalStats?: GlobalStats;
  has_onboarded?: boolean;
};

export default function ReconnectOptionsSection({
  onAutomatic,
  onManual,
  globalStats,
  has_onboarded
}: ReconnectOptionsSectionProps) {
  const t = useTranslations('migrate');

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 bg-[#2a39a9] rounded-xl border border-white/20 mb-8">
      <h2 className="text-xl sm:text-2xl font-semibold text-white text-center uppercase tracking-wider mb-4 sm:mb-6">
        {t('choose_reconnection_mode')}
      </h2>
      
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAutomatic}
          className="flex-1 bg-[#d6356f] text-white p-4 sm:p-6 rounded-xl flex flex-col items-center justify-center"
        >
          <h3 className="text-lg sm:text-xl font-semibold mb-2">{t('automatic_mode')}</h3>
          <p className="text-sm sm:text-base text-center">{t('automatic_description')}</p>
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onManual}
          className="flex-1 bg-white text-[#2a39a9] p-4 sm:p-6 rounded-xl flex flex-col items-center justify-center"
        >
          <h3 className="text-lg sm:text-xl font-semibold mb-2">{t('manual_mode')}</h3>
          <p className="text-sm sm:text-base text-center">{t('manual_description')}</p>
        </motion.button>
      </div>
      
      {globalStats && (
        <div className="mt-4 sm:mt-6 text-center text-white text-sm sm:text-base">
          <p>
            {t('total_users_reconnected', {
              count: globalStats.users?.total || 0
            })}
          </p>
        </div>
      )}
    </div>
  );
}
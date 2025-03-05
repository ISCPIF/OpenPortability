// src/app/_components/reconnect/ReconnectStatusSection.tsx
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { UserCompleteStats } from '@/lib/types/stats';
import { UserSession } from '@/lib/types/common';

type ReconnectStatusSectionProps = {
  session: UserSession;
  stats: UserCompleteStats;
  onSuccess: () => void;
};

export default function ReconnectStatusSection({
  session,
  stats,
  onSuccess
}: ReconnectStatusSectionProps) {
  const t = useTranslations('migrate');
  
  const totalReconnected = 
    (stats?.matches.bluesky.hasFollowed || 0) + 
    (stats?.matches.mastodon.hasFollowed || 0);
  
  const totalToReconnect = 
    (stats?.matches.bluesky.total || 0) + 
    (stats?.matches.mastodon.total || 0);
  
  const progressPercentage = totalToReconnect > 0 
    ? Math.round((totalReconnected / totalToReconnect) * 100) 
    : 0;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 bg-[#2a39a9] rounded-xl border border-white/20 mb-8">
      <h2 className="text-xl sm:text-2xl font-semibold text-white text-center uppercase tracking-wider mb-4 sm:mb-6">
        {t('reconnection_status')}
      </h2>
      
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="bg-white/10 p-4 rounded-lg">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-2">
            <span className="text-white font-medium">{t('reconnection_progress')}</span>
            <span className="text-white font-bold">{progressPercentage}%</span>
          </div>
          
          <div className="w-full bg-white/20 rounded-full h-2.5">
            <div 
              className="bg-[#d6356f] h-2.5 rounded-full" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          
          <div className="mt-2 text-sm text-white/80 text-center">
            {t('accounts_reconnected', { 
              reconnected: totalReconnected,
              total: totalToReconnect
            })}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/10 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Bluesky</h3>
            <div className="text-sm text-white/80">
              <div className="flex justify-between">
                <span>{t('accounts_found')}</span>
                <span>{stats?.matches.bluesky.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('accounts_followed')}</span>
                <span>{stats?.matches.bluesky.hasFollowed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('accounts_remaining')}</span>
                <span>{stats?.matches.bluesky.notFollowed || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">Mastodon</h3>
            <div className="text-sm text-white/80">
              <div className="flex justify-between">
                <span>{t('accounts_found')}</span>
                <span>{stats?.matches.mastodon.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('accounts_followed')}</span>
                <span>{stats?.matches.mastodon.hasFollowed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('accounts_remaining')}</span>
                <span>{stats?.matches.mastodon.notFollowed || 0}</span>
              </div>
            </div>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSuccess}
          className="bg-[#d6356f] text-white py-2 px-4 rounded-lg font-medium self-center mt-2"
        >
          {t('refresh_stats')}
        </motion.button>
      </div>
    </div>
  );
}
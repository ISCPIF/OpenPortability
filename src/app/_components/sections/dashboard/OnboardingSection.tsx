// src/app/_components/dashboard/OnboardingSection.tsx
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { quantico } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { UserSession } from '@/lib/types/common';
import { useTheme } from '@/hooks/useTheme';
import { ArrowRight, Upload, RefreshCw, Zap } from 'lucide-react';

type OnboardingSectionProps = {
  session?: UserSession['user'];
  mastodonInstances: string[];
  setIsLoading: (loading: boolean) => void;
};

export default function OnboardingSection({ 
  session, 
  mastodonInstances, 
  setIsLoading 
}: OnboardingSectionProps) {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const { isDark } = useTheme();
    
  return (
    <div className={`${quantico.className} w-full flex flex-col gap-3`}>
      {/* Bouton pour les utilisateurs qui ont déjà onboardé */}
      {session?.has_onboarded && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          onClick={() => router.push('/reconnect')}
          className={`group w-full rounded-lg border p-4 text-left transition-all duration-200 ${
            isDark
              ? 'bg-gradient-to-r from-rose-500/20 to-rose-600/10 border-rose-500/30 hover:border-rose-400/50'
              : 'bg-gradient-to-r from-rose-50 to-rose-100/50 border-rose-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isDark ? 'bg-rose-500/30' : 'bg-rose-500/20'
            }`}>
              <RefreshCw className="h-5 w-5 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {t('continue_to_reconnect')}
              </p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('continue_to_reconnect_description')}
              </p>
            </div>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${
              isDark ? 'bg-rose-500/30' : 'bg-rose-500/20'
            }`}>
              <ArrowRight className="h-4 w-4 text-rose-400" />
            </div>
          </div>
        </motion.button>
      )}
                
      {/* No archive option - pour les utilisateurs qui ont un twitter_id mais n'ont pas onboardé */}
      {session?.twitter_id && !session?.has_onboarded && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          onClick={() => router.push('/reconnect')}
          className={`group w-full rounded-lg border p-4 text-left transition-all duration-200 ${
            isDark
              ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/50'
              : 'bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isDark ? 'bg-blue-500/30' : 'bg-blue-500/20'
            }`}>
              <Zap className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {t('no_archive_yet')}
              </p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('no_archive_description')}
              </p>
            </div>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${
              isDark ? 'bg-blue-500/30' : 'bg-blue-500/20'
            }`}>
              <ArrowRight className="h-4 w-4 text-blue-400" />
            </div>
          </div>
        </motion.button>
      )}
      
      {/* Import option - pour les utilisateurs qui n'ont pas onboardé */}
      {(!session?.has_onboarded) && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          onClick={() => router.push('/upload')}
          className={`group w-full rounded-lg border p-4 text-left transition-all duration-200 ${
            isDark
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-600/10 border-amber-500/30 hover:border-amber-400/50'
              : 'bg-gradient-to-r from-amber-50 to-orange-100/50 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isDark ? 'bg-amber-500/30' : 'bg-amber-500/20'
            }`}>
              <Upload className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {t('importButton')}
              </p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('import_description')}
              </p>
            </div>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${
              isDark ? 'bg-amber-500/30' : 'bg-amber-500/20'
            }`}>
              <ArrowRight className="h-4 w-4 text-amber-400" />
            </div>
          </div>
        </motion.button>
      )}
    </div>
  );
}
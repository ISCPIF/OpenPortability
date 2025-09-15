// src/app/_components/dashboard/OnboardingSection.tsx
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { UserSession } from '@/lib/types/common';

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
    
  return (
    <div className="w-full flex flex-col gap-6 mt-8 sm:mt-0 items-center justify-center">
      <div className="w-full bg-transparent p-4 sm:p-6 rounded-lg">
        <div className="flex flex-col space-y-6 sm:space-y-8 max-w-3xl mx-auto">
          {/* Bouton pour les utilisateurs qui ont déjà onboardé */}
          {session?.has_onboarded && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/reconnect')}
                className={`${plex.className} flex-shrink-0 sm:flex-1 rounded-full bg-[#d6356f] text-white py-5 sm:py-5 px-5 sm:px-6 text-sm sm:text-base font-bold hover:bg-[#c02f64] transition-colors`}
              >
                <span className="uppercase">{t('continue_to_reconnect')}</span>
              </motion.button>
              <div className="text-white text-xl sm:text-2xl hidden sm:block">›</div>
              <div className={`${plex.className} text-xs sm:text-sm text-white flex-1 text-center sm:text-left sm:text-justify`}>
                {t('continue_to_reconnect_description')}
              </div>
            </div>
          )}
                    
          {/* No archive option - pour les utilisateurs qui ont un twitter_id mais n'ont pas onboardé */}
          {session?.twitter_id && !session?.has_onboarded && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/reconnect')}
                className={`${plex.className} flex-shrink-0 sm:flex-1 rounded-full bg-white text-[#2a39a9] py-5 sm:py-5 px-5 sm:px-6 text-sm sm:text-base font-bold hover:bg-gray-50 transition-colors`}
              >
                <span className="uppercase">{t('no_archive_yet')}</span>
              </motion.button>
              <div className="text-white text-xl sm:text-2xl hidden sm:block">›</div>
              <div className={`${plex.className} text-xs sm:text-sm text-white flex-1 text-center sm:text-left sm:text-justify`}>
                {t('no_archive_description')}
              </div>
            </div>
          )}
          
          {/* Import option - pour les utilisateurs qui n'ont pas de twitter_id et n'ont pas onboardé */}
          {(!session?.has_onboarded) && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  router.push('/upload');
                }}
                className={`${plex.className} flex-shrink-0 sm:flex-1 rounded-full bg-[#d6356f] text-white py-5 sm:py-5 px-5 sm:px-6 text-sm sm:text-base font-bold flex items-center justify-center gap-2 sm:gap-3`}
              >
                {/* <Upload className="w-4 h-4 sm:w-5 sm:h-5" /> */}
                <span className="uppercase">{t('importButton')}</span>
              </motion.button>
              <div className="text-white text-xl sm:text-2xl hidden sm:block">›</div>
              <div className={`${plex.className} text-xs sm:text-sm text-white flex-1 text-center sm:text-left sm:text-justify`}>
                {t('import_description')}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
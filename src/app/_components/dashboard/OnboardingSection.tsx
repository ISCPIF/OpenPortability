// src/app/_components/dashboard/OnboardingSection.tsx
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { UserSession } from '@/lib/types/common';

type OnboardingSectionProps = {
  session: UserSession['user'];
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

  console.log("****************************************",session)
  
  return (
    <div className="w-full flex flex-col gap-4 items-center justify-center text-center">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          router.push('/upload');
        }}
        className="w-full flex items-center justify-between py-4 sm:py-6 bg-white rounded-full text-black font-medium relative overflow-hidden group"
      >
        <div className="flex text-center gap-2 mx-auto text-base sm:text-lg">
          <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
          <span>{t('importButton')}</span>
        </div>
      </motion.button>
      
      {session?.twitter_id && (
        <button
          onClick={() => router.push('/reconnect')}
          className={`mt-4 sm:mt-6 text-sm text-white text-center hover:text-[#d6356f] transition-colors ${plex.className} mb-4 sm:mb-6`}
          style={{ fontStyle: 'italic' }}
        >
          {t('no_archive_yet')}
        </button>
      )}
    </div>
  );
}
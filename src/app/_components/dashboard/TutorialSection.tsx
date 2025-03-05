// src/app/_components/dashboard/TutorialSection.tsx
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

export default function TutorialSection() {
  const params = useParams();
  const t = useTranslations('dashboard');
  
  return (
    <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4 px-4">
      <h2 className={`${plex.className} text-base sm:text-lg font-medium text-white`}>
        {t('tutorial.title')}
      </h2>
      <motion.a
        href={params.locale === 'fr' 
          ? "https://indymotion.fr/w/jLkPjkhtjaSQ9htgyu8FXR"
          : "https://indymotion.fr/w/nQZrRgP3ceQKQV3ZuDJBAZ"}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 sm:gap-3 text-indigo-200 hover:text-white transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Play className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className={`${plex.className} text-base sm:text-lg underline decoration-indigo-500`}>
          {t('tutorial.watchVideo')}
        </span>
      </motion.a>
    </div>
  );
}
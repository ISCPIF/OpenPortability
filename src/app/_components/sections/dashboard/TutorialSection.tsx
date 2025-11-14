// src/app/_components/dashboard/TutorialSection.tsx
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';

export default function TutorialSection() {
  const params = useParams();
  const t = useTranslations('dashboard');
  const { isDark } = useTheme();
  
  return (
    <div
      className={`flex flex-col items-center text-center space-y-3 sm:space-y-4 px-4 py-4 rounded-2xl transition-colors ${
        isDark
          ? 'bg-transparent'
          : 'bg-transparent backdrop-blur-sm'
      }`}
    >
      <h2
        className={`${plex.className} text-base sm:text-lg font-medium ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {t('tutorial.title')}
      </h2>
      <motion.a
        href={params.locale === 'fr' 
          ? "https://indymotion.fr/w/jLkPjkhtjaSQ9htgyu8FXR"
          : "https://indymotion.fr/w/nQZrRgP3ceQKQV3ZuDJBAZ"}
        target="_blank"
        rel="noopener noreferrer"
        className={`group inline-flex items-center gap-2 sm:gap-3 transition-colors ${
          isDark
            ? 'text-indigo-200 hover:text-white'
            : 'text-indigo-700 hover:text-indigo-900'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Play
          className={`w-4 h-4 sm:w-5 sm:h-5 ${
            isDark ? 'text-indigo-200' : 'text-indigo-700'
          }`}
        />
        <span
          className={`${plex.className} text-base sm:text-lg underline ${
            isDark ? 'decoration-indigo-500' : 'decoration-indigo-700'
          }`}
        >
          {t('tutorial.watchVideo')}
        </span>
      </motion.a>
    </div>
  );
}
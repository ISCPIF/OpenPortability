// src/app/_components/dashboard/TutorialSection.tsx
import { motion } from 'framer-motion';
import { Play, Sparkles, ArrowRight } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';

export default function TutorialSection() {
  const params = useParams();
  const t = useTranslations('dashboard.tutorial');
  const { isDark } = useTheme();
  const cardClasses = isDark
    ? 'bg-gradient-to-br from-white/10 via-white/5 to-transparent border-white/10 text-white shadow-[0_25px_45px_rgba(0,0,0,0.35)]'
    : 'bg-white/80 border-white/70 text-slate-900 shadow-[0_25px_45px_rgba(15,23,42,0.12)]';

  return (
    <div
      className={`relative rounded-2xl border p-6 sm:p-8 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_35px_65px_rgba(0,0,0,0.18)] ${cardClasses}`}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-x-8 top-0 h-px opacity-60"
          style={{ backgroundImage: 'linear-gradient(90deg, #7dd3fc, transparent)' }}
        />
        <div
          className="absolute -right-8 -bottom-10 w-48 h-48 rounded-full blur-3xl opacity-30"
          style={{
            background: isDark ? '#ff4fa8' : '#c084fc'
          }}
        />
      </div>

      <div className="relative flex-colun gap-8 md:grid-cols-[1.1fr_0.9fr]">
        {/* Video preview */}
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] opacity-80">
            <Sparkles className="h-4 w-4" />
            <span>{t('title')}</span>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30 p-5 pr-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_40%)] opacity-70" />
            <div className="relative flex flex-col gap-4 text-left">
              <div>
                <p className={`${plex.className} text-lg font-semibold`}>
                  {t('videoTitle')}
                </p>
                <p className="text-sm opacity-80">
                  {t('videoSubtitle')}
                </p>
              </div>

              <div className="flex items-center gap-6 text-xs uppercase tracking-[0.35em] opacity-70">
                <span>{t('videoDuration')}</span>
                <span>{t('videoFeatures')}</span>
              </div>

              <motion.a
                href={
                  params.locale === 'fr'
                    ? 'https://vimeo.com/1154597932'
                    : 'https://vimeo.com/1154597882'
                }
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex w-full items-center justify-between rounded-full border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur-sm"
              >
                <span>{t('watchVideo')}</span>
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <ArrowRight className="h-4 w-4" />
                </div>
              </motion.a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
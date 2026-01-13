'use client';

import { useTranslations } from 'next-intl';
import { quantico } from '@/app/fonts/plex';
import Footer from '@/app/_components/layouts/Footer';
import Header from '@/app/_components/layouts/Header';
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  const t = useTranslations('privacy_policy');
  const { isDark, colors } = useTheme();

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <main 
      className={`${quantico.className} min-h-screen flex flex-col relative`}
      style={{ backgroundColor: colors.background }}
    >
      <ParticulesBackground />
      <Header />
      
      <div className="flex-grow py-12 relative z-10">
        <motion.div 
          className="container mx-auto px-4 max-w-4xl"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <div className={`rounded-xl backdrop-blur-sm border shadow-xl p-8 md:p-12 ${
            isDark
              ? 'bg-slate-900/95 border-slate-700/50'
              : 'bg-white/90 border-slate-200'
          }`}>
            <motion.div 
              className="text-center mb-12"
              variants={itemVariants}
            >
              <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {t('title')}
              </h1>
              <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('subtitle')}
              </p>
            </motion.div>

            <motion.div 
              className="space-y-6"
              variants={itemVariants}
            >
              {t.rich('content', {
                p: (chunks) => (
                  <p className={`mb-6 text-justify leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {chunks}
                  </p>
                ),
                h2: (chunks) => (
                  <h2 className={`text-2xl font-semibold mt-12 mb-6 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {chunks}
                  </h2>
                ),
                ul: (chunks) => (
                  <ul className="list-none space-y-3 mb-6 pl-6">
                    {chunks}
                  </ul>
                ),
                li: (chunks) => (
                  <li className={`flex items-start text-justify leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    <span className={`inline-block w-2 h-2 mt-2 mr-3 rounded-full ${
                      isDark ? 'bg-rose-400' : 'bg-rose-500'
                    }`}></span>
                    {chunks}
                  </li>
                ),
                link: (chunks) => (
                  <a 
                    href={String(chunks)} 
                    className={`underline transition-all duration-300 ${
                      isDark 
                        ? 'text-rose-400 hover:text-rose-300 decoration-rose-500/30 hover:decoration-rose-400/50'
                        : 'text-rose-600 hover:text-rose-500 decoration-rose-500/30 hover:decoration-rose-500/50'
                    }`}
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </motion.div>

            <motion.div 
              className="mt-12 text-center"
              variants={itemVariants}
            >
              <Link 
                href="/auth/signin" 
                className="inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-medium text-white bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 rounded-xl shadow-lg shadow-rose-500/20 transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('backToSignIn')}
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </main>
  );
}
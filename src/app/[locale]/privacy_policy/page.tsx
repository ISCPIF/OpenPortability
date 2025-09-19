'use client';

import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import Footer from '@/app/_components/layouts/Footer';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function PrivacyPolicy() {
  const t = useTranslations('privacy_policy');

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
    <main className={`${plex.className} min-h-screen flex flex-col bg-gradient-to-br from-[#2a39a9] to-[#1f2d8a]`}>
      <div className="flex-grow py-12">
        <motion.div 
          className="container mx-auto px-4 max-w-4xl"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 md:p-12">
            <motion.div 
              className="text-center mb-12"
              variants={itemVariants}
            >
              <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200">
                {t('title')}
              </h1>
              <p className="text-slate-300 text-lg">{t('subtitle')}</p>
            </motion.div>

            <motion.div 
              className="space-y-6"
              variants={itemVariants}
            >
              {t.rich('content', {
                p: (chunks) => <p className="mb-6 text-justify leading-relaxed text-slate-100/90">{chunks}</p>,
                h2: (chunks) => (
                  <h2 className="text-2xl font-semibold mt-12 mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-white">
                    {chunks}
                  </h2>
                ),
                ul: (chunks) => (
                  <ul className="list-none space-y-3 mb-6 pl-6">
                    {chunks}
                  </ul>
                ),
                li: (chunks) => (
                  <li className="flex items-start text-justify leading-relaxed text-slate-100/90">
                    <span className="inline-block w-2 h-2 mt-2 mr-3 rounded-full bg-indigo-400"></span>
                    {chunks}
                  </li>
                ),
                link: (chunks) => (
                  <a 
                    href={String(chunks)} 
                    className="text-indigo-300 hover:text-pink-400 underline decoration-indigo-500/30 hover:decoration-pink-400/50 transition-all duration-300"
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
                className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-indigo-600/80 backdrop-blur-sm hover:bg-indigo-700/90 border border-indigo-500/30 rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 hover:scale-105"
              >
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
'use client'

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import ConnectedAccounts from './ConnectedAccounts';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { Globe } from 'lucide-react';

const Header = () => {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const t = useTranslations('header');
  const pathname = usePathname();

  const languages = [
    { code: 'fr', name: 'FR'},
    { code: 'en', name: 'EN'},
    { code: 'es', name: 'ES'},
    { code: 'it', name: 'IT'}
  ];

  const currentLocale = pathname.split('/')[1];

  const switchLanguage = (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`);
    window.location.href = newPath;
  };

  return (
    <header className="relative z-10">
      <div className="absolute inset-0 bg-transparent pointer-events-none" />

      <div className="relative">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Return to first step button - only shown on reconnect page */}
            {pathname.includes('/reconnect') && (
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 text-black "
              >
                <span>←</span>
                <span>{t('returnToFirstStep')}</span>
              </Link>
            )}

            <div className="flex items-center ml-auto">
              {/* Language Selector */}
              <div className="relative mr-6">
                <button
                  onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 transition-colors"
                >
                  <Globe className="w-5 h-5 bg-black" aria-hidden="true" />
                  <span className="text-lg text-black">
                    {languages.find(lang => lang.code === currentLocale)?.name}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-black/60 transition-transform duration-200 
                      ${isLanguageOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {isLanguageOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-40 origin-top-right"
                    >
                      <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-black/10 shadow-xl overflow-hidden">
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              switchLanguage(lang.code);
                              setIsLanguageOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-xs ${plex.className} text-white hover:bg-white/10 transition-colors text-left flex items-center gap-2
                              ${currentLocale === lang.code ? 'bg-white/5' : ''}`}
                          >
                            <span className="text-base">{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-6">
                {session && (
                  <div className="flex items-center gap-6">
                    {/* Profil avec menu déroulant */}
                    <div className="relative">
                      <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 transition-colors"
                      >
                        {session.user?.image && (
                          <Image
                            src={session.user.image}
                            alt={session.user.name || ''}
                            width={32}
                            height={32}
                            className="rounded-full border border-black/10"
                          />
                        )}
                        <div className="hidden sm:block">
                          <p className="text-sm font-medium text-black">
                            {session.user?.name}
                          </p>
                          <p className="text-xs text-black/60">
                            {t('profile.username', { username: session.user?.twitter_username })}
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-black/60 transition-transform duration-200 
                            ${isProfileOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* Menu déroulant avec ConnectedAccounts */}
                      <AnimatePresence>
                        {isProfileOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute right-0 mt-2 w-80 origin-top-right"
                          >
                            <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-black/10 shadow-xl overflow-hidden">
                              <div className="p-4">
                                <ConnectedAccounts />
                              </div>
                              <div className="border-t border-black/10">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={async () => {
                                    try {
                                      if (session?.user?.bluesky_id) {
                                        await fetch('/api/auth/bluesky', {
                                          method: 'DELETE',
                                        });
                                        await signOut({
                                          callbackUrl: '/',
                                          redirect: true
                                        });
                                      } else {
                                        await signOut({
                                          callbackUrl: '/',
                                          redirect: true
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Error signing out:', error);
                                    }
                                  }}
                                  className="w-full px-4 py-2 text-sm text-black font-medium 
                                           bg-white hover:bg-white/90 transition-colors text-left"
                                >
                                  {t('logout')}
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
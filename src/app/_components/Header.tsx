'use client'

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe, Settings, LogOut, MessageSquare, Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { useDashboardState } from '@/hooks/useDashboardState';

const Header = () => {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const t = useTranslations('header');
  const pathname = usePathname();
  
  // N'utilise useDashboardState que si on n'est pas sur la page signin
  const isSignInPage = pathname.includes('/auth/signin');
  const dashboardState = !isSignInPage ? useDashboardState() : null;
  const showBlueSkyDMNotification = dashboardState?.showBlueSkyDMNotification || false;

  const languages = [
    { code: 'fr', name: 'FR'},
    { code: 'en', name: 'EN'},
    { code: 'es', name: 'ES'},
    { code: 'it', name: 'IT'},
    { code: 'de', name: 'DE'},
    { code: 'sv', name: 'SV'},
    { code: 'pt', name: 'PT'},
  ];

  const currentLocale = pathname.split('/')[1];

  const switchLanguage = async (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`);
    
    // Si l'utilisateur est connecté, sauvegarder la préférence
    if (session?.user?.id) {
      try {
        await fetch('/api/users/language', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language: locale }),
        });
      } catch (error) {
        console.error('Error saving language preference:', error);
      }
    }
    
    window.location.href = newPath;
  };

  return (
    <header className="relative z-10">
      <div className="absolute inset-0 bg-transparent pointer-events-none" />

      <div className="relative">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Return to first step button - only shown on reconnect page
            {pathname.includes('/reconnect') && (
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 text-black "
              >
                <span>←</span>
                <span>{t('returnToFirstStep')}</span>
              </Link>
            )} */}

            <div className="flex items-center ml-auto">
              {/* Language Selector */}
              <div className="relative mr-6">
                <button
                  onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 transition-colors"
                >
                  <Globe className="w-5 h-5 text-white" aria-hidden="true" />
                  <span className="text-lg text-white">
                    {languages.find(lang => lang.code === currentLocale)?.name}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-white/60 transition-transform duration-200 
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
                    {/* Notification pour tester les DMs Bluesky */}

                    {/* Profil avec menu déroulant */}
                    <div className="relative">
                      <div className="flex items-center gap-3">
                        <div className="p-2">
                          <div className="hidden sm:block">
                            <p className="text-sm font-medium text-white">
                              {session.user?.name}
                            </p>
                            <p className="text-xs text-white/60">
                              {t('profile.username', { username: session.user?.twitter_username })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Link
                            href="/settings"
                            className="group p-2 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2"
                            title={t('settings')}
                            aria-label={t('settings')}
                          >
                            <Settings className="w-5 h-5 text-white" />
                            <span className="hidden group-hover:block text-sm text-white">{t('settings')}</span>
                          </Link>

                          {/* {showBlueSkyDMNotification && (
                            <Link
                              href="/settings?highlight=bluesky_dm"
                              className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                              title={t('notifications.testBlueSkyDM')}
                              aria-label={t('notifications.testBlueSkyDM')}
                            >
                              <div className="relative">
                                <MessageSquare className="w-5 h-5 text-white" />
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d6356f] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#d6356f]"></span>
                                </span>
                              </div>
                            </Link>
                          )} */}
                          <button
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
                            className="group p-2 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2"
                            title={t('logout')}
                            aria-label={t('logout')}
                          >

                  
                            <LogOut className="w-5 h-5 text-white" />
                            <span className="hidden group-hover:block text-sm text-white">{t('logout')}</span>
                          </button>
                        </div>
                      </div>
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
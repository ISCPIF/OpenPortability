'use client'

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe, Settings, LogOut, MessageSquare, Bell, Home, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { useDashboardState } from '@/hooks/useDashboardState';

const UnauthenticatedHeader = () => {
  const t = useTranslations('header');
  const pathname = usePathname();
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const currentLocale = pathname.split('/')[1];

  const languages = [
    { code: 'fr', name: 'FR'},
    { code: 'en', name: 'EN'},
    { code: 'es', name: 'ES'},
    { code: 'it', name: 'IT'},
    { code: 'de', name: 'DE'},
    { code: 'sv', name: 'SV'},
    { code: 'pt', name: 'PT'},
  ];

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
            <div className="flex items-center ml-auto">
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
                            onClick={() => switchLanguage(lang.code)}
                            className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors text-left"
                          >
                            {lang.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const AuthenticatedHeader = () => {
  const { data: session, status } = useSession();
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const t = useTranslations('header');
  const pathname = usePathname();
  const hasCheckedLanguage = useRef(false);

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

  // Vérifier et sauvegarder la langue à la connexion
  useEffect(() => {
    const checkAndSaveLanguage = async () => {
      // Vérifier si on a déjà une langue stockée pour cet utilisateur
      const storedLanguage = localStorage.getItem(`user_language_${session?.user?.id}`);
      
      if (session?.user?.id && !storedLanguage) {
        try {
          // Vérifier si une préférence existe déjà
          const response = await fetch('/api/users/language');
          const data = await response.json();
          
          const languageToStore = data.language || currentLocale;
          
          // Si pas de préférence, sauvegarder la langue actuelle
          if (!data.language) {
            await fetch('/api/users/language', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ language: currentLocale }),
            });
          }
          
          // Stocker la langue pour cet utilisateur
          localStorage.setItem(`user_language_${session.user.id}`, languageToStore);
        } catch (error) {
          console.error('Error checking/saving language preference:', error);
        }
      }
    };

    checkAndSaveLanguage();
  }, [session?.user?.id, currentLocale]);

  const switchLanguage = async (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`);
    
    if (session?.user?.id) {
      try {
        await fetch('/api/users/language', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language: locale }),
        });
        // Mettre à jour le localStorage avec la nouvelle langue
        localStorage.setItem(`user_language_${session.user.id}`, locale);
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
              <div className="relative mr-2">
                <button
                  onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 transition-colors"
                >
                  <Globe className={`w-5 h-5 ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`} aria-hidden="true" />
                  <span className={`text-lg ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`}>
                    {languages.find(lang => lang.code === currentLocale)?.name}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 
                      ${isLanguageOpen ? 'rotate-180' : ''} 
                      ${pathname.includes('/reconnect') ? 'text-gray-800/60' : 'text-white/60'}`}
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
                      <div className={`${pathname.includes('/reconnect') ? 'bg-white/90' : 'bg-black/40'} backdrop-blur-xl rounded-xl border border-black/10 shadow-xl overflow-hidden`}>
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              switchLanguage(lang.code);
                              setIsLanguageOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-xs ${plex.className} ${pathname.includes('/reconnect') ? 'text-gray-800 hover:bg-gray-100' : 'text-white hover:bg-white/10'} transition-colors text-left flex items-center gap-2
                              ${currentLocale === lang.code ? pathname.includes('/reconnect') ? 'bg-gray-50' : 'bg-white/5' : ''}`}
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
                      <div className="flex items-center gap-3">

                      {pathname.includes('/settings') ? (
                            <Link
                              href="/dashboard"
                              className="group p-2 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2"
                              title={t('returnToDashboard')}
                              aria-label={t('returnToDashboard')}
                            >
                              <Home className={`w-5 h-5 ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`} />
                              <span className={`hidden group-hover:block text-sm ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`}>{t('returnToDashboard')}</span>
                            </Link>
                          ) : (
                            <Link
                              href="/settings"
                              className="group p-2 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2"
                              title={t('settings')}
                              aria-label={t('settings')}
                            >
                              <Settings className={`w-5 h-5 ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`} />
                              <span className={`hidden group-hover:block text-sm ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`}>{t('settings')}</span>
                            </Link>
                          )}
                        <div className="p-2">
                          <div className="hidden sm:block">
                            <p className={`text-xs ${pathname.includes('/reconnect') ? 'text-gray-600' : 'text-white/60'}`}>
                              {t('profile.username', { username: session.user?.twitter_username || session.user?.bluesky_username || session.user?.mastodon_username })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
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

                  
                            <LogOut className={`w-5 h-5 ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`} />
                            <span className={`hidden group-hover:block text-sm ${pathname.includes('/reconnect') ? 'text-gray-800' : 'text-white'}`}>{t('logout')}</span>
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

const Header = () => {
  const { status } = useSession();
  
  if (status === "authenticated") {
    return <AuthenticatedHeader />;
  }
  
  return <UnauthenticatedHeader />;
};

export default Header;
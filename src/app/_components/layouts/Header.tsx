'use client'

import { useState, useEffect } from "react";
import type React from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe, Settings, LogOut, MessageSquare, Bell, Home, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useTheme } from '@/hooks/useTheme';

// Shared helper to ensure a single in-flight language fetch across components
const ensureLanguagePreference = async (userId: string | undefined, currentLocale: string) => {
  if (!userId) return;

  const storageKey = `user_language_${userId}`;
  const existing = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
  if (existing) return existing;

  const w = typeof window !== 'undefined' ? (window as any) : {};

  if (!w.__languageFetchPromise) {
    w.__languageFetchPromise = (async () => {
      try {
        const response = await fetch('/api/users/language');
        const data = await response.json();
        const languageToStore = data.language || currentLocale;

        if (!data.language) {
          await fetch('/api/users/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: currentLocale }),
          });
        }

        return languageToStore as string;
      } catch (err) {
        console.error('Error checking/saving language preference:', err);
        return currentLocale;
      }
    })();
  }

  const lang = await w.__languageFetchPromise;
  try {
    localStorage.setItem(storageKey, lang);
  } catch {}
  return lang as string;
};

const UnauthenticatedHeader = () => {
  const t = useTranslations('header');
  const pathname = usePathname();
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const currentLocale = pathname.split('/')[1];
  const { colors, isDark } = useTheme();

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
    <header className="relative z-10" style={{ backgroundColor: isDark ? '#0a0f1f' : colors.background, color: isDark ? '#ffffff' : colors.text }}>
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
                  <Globe className="w-5 h-5" style={{ color: isDark ? '#ffffff' : colors.text }} aria-hidden="true" />
                  <span className="text-lg" style={{ color: isDark ? '#ffffff' : colors.text }}>
                    {languages.find(lang => lang.code === currentLocale)?.name}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 
                      ${isLanguageOpen ? 'rotate-180' : ''}`}
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : `${colors.text}99` }}
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
                      <div 
                        className="backdrop-blur-xl rounded-xl border shadow-xl overflow-hidden"
                        style={{
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.9)',
                          borderColor: isDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => switchLanguage(lang.code)}
                            className="w-full px-4 py-2 text-sm text-left transition-colors"
                            style={{
                              color: isDark ? '#ffffff' : colors.text,
                              backgroundColor: isDark ? 'transparent' : 'transparent'
                            }}
                            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
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
  const currentLocale = pathname.split('/')[1];
  const { colors, isDark } = useTheme();

  const languages = [
    { code: 'fr', name: 'FR'},
    { code: 'en', name: 'EN'},
    { code: 'es', name: 'ES'},
    { code: 'it', name: 'IT'},
    { code: 'de', name: 'DE'},
    { code: 'sv', name: 'SV'},
    { code: 'pt', name: 'PT'},
  ];

  const username =
    session?.user?.twitter_username ??
    session?.user?.bluesky_username ??
    session?.user?.mastodon_username ??
    '';

  useEffect(() => {
    ensureLanguagePreference(session?.user?.id, currentLocale);
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
    <header className="relative z-10" style={{ backgroundColor: isDark ? '#0a0f1f' : colors.background, color: isDark ? '#ffffff' : colors.text }}>
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
                  <Globe className="w-5 h-5" aria-hidden="true" style={{ color: isDark ? '#ffffff' : colors.text }} />
                  <span className="text-lg" style={{ color: isDark ? '#ffffff' : colors.text }}>
                    {languages.find(lang => lang.code === currentLocale)?.name}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${isLanguageOpen ? 'rotate-180' : ''}`}
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : `${colors.text}99` }}
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
                      <div 
                        className="backdrop-blur-xl rounded-xl border shadow-xl overflow-hidden"
                        style={{
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.9)',
                          borderColor: isDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => {
                              switchLanguage(lang.code);
                              setIsLanguageOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-xs ${plex.className} transition-colors text-left flex items-center gap-2`}
                            style={{
                              color: isDark ? '#ffffff' : colors.text,
                              backgroundColor: currentLocale === lang.code
                                ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                                : 'transparent'
                            }}
                            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.currentTarget.style.backgroundColor = currentLocale === lang.code
                                ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                                : 'transparent';
                            }}
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
                              <Home className="w-5 h-5" style={{ color: isDark ? '#ffffff' : colors.text }} />
                              <span className="hidden group-hover:block text-sm" style={{ color: isDark ? '#ffffff' : colors.text }}>{t('returnToDashboard')}</span>
                            </Link>
                          ) : (
                            <Link
                              href="/settings"
                              className="group p-2 rounded-lg hover:bg-black/5 transition-colors flex items-center gap-2"
                              title={t('settings')}
                              aria-label={t('settings')}
                            >
                              <Settings className="w-5 h-5" style={{ color: isDark ? '#ffffff' : colors.text }} />
                              <span className="hidden group-hover:block text-sm" style={{ color: isDark ? '#ffffff' : colors.text }}>{t('settings')}</span>
                            </Link>
                          )}
                        <div className="p-2">
                          <div className="hidden sm:block">
                            <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : `${colors.text}99` }}>
                              {t('profile.username', { username })}
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

                  
                            <LogOut className="w-5 h-5" style={{ color: isDark ? '#ffffff' : colors.text }} />
                            <span className="hidden group-hover:block text-sm" style={{ color: isDark ? '#ffffff' : colors.text }}>{t('logout')}</span>
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
'use client'

import { useState, useEffect } from "react";
import type React from 'react';
import { useSession } from "next-auth/react";
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe, Settings, Home, Map } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useTheme } from '@/hooks/useTheme';
import { useCommunityColors } from '@/hooks/useCommunityColors';

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
  const { colors: communityColors } = useCommunityColors();
  
  // Use community colors for accents
  const accentColor = communityColors[7] || '#c0b84f';

  const languages = [
    { code: 'fr', name: 'FR'},
    { code: 'en', name: 'EN'},
    { code: 'es', name: 'ES'},
    { code: 'it', name: 'IT'},
    { code: 'de', name: 'DE'},
    { code: 'sv', name: 'SV'},
    { code: 'pt', name: 'PT'},
  ];

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

  // Sur /reconnect, le header est fixed en haut
  const isReconnectPage = pathname.includes('/reconnect');
  const isUploadPage = pathname.includes('/upload');
  const isLargeFilePage = pathname.includes('/large-file');
  const isSettingsPage = pathname.includes('/settings');
  const isDashboardPage = pathname.includes('/dashboard');

  // Get user info for button visibility logic
  const user = session?.user as { 
    has_onboarded?: boolean; 
    twitter_id?: string | null; 
    bluesky_id?: string | null; 
    mastodon_id?: string | null; 
  } | undefined;
  
  // Count connected accounts
  const connectedAccounts = [
    user?.twitter_id,
    user?.bluesky_id,
    user?.mastodon_id,
  ].filter(Boolean).length;

  // Button visibility rules:
  // - Reconnect: visible except on /reconnect, /upload, /large-file
  // - Settings: visible except on /settings
  // - Dashboard: visible if connectedAccounts === 1 OR has_onboarded === false
  const showReconnectButton = !isReconnectPage && !isUploadPage && !isLargeFilePage;
  const showSettingsButton = !isSettingsPage;
  const showDashboardButton = !isReconnectPage && !isDashboardPage && (connectedAccounts === 1 || user?.has_onboarded === false);

  return (
    <header 
      className={`z-[100] px-4 py-2 border-b ${isReconnectPage ? 'fixed top-0 left-0 right-0' : 'relative'}`}
      style={{ 
        backgroundColor: isDark ? 'rgba(10, 15, 31, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        borderColor: isDark ? `${accentColor}26` : 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto gap-2">
        {/* Language Selector - Left side, Hidden on /reconnect page */}
        {!pathname.includes('/reconnect') && (
        <div className="relative">
          <button
            onClick={() => setIsLanguageOpen(!isLanguageOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 border rounded transition-all duration-200"
            style={{
              backgroundColor: isDark ? `${accentColor}0d` : 'rgba(0, 0, 0, 0.02)',
              borderColor: isLanguageOpen 
                ? (isDark ? '#ffffff' : colors.text) 
                : (isDark ? `${accentColor}4d` : 'rgba(0, 0, 0, 0.1)'),
              color: isDark ? '#ffffff' : colors.text,
              fontFamily: 'monospace',
              fontSize: '12px',
              boxShadow: isLanguageOpen ? `0 0 10px ${accentColor}4d` : 'none',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (!isLanguageOpen) {
                e.currentTarget.style.borderColor = isDark ? `${accentColor}80` : 'rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (!isLanguageOpen) {
                e.currentTarget.style.borderColor = isDark ? `${accentColor}4d` : 'rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{languages.find(lang => lang.code === currentLocale)?.name}</span>
            <ChevronDown 
              className="w-3 h-3 transition-transform duration-200"
              style={{ transform: isLanguageOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          <AnimatePresence>
            {isLanguageOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-32 origin-top-right z-50"
              >
                <div 
                  className="border rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: isDark ? 'rgba(10, 15, 31, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark ? `0 4px 20px ${accentColor}33` : '0 4px 20px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        switchLanguage(lang.code);
                        setIsLanguageOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left transition-all duration-200 border-b last:border-b-0"
                      style={{
                        backgroundColor: currentLocale === lang.code 
                          ? (isDark ? `${accentColor}1a` : 'rgba(0, 0, 0, 0.05)')
                          : 'transparent',
                        borderColor: isDark ? `${accentColor}1a` : 'rgba(0, 0, 0, 0.05)',
                        color: currentLocale === lang.code 
                          ? (isDark ? '#ffffff' : colors.text)
                          : (isDark ? 'rgba(255, 255, 255, 0.7)' : `${colors.text}99`),
                        fontFamily: 'monospace',
                        fontSize: '12px',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                        if (currentLocale !== lang.code) {
                          e.currentTarget.style.backgroundColor = isDark ? `${accentColor}0d` : 'rgba(0, 0, 0, 0.03)';
                        }
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                        if (currentLocale !== lang.code) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
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
        )}

        {/* Navigation icons with labels - Right side */}
        {session && (
          <div className={`flex items-center gap-3 ${isReconnectPage ? 'ml-auto' : ''}`}>
            {showReconnectButton && (
              <Link
                href="/reconnect"
                className="flex items-center gap-1.5 px-2.5 py-1 border rounded transition-all duration-200"
                style={{
                  backgroundColor: isDark ? `${accentColor}0d` : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : colors.text,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderColor = isDark ? accentColor : colors.text;
                  e.currentTarget.style.boxShadow = `0 0 10px ${accentColor}4d`;
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderColor = isDark ? `${accentColor}4d` : 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Map className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('reconnect')}</span>
              </Link>
            )}
            {showDashboardButton && (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-2.5 py-1 border rounded transition-all duration-200"
                style={{
                  backgroundColor: isDark ? `${accentColor}0d` : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : colors.text,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderColor = isDark ? accentColor : colors.text;
                  e.currentTarget.style.boxShadow = `0 0 10px ${accentColor}4d`;
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderColor = isDark ? `${accentColor}4d` : 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('returnToDashboard')}</span>
              </Link>
            )}
            {showSettingsButton && (
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-2.5 py-1 border rounded transition-all duration-200"
                style={{
                  backgroundColor: isDark ? `${accentColor}0d` : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : colors.text,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderColor = isDark ? accentColor : colors.text;
                  e.currentTarget.style.boxShadow = `0 0 10px ${accentColor}4d`;
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.borderColor = isDark ? `${accentColor}4d` : 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('settings')}</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Subtle bottom glow */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: isDark 
            ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent)',
        }}
      />
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
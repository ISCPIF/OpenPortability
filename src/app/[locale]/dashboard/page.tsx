'use client'

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';

import { Upload, Link, ChevronDown, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import DashboardLoginButtons from '@/app/_components/logins/DashboardLoginButtons';
import { useDashboardState } from '@/hooks/useDashboardState';
import NewsletterSection from '@/app/_components/sections/dashboard/NewsletterSection';
import NewsLetterFirstSeen from '@/app/_components/modales/NewsLetterFirstSeen';
import { TestCModale } from '@/app/_components/modales/TestCModale';
import OnboardingSection from '@/app/_components/sections/dashboard/OnboardingSection';
import TutorialSection from '@/app/_components/sections/dashboard/TutorialSection';
import { useTheme } from '@/hooks/useTheme';
import { quantico } from '@/app/fonts/plex';
import logoBlanc from "@/../public/logo/logo-openport-blanc.svg";
import logoRose from "@/../public/logos/logo-openport-rose.svg";

export default function DashboardPage() {
  const {
    session,
    update,
    stats,
    globalStats,
    mastodonInstances,
    newsletterData,
    isLoading,
    setIsLoading,
    showNewsletterModal,
    setShowNewsletterModal,
    progress,
    hasMastodon,
    hasBluesky,
    hasTwitter,
    hasOnboarded,
    connectedServicesCount
  } = useDashboardState();

  const [isNewsletterFirstSeenOpen, setIsNewsletterFirstSeenOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true);
  // Login section open by default if less than 2 accounts connected
  const [isLoginOpen, setIsLoginOpen] = useState(true);
  // Upload section open by default if 2+ accounts connected
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Adjust open states based on connected services count
  useEffect(() => {
    if (connectedServicesCount >= 2) {
      // 2+ accounts connected: open Upload, close Login
      setIsUploadOpen(true);
      setIsLoginOpen(false);
    } else {
      // Less than 2 accounts: open Login, close Upload
      setIsLoginOpen(true);
      setIsUploadOpen(false);
    }
  }, [connectedServicesCount]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isTestModalStrictOpen, setIsTestModalStrictOpen] = useState(false);
  const heroMaskRef = useRef<HTMLDivElement>(null);
  
  const t = useTranslations('dashboard');
  const tLoaders = useTranslations('loaders');
  const { locale } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (hasOnboarded && hasMastodon && hasTwitter && hasBluesky) {
      router.push(`/${locale}/reconnect`);
    }
  }, [hasOnboarded, router, locale]);

  useEffect(() => {
    if (!session?.user) return;
    const hasSeen = !!session.user.have_seen_newsletter;
    // NewsLetterFirstSeen s'ouvre uniquement si l'utilisateur n'a jamais vu la newsletter
    // NewsletterRequest (via NewsletterSection) s'ouvre via showNewsletterModal
    setIsNewsletterFirstSeenOpen(!hasSeen);
  }, [session?.user]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const { body, documentElement } = document;
    const originalOverflow = body.style.overflow;
    const originalPaddingRight = body.style.paddingRight;

    if (isNewsletterFirstSeenOpen) {
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      body.style.overflow = originalOverflow;
      body.style.paddingRight = originalPaddingRight;
    }

    return () => {
      body.style.overflow = originalOverflow;
      body.style.paddingRight = originalPaddingRight;
    };
  }, [isNewsletterFirstSeenOpen]);

  const handleNewsletterFirstSeenOpen = (isOpen: boolean) => {
    setIsNewsletterFirstSeenOpen(isOpen);
  };

  const { isDark } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const element = heroMaskRef.current;
    if (!element) return;

    let frameId: number | null = null;

    const dispatchMaskBounds = () => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent('particules:mask-update', {
          detail: {
            id: 'dashboard',
            bounds: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
            },
          },
        })
      );
    };

    const scheduleDispatch = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => dispatchMaskBounds());
    };

    scheduleDispatch();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scheduleDispatch()) : null;
    resizeObserver?.observe(element);

    const handleResize = () => scheduleDispatch();
    const handleScroll = () => scheduleDispatch();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen relative w-full m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator msg={tLoaders('dashboard')} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Composant principal
  return (
    <div className={`${quantico.className} w-full`}>
      <div className="w-full flex flex-col items-center">
        {/* Logo */}
        <div className="mb-4 sm:mb-6">
          <Image
            src={isDark ? logoBlanc : logoRose}
            alt="OpenPort Logo"
            width={240}
            height={64}
            className="mx-auto w-[180px] sm:w-[220px] md:w-[240px] flex-shrink-0"
            priority
          />
        </div>

        <div className="w-full mt-6 space-y-4">

          <div className="flex flex-col text-center">
            <div className="max-w-3xl mx-auto w-full" ref={heroMaskRef}>
          

              {/* Section Upload Archive / Reconnect - Menu déroulant - FIRST when >= 2 accounts connected OR onboarded */}
              {(connectedServicesCount >= 2 || hasOnboarded) && (
                <div className={`mt-4 rounded-xl backdrop-blur-sm border shadow-xl overflow-hidden ${
                  isDark 
                    ? 'bg-slate-900/95 border-slate-700/50' 
                    : 'bg-white/90 border-slate-200'
                }`}>
                  {/* Header cliquable */}
                  <motion.button
                    onClick={() => setIsUploadOpen(!isUploadOpen)}
                    className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${
                      isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                        hasOnboarded 
                          ? 'bg-emerald-500/20 border-emerald-500/30' 
                          : 'bg-rose-500/20 border-rose-500/30'
                      }`}>
                        {hasOnboarded ? (
                          <Activity className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Upload className="h-5 w-5 text-rose-400" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {hasOnboarded ? 'Voir mon réseau' : 'Importer mon archive Twitter/X'}
                        </p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {hasOnboarded ? 'Accéder au graphe de reconnexion' : 'Retrouvez vos contacts sur le graphe'}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isUploadOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className={`h-5 w-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                    </motion.div>
                  </motion.button>

                  {/* Contenu déroulant */}
                  <AnimatePresence>
                    {isUploadOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                      >
                        <div className={`border-t p-4 sm:p-5 ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                          {hasOnboarded ? (
                            /* Bouton vers /reconnect pour utilisateurs onboardés */
                            <a
                              href={`/${locale}/reconnect`}
                              className={`flex items-center justify-center gap-3 w-full py-3 px-4 rounded-lg font-medium transition-all ${
                                isDark
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                              }`}
                            >
                              <Activity className="h-5 w-5" />
                              <span className="text-[13px]">Accéder à mon réseau</span>
                            </a>
                          ) : (
                            /* OnboardingSection pour utilisateurs non onboardés */
                            <OnboardingSection
                              session={session?.user}
                              mastodonInstances={mastodonInstances}
                              setIsLoading={setIsLoading}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Section Login - Menu déroulant */}
              <div className={`mt-4 rounded-xl backdrop-blur-sm border shadow-xl overflow-hidden ${
                isDark 
                  ? 'bg-slate-900/95 border-slate-700/50' 
                  : 'bg-white/90 border-slate-200'
              }`}>
                {/* Header cliquable */}
                <motion.button
                  onClick={() => setIsLoginOpen(!isLoginOpen)}
                  className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${
                    isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${connectedServicesCount >= 2 ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-blue-500/20 border-blue-500/30'}`}>
                      {connectedServicesCount >= 2 ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Link className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {connectedServicesCount >= 2 ? `${connectedServicesCount} comptes connectés ✓` : 'Connecter mes comptes'}
                      </p>
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {connectedServicesCount >= 2 ? 'Prêt pour la migration' : 'Bluesky, Mastodon, Twitter/X'}
                      </p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isLoginOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className={`h-5 w-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                  </motion.div>
                </motion.button>

                {/* Contenu déroulant */}
                <AnimatePresence>
                  {isLoginOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className={`border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                        <DashboardLoginButtons
                          connectedServices={{
                            twitter: !!session?.user?.twitter_username,
                            bluesky: !!session?.user?.bluesky_username,
                            mastodon: !!session?.user?.mastodon_username
                          }}
                          hasUploadedArchive={true}
                          onLoadingChange={setIsLoading}
                          mastodonInstances={mastodonInstances}
                          userId={session?.user?.id}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Section Upload Archive - Menu déroulant (pour utilisateurs non onboardés) - SECOND when < 2 accounts connected */}
              {!hasOnboarded && connectedServicesCount < 2 && (
                <div className={`mt-4 rounded-xl backdrop-blur-sm border shadow-xl overflow-hidden ${
                  isDark 
                    ? 'bg-slate-900/95 border-slate-700/50' 
                    : 'bg-white/90 border-slate-200'
                }`}>
                  {/* Header cliquable */}
                  <motion.button
                    onClick={() => setIsUploadOpen(!isUploadOpen)}
                    className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${
                      isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/30">
                        <Upload className="h-5 w-5 text-rose-400" />
                      </div>
                      <div className="text-left">
                        <p className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          Importer mon archive Twitter/X
                        </p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Retrouvez vos contacts sur le graphe
                        </p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isUploadOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className={`h-5 w-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
                    </motion.div>
                  </motion.button>

                  {/* Contenu déroulant */}
                  <AnimatePresence>
                    {isUploadOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                      >
                        <div className={`border-t p-4 sm:p-5 ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                          <OnboardingSection
                            session={session?.user}
                            mastodonInstances={mastodonInstances}
                            setIsLoading={setIsLoading}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="mt-4 space-y-8 sm:space-y-16">
                {/* Grid 2 colonnes si TutorialSection visible, sinon centré */}
                <div className={`grid grid-cols-1 gap-6 sm:gap-8 ${!(hasOnboarded && connectedServicesCount >= 2) ? 'md:grid-cols-2' : 'max-w-xl mx-auto'}`}>
                  {session?.user?.id && (
                    <NewsletterSection 
                      userId={session.user.id}
                      showModal={showNewsletterModal}
                      setShowModal={setShowNewsletterModal}
                      onUpdate={update}
                      haveSeenNewsletter={!!session.user.have_seen_newsletter}
                      newsletterData={newsletterData}
                    />
                  )}

                  {/* N'afficher TutorialSection que si l'onboarding n'est pas complet */}
                  {!(hasOnboarded && connectedServicesCount >= 2) && (
                    <TutorialSection />
                  )}
                </div>

                {session?.user?.id && (
                  <NewsLetterFirstSeen
                    userId={session.user.id}
                    newsletterData={newsletterData}
                    isOpen={isNewsletterFirstSeenOpen}
                    onClose={() => {
                      setIsNewsletterFirstSeenOpen(false);
                      setShowNewsletterModal(false);
                    }}
                    onSubscribe={() => {
                      setIsNewsletterFirstSeenOpen(false);
                      setShowNewsletterModal(false);
                      update();
                    }}
                  />
                )}

                {/* Test modal for ModalShell validation */}
                <TestCModale isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} />
                <TestCModale isOpen={isTestModalStrictOpen} onClose={() => setIsTestModalStrictOpen(false)} strict />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
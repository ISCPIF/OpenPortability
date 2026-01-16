'use client';

import { useState, Fragment, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { quantico } from '@/app/fonts/plex';
import { useNewsletter } from '@/hooks/useNewsLetter';
import { isValidEmail } from '@/lib/utils';
import Header from '@/app/_components/layouts/Header';
import Footer from '@/app/_components/layouts/Footer';
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import SwitchSettingsSection from '@/app/_components/sections/settings/SwitchSettingsSection';
import ConnectedAccounts from '@/app/_components/layouts/ConnectedAccounts';
import TutorialSection from '@/app/_components/sections/dashboard/TutorialSection';
import NewsletterSection from '@/app/_components/sections/dashboard/NewsletterSection';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Settings, LogOut, AlertTriangle, Upload } from 'lucide-react';
import { clearCacheOnLogout, clearCacheOnAccountDelete } from '@/lib/utils/clearUserCache';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground';
import { useTheme } from '@/hooks/useTheme';
import logoBlanc from '@/../public/logo/logo-openport-blanc.svg';

// Cookie helper functions
const NEWSLETTER_MODAL_COOKIE = 'newsletter_modal_seen';

function hasSeenNewsletterModal(): boolean {
  if (typeof document === 'undefined') return true;
  return document.cookie.includes(`${NEWSLETTER_MODAL_COOKIE}=true`);
}

function setNewsletterModalSeen(): void {
  if (typeof document === 'undefined') return;
  // Set cookie to expire in 30 days
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  document.cookie = `${NEWSLETTER_MODAL_COOKIE}=true; expires=${expires.toUTCString()}; path=/`;
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tLoaders = useTranslations('loaders');
  const { data: session, status } = useSession();
  const router = useRouter();
  const { colors } = useTheme();
  
  // Newsletter state
  const { 
    email: savedEmail,
    consents,
    isLoading,
    error,
    updateConsent,
    updateEmailWithNewsletter
  } = useNewsletter();

  // Newsletter modal state - managed by NewsletterSection but we track it for auto-open
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  
  // Check if we should show newsletter modal on mount
  useEffect(() => {
    // Show modal if:
    // 1. User hasn't seen it (no cookie)
    // 2. User hasn't consented to newsletter yet
    const hasNewsletterConsent = consents?.email_newsletter === true;
    const hasSeenModal = hasSeenNewsletterModal();
    
    if (!hasSeenModal && !hasNewsletterConsent && !isLoading && session?.user) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowNewsletterModal(true);
        setNewsletterModalSeen(); // Mark as seen when auto-opened
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [consents, isLoading, session]);

  // Email form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState(savedEmail || '');
  const [emailError, setEmailError] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  // Handle email submission
  const handleEmailSubmit = async () => {
    if (!email || !isValidEmail(email)) {
      setEmailError(t('invalidEmail'));
      return;
    }

    setIsSubmittingEmail(true);
    setEmailError('');

    try {
      const success = await updateEmailWithNewsletter(email, true);
      if (success) {
        setShowEmailForm(false);
      } else {
        setEmailError(t('updateFailed'));
      }
    } catch (err) {
      setEmailError(t('updateFailed'));
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  if (status === "unauthenticated") {
    router.replace("/auth/signin");
    return;
  }


  const confirmDelete = async () => {
    try {
      const response = await fetch('/api/delete', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Clear all user cache (IndexedDB, localStorage, sessionStorage)
      await clearCacheOnAccountDelete(session?.user?.id);
      
      signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="relative min-h-screen w-full flex items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <ParticulesBackground />
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          <LoadingIndicator msg={tLoaders('settings')} color="#f59e0b" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: colors.background }}
    >
      <ParticulesBackground />
      <div className={`${quantico.className} relative z-20 flex min-h-screen flex-col`}>
        <Header />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-4 mb-8">
            <Image
              src={logoBlanc}
              alt="OpenPort Logo"
              width={200}
              height={72}
              className="mx-auto w-[160px] sm:w-[200px]"
              priority
            />
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              <h1 className="text-lg font-semibold text-white">{t('title') ?? 'Settings'}</h1>
            </div>
          </div>

          <div className="w-full max-w-6xl mx-auto space-y-8">
            {/* Main Content: 2 columns on desktop, reversed order on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
              
              {/* Right Column on desktop, First on mobile: Sidebar (accounts only) */}
              <div className="space-y-4 lg:order-2">
                {/* Connected Accounts */}
                <ConnectedAccounts />

                {/* Upload Archive panel - only for non-onboarded users */}
                {session?.user && !session.user.has_onboarded && (
                  <div className="rounded-xl bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-sm border border-blue-500/30 shadow-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Upload className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-[13px] font-semibold text-white">
                        {t('importArchive') ?? 'Import your archive'}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-300 mb-4 leading-relaxed">
                      {t('importArchiveDescription') ?? 'Upload your Twitter/X archive to find your connections on other platforms.'}
                    </p>
                    <Link
                      href="/upload"
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white transition-all shadow-lg shadow-blue-500/25"
                    >
                      <Upload className="w-4 h-4" />
                      {t('importArchiveButton') ?? 'Import Archive'}
                    </Link>
                  </div>
                )}

                {/* Logout + Delete - Hidden on mobile, shown in sidebar on desktop */}
                <div className="hidden lg:block space-y-4">
                  {/* Logout panel */}
                  <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LogOut className="w-4 h-4 text-amber-400" />
                        <span className="text-[13px] font-medium text-white">
                          {t('logout') ?? 'Logout'}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          await clearCacheOnLogout(session?.user?.id);
                          signOut();
                        }}
                        className="px-4 py-2 text-[12px] font-medium rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all shadow-md"
                      >
                        {t('logout') ?? 'Logout'}
                      </button>
                    </div>
                  </div>

                  {/* Delete Account panel */}
                  <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm border border-rose-500/30 shadow-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-[13px] font-medium text-rose-300">
                          {t('deleteAccount')}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 text-[12px] font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('deleteAccount')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Column on desktop, Second on mobile: Main Settings */}
              <div className="space-y-6 lg:order-1">
                {/* Notification Options - Primary content */}
                <div className="rounded-2xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl overflow-hidden">
                  <div className="px-6 pt-5 pb-4">
                    <h2 className="text-[15px] font-semibold text-white">
                      {t('notificationOptions')}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t('notificationOptionsDescription') ?? 'Manage how you receive updates and notifications'}
                    </p>
                    <div className="mt-4 border-b border-slate-700/50" />
                  </div>
                  <div className="px-6 pb-5">
                    <SwitchSettingsSection
                      consents={consents}
                      onConsentChange={async (type, value) => { await updateConsent(type, value); }}
                      showEmailForm={showEmailForm}
                      setShowEmailForm={setShowEmailForm}
                      email={email}
                      setEmail={setEmail}
                      emailError={emailError}
                      setEmailError={setEmailError}
                      handleEmailSubmit={handleEmailSubmit}
                      isSubmittingEmail={isSubmittingEmail}
                    />
                  </div>
                </div>

                {/* Tutorial + Newsletter Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TutorialSection />
                  
                  {session?.user && (
                    <NewsletterSection
                      userId={session.user.id}
                      showModal={showNewsletterModal}
                      setShowModal={setShowNewsletterModal}
                      onUpdate={() => {}}
                      haveSeenNewsletter={hasSeenNewsletterModal()}
                      newsletterData={{ consents }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Mobile only: Logout + Delete at the bottom */}
            <div className="lg:hidden space-y-4">
              {/* Logout panel */}
              <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-amber-400" />
                    <span className="text-[13px] font-medium text-white">
                      {t('logout') ?? 'Logout'}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      await clearCacheOnLogout(session?.user?.id);
                      signOut();
                    }}
                    className="px-4 py-2 text-[12px] font-medium rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all shadow-md"
                  >
                    {t('logout') ?? 'Logout'}
                  </button>
                </div>
              </div>

              {/* Delete Account panel */}
              <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm border border-rose-500/30 shadow-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="text-[13px] font-medium text-rose-300">
                      {t('deleteAccount')}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 text-[12px] font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('deleteAccount')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Delete confirmation modal */}
      <Transition appear show={showDeleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteConfirm(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0" style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)' }} />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className={`${quantico.className} w-full max-w-md transform overflow-hidden rounded-xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl p-6 text-left align-middle transition-all`}>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <Dialog.Title as="h3" className="text-[14px] font-semibold text-white">
                      {t('deleteConfirm.title')}
                    </Dialog.Title>
                  </div>
                  <div className="mt-2 space-y-3">
                    <p className="text-[12px] text-slate-400 whitespace-pre-line">
                      {t('deleteConfirm.message')}
                    </p>
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {t('deleteConfirm.gdprNotice')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-[12px] font-medium text-slate-400 hover:text-white transition-colors"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t('deleteConfirm.cancel')}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-[12px] font-medium text-white bg-gradient-to-r from-rose-500 to-red-600 rounded-lg hover:from-rose-600 hover:to-red-700 transition-all"
                      onClick={confirmDelete}
                    >
                      {t('deleteConfirm.confirm')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
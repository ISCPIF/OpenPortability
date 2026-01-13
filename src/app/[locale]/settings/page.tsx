'use client';

import { useState, Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { quantico } from '@/app/fonts/plex';
import { useNewsletter } from '@/hooks/useNewsLetter';
import { isValidEmail } from '@/lib/utils';
import Header from '@/app/_components/layouts/Header';
import Footer from '@/app/_components/layouts/Footer';
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import SwitchSettingsSection from '@/app/_components/sections/settings/SwitchSettingsSection';
import ConnectedAccounts from '@/app/_components/layouts/ConnectedAccounts';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Trash2, Settings, LogOut, AlertTriangle } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground';
import { useTheme } from '@/hooks/useTheme';
import logoBlanc from '@/../public/logo/logo-openport-blanc.svg';

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

      // Supprimer la préférence de langue du localStorage
      localStorage.removeItem(`user_language_${session?.user?.id}`);
      
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

          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
            {/* Main settings panel */}
            <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700/50">
                <h2 className="text-[14px] font-semibold text-white">
                  {t('notificationOptions')}
                </h2>
              </div>
              <div className="p-6">
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

            {/* Sidebar */}
            <div className="space-y-4">
              <ConnectedAccounts />

              {/* Logout panel */}
              <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-amber-400" />
                    <h3 className="text-[13px] font-semibold text-white">
                      {t('logout') ?? 'Logout'}
                    </h3>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="px-4 py-2 text-[12px] font-medium rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition-all"
                  >
                    {t('logout') ?? 'Logout'}
                  </button>
                </div>
              </div>

              {/* Delete account panel */}
              <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm border border-rose-500/30 shadow-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h2 className="text-[13px] font-semibold text-rose-400">
                    {t('deleteAccount')}
                  </h2>
                </div>
                <div className="space-y-2 mb-4">
                  {[1, 2, 3, 4].map(index => (
                    <p key={index} className="text-[11px] text-slate-400 whitespace-pre-line">
                      {t(`deleteConfirm.message${index}` as const)}
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[12px] font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('deleteAccount')}
                </button>
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
                  <div className="mt-2">
                    <p className="text-[12px] text-slate-400 whitespace-pre-line">
                      {t('deleteConfirm.message')}
                    </p>
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
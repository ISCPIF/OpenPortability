'use client';

import { useState, Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { useNewsletter } from '@/hooks/useNewsLetter';
import { isValidEmail } from '@/lib/utils';
import Header from '@/app/_components/layouts/Header';
import Footer from '@/app/_components/layouts/Footer';
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import SwitchSettingsSection from '@/app/_components/sections/settings/SwitchSettingsSection';
import ConnectedAccounts from '@/app/_components/layouts/ConnectedAccounts';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import Image from 'next/image';
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground';
import { useTheme } from '@/hooks/useTheme';
import logoBlanc from '@/../public/logo/logo-openport-blanc.svg';
import logoRose from '@/../public/logos/logo-openport-rose.svg';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { data: session, status } = useSession();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  
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
        className="relative min-h-screen w-full"
        style={{ backgroundColor: colors.background }}
      >
        <ParticulesBackground />
        <div className="relative z-10 container mx-auto py-12">
          <div className="flex flex-col items-center text-center text-white">
            <div className="my-32 lg:my-40">
              <LoadingIndicator msg={t('loading')} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const primaryCardClasses = isDark
    ? 'bg-white/5 border-white/10 text-white'
    : 'bg-white/90 border-slate-200 text-slate-900 shadow-[0_25px_60px_rgba(15,23,42,0.12)]';
  const secondaryTextClass = isDark ? 'text-white/70' : 'text-slate-600';
  const deleteCardClasses = isDark
    ? 'bg-gradient-to-br from-red-500/10 via-slate-950/70 to-slate-950/90 border-red-500/40 text-white shadow-[0_25px_65px_rgba(0,0,0,0.55)]'
    : 'bg-gradient-to-br from-white via-rose-50/90 to-white border-red-200 text-slate-900 shadow-[0_30px_70px_rgba(244,63,94,0.18)]';
  const deleteAccentColor = isDark ? '#ff4d8d' : '#e11d48';
  const deleteButtonClasses = isDark
    ? 'text-red-200 bg-red-500/20 hover:bg-red-500/30'
    : 'text-red-600 bg-red-100 hover:bg-red-200';

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: colors.background }}
    >
      <ParticulesBackground />
      <div className="relative z-20 flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col items-center text-center gap-6 mb-10">
            <Image
              src={isDark ? logoBlanc : logoRose}
              alt="OpenPort Logo"
              width={306}
              height={110}
              className="mx-auto sm:w-[220px] md:w-[280px]"
              priority
            />
            {/* <p className={`${plex.className} text-sm uppercase tracking-[0.4em] ${secondaryTextClass}`}>
              {t('subtitle')}
            </p> */}
          </div>

          <div className="w-full max-w-4xl mx-auto space-y-8">
            <div className={`rounded-3xl border p-6 sm:p-8 backdrop-blur-xl ${primaryCardClasses}`}>
              <h2 className={`${plex.className} text-lg font-medium mb-6`}>
                {t('notificationOptions')}
              </h2>

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

            <div className="grid grid-cols-1 gap-6">
              <div className={`rounded-3xl border p-6 backdrop-blur-xl ${primaryCardClasses}`}>
                <ConnectedAccounts />
              </div>

              <div className={`relative overflow-hidden rounded-3xl border-[1.5px] p-6 sm:p-8 backdrop-blur-xl ${deleteCardClasses}`}>
                <div
                  className="absolute inset-x-8 top-0 h-px"
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${deleteAccentColor}, transparent)`
                  }}
                />
                <div className="relative">
                  <h2 className={`${plex.className} text-lg font-medium mb-4`} style={{ color: deleteAccentColor }}>
                    {t('deleteAccount')}
                  </h2>
                  {[1, 2, 3, 4].map(index => (
                    <p key={index} className={`text-sm mb-6 whitespace-pre-line ${secondaryTextClass}`}>
                      {t(`deleteConfirm.message${index}` as const)}
                    </p>
                  ))}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition-all ${deleteButtonClasses}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('deleteAccount')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

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
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                <Dialog.Panel className={`w-full max-w-md transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all border ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-white/10' : 'bg-white border-slate-200'}`}>
                  <Dialog.Title as="h3" className={`${plex.className} text-sm font-medium leading-6 ${isDark ? 'text-white' : 'text-slate-900'} mb-2`}>
                    {t('deleteConfirm.title')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className={`text-xs whitespace-pre-line ${secondaryTextClass}`}>
                      {t('deleteConfirm.message')}
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className={`px-4 py-2 text-xs font-medium transition-colors ${isDark ? 'text-gray-300 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t('deleteConfirm.cancel')}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:from-red-600 hover:to-red-700 transition-all"
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
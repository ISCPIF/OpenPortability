'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { useNewsletter } from '@/hooks/useNewsLetter';
import { isValidEmail } from '@/lib/utils';
import Header from '@/app/_components/Header';
import Footer from '@/app/_components/Footer';
import LoadingIndicator from '@/app/_components/LoadingIndicator';
import SwitchSettingsSection from '@/app/_components/settings/SwitchSettingsSection';
import LoginSea from '@/app/_components/LoginSea';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts';
import { useSession } from 'next-auth/react';
// import PersonalizedSupportFlowSection from '@/app/_components/settings/PersonalizedSupportFlowSection';
import { Trash2 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { signOut } from 'next-auth/react';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { data: session } = useSession();
  
  // Newsletter state
  const { 
    email: savedEmail,
    consents,
    isLoading,
    error,
    updateConsent,
    updateEmailWithNewsletter
  } = useNewsletter();

  // Wrapper pour updateConsent qui retourne void
  const handleDMConsentChange = async (type: 'bluesky_dm', value: boolean) => {
    await updateConsent(type, value);
  };

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

  const confirmDelete = async () => {
    try {
      const response = await fetch('/api/delete', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  console.log("consents from /settings ->", consents);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator msg={t('loading')} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2a39a9] w-full">
      <div className="relative z-40">
        <Header />
      </div>
      
      <div className="w-full">
        <div className="flex flex-col text-center text-[#E2E4DF]">
          <LoginSea />
        </div>
      </div>

      <div className="relative w-full bg-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Section Notifications */}
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10">
            <h2 className={`${plex.className} text-lg font-medium text-white mb-6`}>
              {t('notificationOptions')}
            </h2>
            
            {/* Composant de flux pour le support personnalisé
            <PersonalizedSupportFlowSection
              userId={session?.user?.id || ''}
              blueskyHandle={session?.user?.bluesky_username || ''}
              mastodonHandle={session?.user?.mastodon_username || ''}
              hasPersonalizedSupport={consents?.personalized_support ?? false}
              hasBlueskyDM={consents?.bluesky_dm ?? false}
              hasMastodonDM={consents?.mastodon_dm ?? false}
              onDMConsentChange={handleDMConsentChange}
            />
             */}
            <SwitchSettingsSection
              consents={consents}
              onConsentChange={updateConsent}
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

          {/* Section Comptes et Suppression */}
          <div className="grid grid-cols-1 gap-6">
            {/* Comptes Connectés */}
            <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <ConnectedAccounts />
            </div>

            {/* Account Deletion */}
            <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-red-500/10">
              <h2 className={`${plex.className} text-lg font-medium text-red-400 mb-4`}>
                {t('deleteAccount')}
              </h2>
              <p className="text-sm text-gray-300 mb-6 whitespace-pre-line">
                {t('deleteConfirm.message')}
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('deleteAccount')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-white/10">
                  <Dialog.Title as="h3" className={`${plex.className} text-sm font-medium leading-6 text-white mb-2`}>
                    {t('deleteConfirm.title')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-xs text-gray-300 whitespace-pre-line">
                      {t('deleteConfirm.message')}
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
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
      <Footer />
    </div>
  );
}
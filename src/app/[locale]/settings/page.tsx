'use client';

import { useState, Fragment, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { useNewsLetter } from '@/hooks/useNewsLetter';
import { signOut, useSession } from 'next-auth/react';
import { Switch, Dialog, Transition } from '@headlessui/react';
import { isValidEmail } from '@/lib/utils';
import { Trash2, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import PartialConnectedServicesState from '@/app/_components/reconnect/states/PartialConnectedServicesState';
import Header from '@/app/_components/Header';
import LoginSea from '@/app/_components/LoginSea';
import Footer from '@/app/_components/Footer';
import LoadingIndicator from '@/app/_components/LoadingIndicator';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts';
import SwitchSettingsSection from '@/app/_components/settings/SwitchSettingsSection';

// Type pour les erreurs de test DM
interface TaskErrorType {
  type: 'generic' | 'needsFollow' | 'messagesDisabled';
  message?: string;
}

// Type pour la réponse du test DM
interface TestDMResponse {
  success: boolean;
  error?: string;
  needs_follow?: boolean;
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  console.log('t -->', t('notificationOptions'));
  // const tNewsLetter = useTranslations('settings');
  const { data: session } = useSession();
  const { 
    preferences: apiPreferences,
    isLoading: apiLoading, 
    updatePreferences,
    isTokenValid,
    invalidProviders,
    mastodonInstances,
    checkTokenValidity,
    toggleOEPAccepted,
    toggleResearchAccepted,
    togglePersonalizedSupport,
    updateNewsletterWithEmail
  } = useNewsLetter();

  // États pour la section de suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // États pour les notifications de succès
  const [showSuccess, setShowSuccess] = useState(false);
  
  // États pour le test DM
  const [testingDM, setTestingDM] = useState(false);
  const [dmResult, setDmResult] = useState<TestDMResponse | null>(null);
  const [showFollowButton, setShowFollowButton] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<TaskErrorType | null>(null);
  
  // États pour gérer l'affichage du formulaire email
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [acceptOEP, setAcceptOEP] = useState(false);
  const [acceptResearch, setAcceptResearch] = useState(false);
  const [hqxNewsletter, setHqxNewsletter] = useState(true);
  const [emailSubmitSuccess, setEmailSubmitSuccess] = useState(false);

  console.log('preferences', apiPreferences)

  // Variables dérivées pour le test DM
  const hasDMConsent = apiPreferences?.personalized_support === true;
  const hasBlueskyUsername = session?.user?.bluesky_username;
  const blueskyHandle = session?.user?.bluesky_handle || hasBlueskyUsername;
  const userId = session?.user?.id;

  // Gestionnaire de changement pour les switches
  const handleSwitchChange = async (type: 'research' | 'oep' | 'personalized_support' | 'hqx', value: boolean) => {
    try {
      if (type === 'hqx') {
        if (value) {
          // Afficher le formulaire email
          setShowEmailForm(true);
          return;
        } else {
          // Désactiver le consentement et cacher le formulaire
          setShowEmailForm(false);
          
          // Utiliser le hook pour mettre à jour
          const success = await updateNewsletterWithEmail(undefined, false);
          
          if (success) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          } else {
          }
          return;
        }
      }

      // Pour les autres types, mise à jour immédiate via les méthodes du hook
      let success = false;
      
      // Mise à jour optimiste de l'état local
      switch (type) {
        case 'research':
          success = await toggleResearchAccepted();
          break;
        case 'oep':
          success = await toggleOEPAccepted();
          break;
        case 'personalized_support':
          success = await togglePersonalizedSupport();
          break;
        default:
          return;
      }
      
      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        // En cas d'échec, on revient à l'état précédent
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      // En cas d'erreur, on revient à l'état précédent
    }
  };

  // Gestionnaire pour l'enregistrement de l'email
  const handleEmailSubmit = async () => {
    try {
      if (!email || !isValidEmail(email)) {
        setEmailError(t('newsletter.errors.missingEmail'));
        return;
      }

      setIsSubmittingEmail(true);
      setEmailError('');

      // Utiliser le hook pour mettre à jour
      const success = await updateNewsletterWithEmail(email, true);

      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setShowEmailForm(false);
      } else {
        throw new Error('Failed to update newsletter preferences');
      }
    } catch (error) {
      console.error('Error updating newsletter preferences:', error);
      setEmailError(t('newsletter.errors.updateFailed'));
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleDMConsentChange = async (type: 'bluesky_dm' | 'mastodon_dm' | 'email_newsletter', value: boolean) => {
    try {
      // Créer l'objet de mise à jour
      let updateObj: Partial<typeof apiPreferences> = {};
      let consents: Array<{ type: string; value: boolean }> = [];
      
      switch (type) {
        case 'bluesky_dm':
          updateObj = { bluesky_dm: value };
          consents = [{ type: 'bluesky_dm', value: value }];
          if (value) {
            // Si on active le DM Bluesky, lancer le test
            // await handleDMTest();
          }
          break;
        case 'mastodon_dm':
          updateObj = { mastodon_dm: value };
          consents = [{ type: 'mastodon_dm', value: value }];
          break;
        case 'email_newsletter':
          updateObj = { email_newsletter: value };
          consents = [{ type: 'email_newsletter', value: value }];
          break;
      }
      
      // Mettre à jour l'état local immédiatement (mise à jour optimiste)
      
      // Envoyer la mise à jour des consentements
      const response = await fetch('/api/newsletter/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consents }),
      });

      if (response.ok) {
        // Afficher le message de succès
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        // Réinitialiser l'état local si la mise à jour échoue
      }
    } catch (error) {
      console.error('Error updating DM consent:', error);
      // Réinitialiser l'état local si la mise à jour échoue
    }
  };

  // Gestionnaire pour la suppression de compte
  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

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

  // Gestion du changement de statut de chargement pendant la reconnexion
  const handleLoadingChange = (isLoading: boolean) => {
    if (!isLoading) {
      // Rafraîchir la vérification du token après reconnexion
      checkTokenValidity();
    }
  };

  // Test d'envoi de DM
  const handleTestDM = async () => {
    if (!session?.user?.id || !blueskyHandle || testingDM) return;
    
    setTestingDM(true);
    setTestStatus('testing');
    setError(null);
    setDmResult(null);
    setShowFollowButton(false);
    setShowEmailForm(false); // Réinitialiser l'état du formulaire d'email
    
    try {
      const response = await fetch('/api/bluesky/test-dm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          handle: blueskyHandle,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        setTestStatus('failed');
        setError({ type: 'generic', message: error.error });
        setTestingDM(false);
        return;
      }
      
      const data = await response.json();
      setDmResult(data);
      
      if (data.task_id) {
        await pollTaskStatus(data.task_id);
      } else {
        setTestStatus('failed');
        setError({ type: 'generic', message: 'No task ID returned' });
        setTestingDM(false);
      }
    } catch (error) {
      console.error('Error testing DM:', error);
      setTestStatus('failed');
      setError({ type: 'generic', message: String(error) });
      setTestingDM(false);
    }
  };

  // Afficher l'indicateur de chargement si les données sont en cours de chargement
  if (apiLoading) {
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
          <div className="bg-[#2a39a9] p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-6">{t('notificationOptions')}</h2>
            <SwitchSettingsSection
              apiPreferences={apiPreferences}
              onSwitchChange={handleSwitchChange}
              onDMConsentChange={handleDMConsentChange}
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
              {/* <h2 className={`${plex.className} text-lg font-medium text-white mb-6`}>
                {t('connectedAccounts.yourAccounts')}
              </h2> */}
              <ConnectedAccounts onLoadingChange={handleLoadingChange} />
            </div>

            {/* Suppression du compte */}
            <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10">
              <h2 className={`${plex.className} text-lg font-medium text-white mb-2`}>
                {t('deleteAccount')}
              </h2>
              <div className="flex flex-col items-center w-full">
                <div className="space-y-4 p-4 w-full mb-4">
                  <p className="text-xs text-gray-300">
                    {t('deleteConfirm.message1')}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-300">{t('deleteConfirm.message2')}</p>
                    <p className="text-xs text-gray-300">{t('deleteConfirm.message3')}</p>
                    <p className="text-xs text-gray-300">{t('deleteConfirm.message4')}</p>
                  </div>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">{t('deleteAccount')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Notifications de succès */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed top-4 right-4 bg-green-500/90 text-white px-4 py-2 rounded-lg shadow-lg"
              >
                {t('updateSuccess')}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal de confirmation de suppression */}
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
                      <div className="mt-2 space-y-4">
                        <p className="text-xs text-gray-300">
                          {t('deleteConfirm.message1')}
                        </p>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-300">{t('deleteConfirm.message2')}</p>
                          <p className="text-xs text-gray-300">{t('deleteConfirm.message3')}</p>
                          <p className="text-xs text-gray-300">{t('deleteConfirm.message4')}</p>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          type="button"
                          className="inline-flex justify-center rounded-lg border border-transparent bg-gray-700 px-4 py-2 text-xs font-medium text-white hover:bg-gray-600 focus:outline-none"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          {t('deleteConfirm.cancel')}
                        </button>
                        <button
                          type="button"
                          className="inline-flex justify-center rounded-lg border border-transparent bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 focus:outline-none"
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
      </div>
      <Footer />
    </div>
  );
}
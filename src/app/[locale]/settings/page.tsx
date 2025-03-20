'use client';

import { useState, Fragment, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { useNewsLetter } from '@/hooks/useNewsLetter';
import { signOut, useSession } from 'next-auth/react';
import { Switch, Dialog, Transition } from '@headlessui/react';
import { isValidEmail } from '@/lib/utils';
import { Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import PartialConnectedServicesState from '@/app/_components/reconnect/states/PartialConnectedServicesState';
import Header from '@/app/_components/Header';
import LoginSea from '@/app/_components/LoginSea';
import Footer from '@/app/_components/Footer';
import LoadingIndicator from '@/app/_components/LoadingIndicator';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts';

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
  const tNewsLetter = useTranslations('NewsletterConsent');
  const { data: session } = useSession();
  const { 
    preferences: apiPreferences,
    isLoading: apiLoading, 
    updatePreferences,
    isTokenValid,
    invalidProviders,
    mastodonInstances,
    checkTokenValidity
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
  
  // États pour le formulaire d'email
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [acceptOEP, setAcceptOEP] = useState(false);
  const [acceptResearch, setAcceptResearch] = useState(false);
  const [hqxNewsletter, setHqxNewsletter] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailSubmitSuccess, setEmailSubmitSuccess] = useState(false);

  // État local pour les préférences (état optimiste)
  const [preferences, setPreferences] = useState(apiPreferences);
  const [isLoading, setIsLoading] = useState(apiLoading);
  
  // Synchroniser l'état local avec l'API quand apiPreferences change
  useEffect(() => {
    setPreferences(apiPreferences);
    setIsLoading(apiLoading);
  }, [apiPreferences, apiLoading]);

  // Variables dérivées pour le test DM
  const hasDMConsent = preferences.dm_consent === true;
  const hasBlueskyUsername = session?.user?.bluesky_username;
  const blueskyHandle = session?.user?.bluesky_handle || hasBlueskyUsername;
  const userId = session?.user?.id;

  // Gestionnaire de changement pour les switches
  const handleSwitchChange = async (type: 'research' | 'oep' | 'dm' | 'hqx', value: boolean) => {
    try {
      // Créer l'objet de mise à jour
      let updateObj: Partial<typeof preferences> = {};
      
      switch (type) {
        case 'research':
          updateObj = { research_accepted: value };
          break;
        case 'oep':
          updateObj = { oep_accepted: value };
          break;
        case 'dm':
          updateObj = { dm_consent: value };
          break;
        case 'hqx':
          updateObj = { hqx_newsletter: value };
          break;
      }
      
      // Mettre à jour l'état local immédiatement (mise à jour optimiste)
      setPreferences(prev => ({ ...prev, ...updateObj }));
      
      // Faire la mise à jour en arrière-plan
      const success = await updatePreferences(updateObj);
      
      if (success) {
        // Afficher le message de succès
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        // Réinitialiser l'état local si la mise à jour échoue
        setPreferences(prev => ({ ...prev, ...apiPreferences }));
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Réinitialiser l'état local si la mise à jour échoue
      setPreferences(prev => ({ ...prev, ...apiPreferences }));
    }
  };

  const handleDMConsentChange = async (type: 'bluesky_dm' | 'mastodon_dm' | 'email_newsletter', value: boolean) => {
    try {
      // Créer l'objet de mise à jour
      let updateObj: Partial<typeof preferences> = {};
      
      switch (type) {
        case 'bluesky_dm':
          updateObj = { bluesky_dm: value };
          if (value) {
            // Si on active le DM Bluesky, lancer le test
            await handleDMTest();
          }
          break;
        case 'mastodon_dm':
          updateObj = { mastodon_dm: value };
          break;
        case 'email_newsletter':
          updateObj = { email_newsletter: value };
          break;
      }
      
      // Mettre à jour l'état local immédiatement (mise à jour optimiste)
      setPreferences(prev => ({ ...prev, ...updateObj }));
      
      // Mettre à jour les préférences via l'API
      const response = await fetch('/api/newsletter/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          value
        }),
      });

      if (response.ok) {
        // Afficher le message de succès
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        // En cas d'échec, restaurer l'état précédent
        setPreferences(prev => ({ ...prev, ...apiPreferences }));
      }
    } catch (error) {
      console.error('Error updating DM consent:', error);
      // Réinitialiser l'état local si la mise à jour échoue
      setPreferences(prev => ({ ...prev, ...apiPreferences }));
    }
  };

  const handleDMTest = async () => {
    if (!session?.user?.id || !session?.user?.bluesky_username || testingDM) return;
    
    setTestingDM(true);
    setTestStatus('testing');
    setError(null);
    setShowFollowButton(false);
    
    try {
      const response = await fetch('/api/bluesky/test-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          handle: session.user.bluesky_username,
        }),
      });
      
      const data = await response.json();
      
      if (data.task_id) {
        await pollTaskStatus(data.task_id);
      } else {
        setTestStatus('failed');
        setError({ type: 'generic', message: 'No task ID returned' });
      }
    } catch (error) {
      console.error('Error testing DM:', error);
      setTestStatus('failed');
      setError({ type: 'generic', message: String(error) });
    } finally {
      setTestingDM(false);
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    try {
      let maxRetries = 30; // 1 minute max (30 * 2 secondes)
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2 secondes
        
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) throw new Error('Failed to check task status');
        
        const data = await response.json();
        const task = data.task || data;
        
        if (task.status === 'completed') {
          if (task.result?.success) {
            setTestStatus('success');
            return;
          } else {
            setTestStatus('failed');
            const needsFollow = task.result?.needs_follow;
            setError({
              type: needsFollow ? 'needsFollow' : 'generic',
              message: task.result?.error || task.error_log || 'Une erreur est survenue'
            });
            if (needsFollow) setShowFollowButton(true);
            return;
          }
        } 
        
        if (task.status === 'failed') {
          setTestStatus('failed');
          setError({ 
            type: 'generic', 
            message: task.error_log || 'Une erreur est survenue' 
          });
          return;
        }
        
        retryCount++;
      }
      
      throw new Error('Le test a pris trop de temps');
      
    } catch (error) {
      console.error('Error polling task status:', error);
      setTestStatus('failed');
      setError({ 
        type: 'generic', 
        message: error instanceof Error ? error.message : 'Une erreur est survenue' 
      });
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

  // Gestion de l'inscription via email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier la validité de l'email
    if (!email || !isValidEmail(email)) {
      setEmailError(tNewsLetter('invalidEmail'));
      return;
    }
    
    setEmailError('');
    setSubmittingEmail(true);
    
    try {
      const response = await fetch('/api/users/bot-newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          acceptOEP,
          acceptResearch,
          hqxNewsletter,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit email');
      }
      
      // Mise à jour des préférences
      await updatePreferences({
        email,
        oep_accepted: acceptOEP,
        research_accepted: acceptResearch,
        hqx_newsletter: hqxNewsletter,
      });
      
      setEmailSubmitSuccess(true);
    } catch (error) {
      console.error('Error submitting email:', error);
      setEmailError(String(error));
    } finally {
      setSubmittingEmail(false);
    }
  };

  // Afficher l'indicateur de chargement si les données sont en cours de chargement
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
            <div className="space-y-6">
              {/* Newsletter HelloQuitteX et options DM */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white">{t('notifications.hqxNewsletter.title')}</h3>
                    <p className="text-xs text-white/60 mt-1">{t('notifications.hqxNewsletter.description')}</p>
                  </div>
                  <Switch
                    checked={preferences.hqx_newsletter || false}
                    onChange={(value) => handleSwitchChange('hqx', value)}
                    className={`${
                      preferences.hqx_newsletter ? 'bg-[#d6356f]' : 'bg-gray-700'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                  >
                    <span className="sr-only">{t('notifications.hqxNewsletter.title')}</span>
                    <span
                      className={`${
                        preferences.hqx_newsletter ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>

                {/* Options DM conditionnelles */}
                {preferences.hqx_newsletter && (
                  <div className="ml-6 space-y-4 border-l-2 border-white/10 pl-4">
                    {/* Email */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-white">{t('emailConsent')}</h3>
                        <p className="text-xs text-white/60 mt-1">{t('emailDescription')}</p>
                      </div>
                      <Switch
                        checked={preferences.email_newsletter || false}
                        onChange={(value) => handleDMConsentChange('email_newsletter', value)}
                        className={`${
                          preferences.email_newsletter ? 'bg-[#d6356f]' : 'bg-gray-700'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                      >
                        <span className="sr-only">{t('emailConsent')}</span>
                        <span
                          className={`${
                            preferences.email_newsletter ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                    </div>

                    {/* DM Bluesky */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-white">{t('dmConsent')}</h3>
                          <p className="text-xs text-white/60 mt-1">{t('dmDescription')}</p>
                        </div>
                        <Switch
                          checked={preferences.bluesky_dm || false}
                          onChange={(value) => handleDMConsentChange('bluesky_dm', value)}
                          className={`${
                            preferences.bluesky_dm ? 'bg-[#d6356f]' : 'bg-gray-700'
                          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                        >
                          <span className="sr-only">{t('dmConsent')}</span>
                          <span
                            className={`${
                              preferences.bluesky_dm ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                          />
                        </Switch>
                      </div>

                      {/* Affichage du statut du test DM */}
                      {testStatus !== 'idle' && (
                        <div className="mt-2">
                          {testStatus === 'testing' && (
                            <p className="text-sm text-white/80">Test en cours...</p>
                          )}
                          {testStatus === 'success' && (
                            <p className="text-sm text-green-500">Test réussi !</p>
                          )}
                          {testStatus === 'failed' && (
                            <div className="space-y-2">
                              <p className="text-sm text-red-500">
                                {error?.type === 'needsFollow' 
                                  ? "Vous devez d'abord suivre notre compte" 
                                  : error?.message || 'Une erreur est survenue'}
                              </p>
                              {showFollowButton && (
                                <button
                                  onClick={() => window.open('https://bsky.app/profile/helloquittex.bsky.social', '_blank')}
                                  className="text-sm text-blue-400 hover:text-blue-300"
                                >
                                  Suivre notre compte
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* DM Mastodon */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-white">{t('mastodonConsent')}</h3>
                        <p className="text-xs text-white/60 mt-1">{t('dmDescription')}</p>
                      </div>
                      <Switch
                        checked={preferences.mastodon_dm || false}
                        onChange={(value) => handleDMConsentChange('mastodon_dm', value)}
                        className={`${
                          preferences.mastodon_dm ? 'bg-[#d6356f]' : 'bg-gray-700'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                      >
                        <span className="sr-only">{t('mastodonConsent')}</span>
                        <span
                          className={`${
                            preferences.mastodon_dm ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                    </div>
                  </div>
                )}
              </div>

              {/* Newsletter OpenPortability */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">{t('notifications.oepNewsletter.title')}</h3>
                  <p className="text-xs text-white/60 mt-1">{t('notifications.oepNewsletter.description')}</p>
                </div>
                <Switch
                  checked={preferences.oep_accepted || false}
                  onChange={(value) => handleSwitchChange('oep', value)}
                  className={`${
                    preferences.oep_accepted ? 'bg-[#d6356f]' : 'bg-gray-700'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                >
                  <span className="sr-only">{t('notifications.oepNewsletter.title')}</span>
                  <span
                    className={`${
                      preferences.oep_accepted ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>

              {/* Programme CNRS */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">{t('notifications.research.title')}</h3>
                  <p className="text-xs text-white/60 mt-1">{t('notifications.research.description')}</p>
                </div>
                <Switch
                  checked={preferences.research_accepted || false}
                  onChange={(value) => handleSwitchChange('research', value)}
                  className={`${
                    preferences.research_accepted ? 'bg-[#d6356f]' : 'bg-gray-700'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                >
                  <span className="sr-only">{t('notifications.research.title')}</span>
                  <span
                    className={`${
                      preferences.research_accepted ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>
            </div>
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
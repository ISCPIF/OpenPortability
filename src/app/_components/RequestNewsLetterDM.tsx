'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { plex } from '../fonts/plex';
import { useNewsLetter } from '@/hooks/useNewsLetter';
import { MatchingTarget } from '@/lib/types/matching';
import { Switch } from '@headlessui/react';
import { isValidEmail } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import PartialConnectedServicesState from './reconnect/states/PartialConnectedServicesState';

interface TestDMResponse {
  success: boolean;
  error?: string;
  needs_follow?: boolean;
}

interface TaskErrorType {
  type: 'generic' | 'needsFollow' | 'messagesDisabled';
  message?: string;
}

interface RequestNewsLetterDMProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function RequestNewsLetterDM({ isOpen = true, onClose }: RequestNewsLetterDMProps) {
  console.log('🔍 RequestNewsLetterDM rendered with isOpen:', isOpen);
  const t = useTranslations('NewsletterConsent');
  const { data: session } = useSession();
  const { 
    dm_consent, 
    isTokenValid, 
    invalidProviders, 
    mastodonInstances, 
    checkTokenValidity 
  } = useNewsLetter();
  
  const [testingDM, setTestingDM] = useState(false);
  const [dmResult, setDmResult] = useState<TestDMResponse | null>(null);
  const [showFollowButton, setShowFollowButton] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<TaskErrorType | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [acceptOEP, setAcceptOEP] = useState(false);
  const [acceptResearch, setAcceptResearch] = useState(false);
  const [hqxNewsletter, setHqxNewsletter] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailSubmitSuccess, setEmailSubmitSuccess] = useState(false);

  // Vérifier si l'utilisateur a donné son consentement pour les DMs
  const hasDMConsent = dm_consent === true;
  const hasBlueskyUsername = session?.user?.bluesky_username;
  const blueskyHandle = session?.user?.bluesky_handle || hasBlueskyUsername;
  const userId = session?.user?.id;

  // Si nous détectons un consentement nouvellement accordé et que le token est valide, lancer le test automatiquement
  useEffect(() => {
    if (hasDMConsent && blueskyHandle && isTokenValid === true && testStatus === 'idle' && !testingDM) {
      handleTestDM();
    }
  }, [hasDMConsent, blueskyHandle, isTokenValid, testStatus, testingDM]);

  // Gestion du changement de statut de chargement pendant la reconnexion
  const handleLoadingChange = (isLoading: boolean) => {
    if (!isLoading) {
      // Rafraîchir la vérification du token après reconnexion
      checkTokenValidity();
    }
  };

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

  const pollTaskStatus = async (taskId: string) => {
    try {
      let maxRetries = 10; // Réduire le nombre maximum de tentatives
      let retryCount = 0;
      
      const checkStatus = async () => {
        const response = await fetch(`/api/tasks/${taskId}`);
        
        if (!response.ok) {
          throw new Error('Failed to check task status');
        }
        
        const data = await response.json();
        console.log('Task status response:', data); // Log pour debugging
        
        // Extraire la tâche de la réponse
        const task = data.task || data;
        
        if (task.status === 'completed') {
          if (task.result && task.result.success) {
            setTestStatus('success');
          } else {
            setTestStatus('failed');
            
            // Obtenir le message d'erreur du résultat ou du log d'erreur
            const errorMessage = task.result && task.result.error 
              ? task.result.error 
              : task.error_log && typeof task.error_log === 'string'
                ? task.error_log
                : 'Task completed with unknown error';
            
            // Vérifier si l'erreur est liée au besoin de suivre la plateforme
            if ((task.result && task.result.needs_follow) || 
                errorMessage.includes('recipient does not follow') ||
                errorMessage.includes('recipient requires incoming messages to come from someone they follow')) {
              setError({ type: 'needsFollow', message: t('followMessageError') });
              setShowFollowButton(true);
            } 
            // Vérifier si l'erreur est liée aux messages désactivés
            else if (errorMessage.includes('recipient has disabled incoming messages')) {
              setError({ type: 'messagesDisabled', message: t('messagesDisabledError') || 'The recipient has disabled incoming messages.' });
              setShowEmailForm(true); // Afficher le formulaire d'email
            }
            else {
              setError({ type: 'generic', message: errorMessage });
            }
          }
          
          setTestingDM(false);
        } else if (task.status === 'failed') {
          setTestStatus('failed');
          
          // Extraire le message d'erreur du champ error_log si disponible
          let errorMessage = task.error || 'Task failed';
          
          if (task.error_log && typeof task.error_log === 'string') {
            // Vérifier si l'erreur est liée aux messages désactivés
            if (task.error_log.includes('recipient has disabled incoming messages')) {
              setError({ type: 'messagesDisabled', message: t('messagesDisabledError') || 'The recipient has disabled incoming messages.' });
              setShowEmailForm(true);
              setTestingDM(false);
              return;
            }
            // Vérifier si l'erreur est liée au besoin de suivre la plateforme
            else if (task.error_log.includes('recipient does not follow') || 
                     task.error_log.includes('recipient requires incoming messages to come from someone they follow')) {
              setError({ type: 'needsFollow', message: t('followMessageError') });
              setShowFollowButton(true);
              setTestingDM(false);
              return;
            }
            // Utiliser le message d'erreur du log pour les autres cas
            else {
              errorMessage = task.error_log;
            }
          }
          
          setError({ type: 'generic', message: errorMessage });
          setTestingDM(false);
        } else if (task.status === 'error') { // Nouveau cas pour les erreurs explicites
          setTestStatus('failed');
          setError({ type: 'generic', message: task.error || 'Task encountered an error' });
          setTestingDM(false);
        } else if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkStatus, 2000); // Augmenter le temps entre les tentatives
        } else {
          setTestStatus('failed');
          setError({ type: 'generic', message: 'Timeout checking task status' });
          setTestingDM(false);
        }
      };
      
      await checkStatus();
      
    } catch (error) {
      console.error('Error polling task status:', error);
      setError({ type: 'generic', message: String(error) });
      setTestStatus('failed');
      setTestingDM(false);
    }
  };

  const handleFollowPlatform = async () => {
    try {
      // Utiliser la nouvelle API dédiée pour suivre le bot
      const response = await fetch('/api/newsletter/follow_bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error following platform:', data.error);
        // Ouvrir la page du profil en fallback pour que l'utilisateur puisse suivre manuellement
        window.open('https://bsky.app/profile/helloqitto.bsky.social', '_blank');
        return;
      }
      
      // Réinitialiser l'état pour permettre de retester le DM
      setError(null);
      setShowFollowButton(false);
      setTestingDM(false);
      setTestStatus('idle');
      setDmResult(null);
      
    } catch (error) {
      console.error('Error sending follow request:', error);
      // Fallback au comportement précédent en cas d'erreur
      window.open('https://bsky.app/profile/helloqitto.bsky.social', '_blank');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Valider l'email
    if (!email || !isValidEmail(email)) {
      setEmailError(t('emailInvalid') || 'Please enter a valid email address');
      return;
    }
    
    setEmailError('');
    setSubmittingEmail(true);
    
    try {
      // Envoyer la requête à l'API newsletter
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          acceptHQX: true,
          acceptOEP,
          research_accepted: acceptResearch,
          hqx_newsletter: hqxNewsletter,
          have_seen_newsletter: true
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        setEmailError(data.error || 'Failed to subscribe');
        setSubmittingEmail(false);
        return;
      }
      
      // Succès
      setEmailSubmitSuccess(true);
      setSubmittingEmail(false);
      
      // Réinitialiser le formulaire après 3 secondes
      setTimeout(() => {
        setShowEmailForm(false);
        setEmail('');
        setAcceptOEP(false);
        setAcceptResearch(false);
        setEmailSubmitSuccess(false);
        setError(null);
        setTestStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting email:', error);
      setEmailError('An error occurred. Please try again.');
      setSubmittingEmail(false);
    }
  };
  
  const handleSwitchChange = (type: 'research' | 'oep' | 'newsletter', value: boolean) => {
    if (type === 'research') {
      setAcceptResearch(value);
    } else if (type === 'oep') {
      setAcceptOEP(value);
    } else {
      setHqxNewsletter(value);
    }
  };

  if (!hasDMConsent || !blueskyHandle) {
    return null;
  }

  if (!isTokenValid) {
    return (
      <PartialConnectedServicesState
        invalidProviders={invalidProviders}
        mastodonInstances={mastodonInstances}
        onLoadingChange={handleLoadingChange}
      />
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div className="flex flex-col p-4 sm:p-6 bg-white rounded-2xl shadow-lg w-full max-w-md mx-4">
            <div className="flex flex-col space-y-4 sm:space-y-6">
            <h2 className={`${plex.className} text-lg text-black font-semibold`}>{t('title')}</h2>
              <p className={`${plex.className} text-sm text-gray-700`}>{t('description')}</p>
            
              {!showEmailForm && testStatus !== 'success' && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${plex.className} flex justify-center items-center py-3 px-6 bg-[#2a39a9] text-white rounded-full font-bold transition-colors focus:outline-none ${testStatus === 'testing' ? 'opacity-75 cursor-not-allowed' : ''}`}
                  onClick={handleTestDM}
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? t('testing') : t('testDM')}
                </motion.button>
              )}
              {showFollowButton && (
                <>
                  <div className={`${plex.className} text-amber-600 p-3 bg-amber-50 rounded-md text-sm`}>
                    {error?.message}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`${plex.className} flex justify-center items-center py-3 px-6 bg-[#d6356f] text-white rounded-full font-bold transition-colors focus:outline-none`}
                    onClick={handleFollowPlatform}
                  >
                    {t('followPlatform')}
                  </motion.button>
                </>
              )}
              
              {/* Afficher le message d'erreur quand les messages sont désactivés */}
              {error?.type === 'messagesDisabled' && !emailSubmitSuccess && (
                <div className={`${plex.className} text-amber-600 p-3 bg-amber-50 rounded-md text-sm`}>
                  {error?.message}
                </div>
              )}
              
              {/* Formulaire d'abonnement par email */}
              {showEmailForm && !emailSubmitSuccess && (
                <form onSubmit={handleEmailSubmit} className="bg-gray-50 p-4 rounded-lg space-y-4 mt-2 w-full">
                  <h3 className={`${plex.className} font-medium text-base`}>{t('subscribeByEmail')}</h3>
                  <p className={`${plex.className} text-xs sm:text-sm text-gray-600`}>{t('subscribeByEmailDescription')}</p>
                  
                  <div>
                    <label className={`${plex.className} block text-sm font-medium text-gray-700 mb-1`}>
                      {t('emailLabel')}
                    </label>
                    <input
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {emailError && <p className={`${plex.className} text-red-500 text-xs mt-1`}>{emailError}</p>}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Switch
                        checked={hqxNewsletter}
                        onChange={(newValue) => handleSwitchChange('newsletter', newValue)}
                        className={`${
                          hqxNewsletter ? 'bg-[#2a39a9]' : 'bg-gray-200'
                        } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                      >
                        <span
                          className={`${
                            hqxNewsletter ? 'translate-x-[22px]' : 'translate-x-[2px]'
                          } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                      <span className={`${plex.className} text-xs sm:text-sm text-gray-700 text-left`}>
                        {t('newsLetterSwitch')}
                      </span>
                    </div>
                    
                    {/* <div className="flex items-center space-x-3">
                      <Switch
                        checked={acceptOEP}
                        onChange={(newValue) => handleSwitchChange('oep', newValue)}
                        className={`${
                          acceptOEP ? 'bg-[#2a39a9]' : 'bg-gray-200'
                        } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                      >
                        <span
                          className={`${
                            acceptOEP ? 'translate-x-[22px]' : 'translate-x-[2px]'
                          } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                      <span className={`${plex.className} text-xs sm:text-sm text-gray-700 text-left`}>
                        {t('oepConsent')}
                      </span>
                    </div> */}
                    
                    {/* <div className="flex items-center space-x-3">
                      <Switch
                        checked={acceptResearch}
                        onChange={(newValue) => handleSwitchChange('research', newValue)}
                        className={`${
                          acceptResearch ? 'bg-[#2a39a9]' : 'bg-gray-200'
                        } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                      >
                        <span
                          className={`${
                            acceptResearch ? 'translate-x-[22px]' : 'translate-x-[2px]'
                          } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                      <span className={`${plex.className} text-xs sm:text-sm text-gray-700 text-left`}>
                        {t('researchConsent')}
                      </span>
                    </div> */}
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={submittingEmail}
                    className={`${plex.className} w-full flex justify-center items-center py-3 px-6 bg-[#d6356f] text-white rounded-full font-bold transition-colors focus:outline-none ${submittingEmail ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {submittingEmail ? t('submitting') : t('subscribe')}
                  </motion.button>
                </form>
              )}
              
              {/* Message de succès après soumission de l'email */}
              {emailSubmitSuccess && (
                <div className={`${plex.className} p-4 bg-green-50 text-green-700 rounded-lg text-sm`}>
                  {t('subscriptionSuccess')}
                </div>
              )}
              
              {testStatus === 'success' && (
                <div className={`${plex.className} p-4 bg-green-50 text-green-700 rounded-lg text-sm`}>
                  {t('dmSuccess')}
                </div>
              )}
              
              {error?.type === 'generic' && (
                <div className={`${plex.className} p-4 bg-red-50 text-red-700 rounded-lg text-sm`}>
                  {error.message}
                </div>
              )}
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`${plex.className} flex justify-center items-center py-3 px-6 bg-gray-500 text-white rounded-full font-bold transition-colors focus:outline-none`}
                onClick={onClose}
              >
                {t('close')}
              </motion.button>
              
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 transition-colors"
                onClick={onClose}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
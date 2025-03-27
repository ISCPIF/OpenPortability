'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { plex } from '@/app/fonts/plex';
import { CheckCircle2, XCircle, Loader2, MessageSquare, AlertTriangle } from 'lucide-react';

interface PersonalizedSupportFlowSectionProps {
  userId: string;
  blueskyHandle: string | null;
  hasPersonalizedSupport: boolean;
  hasBlueskyDM: boolean;
  onDMConsentChange: (type: 'bluesky_dm', value: boolean) => Promise<void>;
}

// Type pour les erreurs de test DM
interface TaskErrorType {
  type: 'generic' | 'needsFollow' | 'messagesDisabled';
  message?: string;
}

export default function PersonalizedSupportFlowSection({
  userId,
  blueskyHandle,
  hasPersonalizedSupport,
  hasBlueskyDM,
  onDMConsentChange,
}: PersonalizedSupportFlowSectionProps) {
  const t = useTranslations('settings');
  const [testingDM, setTestingDM] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<TaskErrorType | null>(null);
  const [showFollowButton, setShowFollowButton] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showMessagesDisabledWarning, setShowMessagesDisabledWarning] = useState(false);
  const [shouldShowComponent, setShouldShowComponent] = useState(true);

  // Vérifier si les conditions sont remplies pour afficher ce composant
  const initialShouldShowComponent = hasPersonalizedSupport && blueskyHandle;

  // Initialiser shouldShowComponent en prenant en compte hasBlueskyDM
  useEffect(() => {
    // Si l'utilisateur a déjà activé bluesky_dm, ne pas afficher ce composant
    setShouldShowComponent(hasPersonalizedSupport && blueskyHandle && !hasBlueskyDM);
  }, [hasPersonalizedSupport, blueskyHandle, hasBlueskyDM]);

  // Fonction pour tester l'envoi de DM
  const handleTestDM = async () => {
    if (!userId || !blueskyHandle || testingDM) return;
    
    setTestingDM(true);
    setTestStatus('testing');
    setError(null);
    setShowFollowButton(false);
    setShowMessagesDisabledWarning(false);
    
    try {
      const response = await fetch('/api/bluesky/test-dm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          handle: blueskyHandle,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setTestStatus('failed');
        setError({ type: 'generic', message: errorData.error });
        setTestingDM(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.task_id) {
        setTaskId(data.task_id);
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

  // Fonction pour suivre le bot
  const handleFollowBot = async () => {
    try {
      setShowFollowButton(false);
      
      const response = await fetch('/api/newsletter/follow_bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error following bot:', errorData);
        return;
      }
      
      // Relancer le test DM après avoir suivi le bot
      await handleTestDM();
    } catch (error) {
      console.error('Error following bot:', error);
    }
  };

  // Fonction pour vérifier l'état de la tâche
  const pollTaskStatus = async (taskId: string) => {
    const maxAttempts = 30;
    let attempts = 0;
    
    console.log('Starting to poll task status for task ID:', taskId);
    
    const checkStatus = async () => {
      try {
        console.log(`Checking task status (attempt ${attempts + 1}/${maxAttempts})...`);
        
        const response = await fetch(`/api/tasks/${taskId}`);
        
        console.log('API response status:', response.status);
        
        if (!response.ok) {
          console.error('API response not OK:', response.status, response.statusText);
          throw new Error(`Failed to fetch task status: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('API response data:', JSON.stringify(responseData, null, 2));
        
        // Vérifier que la réponse contient les données de la tâche
        if (!responseData.success || !responseData.task) {
          console.error('Invalid response format:', responseData);
          throw new Error(`Invalid response format: ${JSON.stringify(responseData)}`);
        }
        
        const data = responseData.task;
        
        console.log('Task status:', data.status);
        console.log('Task data:', JSON.stringify(data, null, 2));
        
        if (data.status === 'completed') {
          console.log('Task completed!');
          
          // Gérer à la fois les cas où result est un objet ou une chaîne JSON
          let result;
          if (typeof data.result === 'string') {
            try {
              result = JSON.parse(data.result || '{}');
              console.log('Parsed result from string:', result);
            } catch (e) {
              console.error('Error parsing result string:', e, 'Raw result:', data.result);
              result = {};
            }
          } else {
            // Le résultat est déjà un objet JavaScript
            result = data.result || {};
            console.log('Result is already an object:', result);
          }
          
          if (result.success) {
            console.log('Task successful!');
            setTestStatus('success');
            
            // Activer l'option bluesky_dm sans afficher ce composant
            if (!hasBlueskyDM) {
              console.log('Enabling bluesky_dm consent');
              await onDMConsentChange('bluesky_dm', true);
              
              // Actualiser les préférences pour mettre à jour SwitchSettingsSection
              await refreshPreferences();
              
              // Masquer ce composant après un court délai pour montrer le message de succès
              setTimeout(() => {
                setShouldShowComponent(false);
              }, 3000);
            }
          } else {
            console.log('Task failed with result:', result);
            setTestStatus('failed');
            
            if (result.needs_follow) {
              console.log('User needs to follow the bot');
              setError({ type: 'needsFollow' });
              setShowFollowButton(true);
            } else if (result.messages_disabled) {
              console.log('Messages are disabled for the user');
              setError({ type: 'messagesDisabled' });
              setShowMessagesDisabledWarning(true);
            } else {
              console.log('Generic error:', result.error || 'Unknown error');
              setError({ type: 'generic', message: result.error || 'Unknown error' });
            }
          }
          setTestingDM(false);
          return true;
        } else if (data.status === 'failed') {
          console.log('Task failed with status "failed"');
          setTestStatus('failed');
          setError({ type: 'generic', message: data.error || 'Task failed' });
          setTestingDM(false);
          return true;
        } else {
          console.log('Task still in progress, status:', data.status);
        }
        
        return false;
      } catch (error) {
        console.error('Error checking task status:', error);
        setTestStatus('failed');
        setError({ type: 'generic', message: String(error) });
        setTestingDM(false);
        return true;
      }
    };
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.log(`Max attempts (${maxAttempts}) reached, giving up`);
        setTestStatus('failed');
        setError({ type: 'generic', message: 'Timeout checking task status' });
        setTestingDM(false);
        return;
      }
      
      console.log(`Poll attempt ${attempts + 1}/${maxAttempts}`);
      
      const done = await checkStatus();
      
      if (!done) {
        attempts++;
        console.log(`Task not done yet, waiting 2 seconds before next attempt (${attempts}/${maxAttempts})`);
        setTimeout(poll, 2000);
      } else {
        console.log('Task polling completed');
      }
    };
    
    await poll();
  };

  // Fonction pour actualiser les préférences depuis l'API
  const refreshPreferences = async () => {
    try {
      console.log('Refreshing preferences from API...');
      
      // Première étape : invalider le cache en faisant une requête avec un timestamp
      const timestamp = Date.now();
      const response = await fetch(`/api/newsletter/request?_=${timestamp}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        console.error('Failed to refresh preferences:', response.status, response.statusText);
        return;
      }

      // Deuxième étape : extraire et traiter les données
      const data = await response.json();
      console.log('Preferences refreshed successfully:', data);
      
      // Troisième étape : mettre à jour manuellement l'état local si nécessaire
      // (cela peut être utile si le hook useNewsLetter ne détecte pas les changements)
      if (data && data.bluesky_dm === true && !hasBlueskyDM) {
        console.log('Detected bluesky_dm is now enabled, updating local state');
        // Force une actualisation de la page après un court délai
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error('Error refreshing preferences:', error);
    }
  };

  // Ne pas rendre le composant si les conditions ne sont pas remplies
  if (!shouldShowComponent) {
    return null;
  }

  return (
    <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm border border-white/20 mb-6">
      <h3 className={`${plex.className} text-lg font-medium text-white mb-4`}>
        {t('notifications.personalizedSupport.title')}
      </h3>
      
      <div className="text-sm text-white/80 mb-6">
        <p>{t('notifications.personalizedSupport.description')}</p>
      </div>
      
      <div className="space-y-6">
        {/* État du test */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {testStatus === 'idle' && (
                <MessageSquare className="w-6 h-6 text-blue-400" />
              )}
              {testStatus === 'testing' && (
                <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
              )}
              {testStatus === 'success' && (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              )}
              {testStatus === 'failed' && (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
            </div>
            
            <div className="flex-grow">
              <h4 className={`${plex.className} text-sm font-medium text-white`}>
                {testStatus === 'idle' && t('notifications.personalizedSupport.testDM.idle')}
                {testStatus === 'testing' && t('notifications.personalizedSupport.testDM.testing')}
                {testStatus === 'success' && t('notifications.personalizedSupport.testDM.success')}
                {testStatus === 'failed' && t('notifications.personalizedSupport.testDM.failed')}
              </h4>
              
              {error && (
                <p className="text-xs text-red-300 mt-1">
                  {error.type === 'needsFollow' && t('notifications.errors.needsFollow')}
                  {error.type === 'messagesDisabled' && t('notifications.errors.messagesDisabled.title')}
                  {error.type === 'generic' && (error.message || t('notifications.errors.generic'))}
                </p>
              )}
              
              {testStatus === 'success' && (
                <p className="text-xs text-green-300 mt-1">
                  {t('notifications.personalizedSupport.testDM.successDetail')}
                </p>
              )}
            </div>
          </div>
          
          <div className={`${plex.className} mt-4 flex flex-wrap gap-3`}>
            {testStatus !== 'testing' && (
              <button
                onClick={handleTestDM}
                disabled={testingDM}
                className={`${plex.className} px-4 py-2 bg-[#d6356f] text-white rounded-full text-sm font-medium hover:bg-[#e6457f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                {/* <MessageSquare className="w-4 h-4" /> */}
                {testStatus === 'idle' && t('notifications.personalizedSupport.actions.testDM')}
                {testStatus === 'success' && t('notifications.personalizedSupport.actions.testAgain')}
                {testStatus === 'failed' && t('notifications.personalizedSupport.actions.retry')}
              </button>
            )}
            
            {showFollowButton && (
              <a
                href="https://bsky.app/profile/openportability.bsky.social"
                target="_blank"
                rel="noopener noreferrer"
                className={`${plex.className} px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('notifications.actions.followBot')}
              </a>
            )}
          </div>
        </div>
        
        {/* Alerte messages désactivés */}
        {showMessagesDisabledWarning && (
          <div className="bg-amber-950/30 rounded-lg p-4 border border-amber-500/30 mt-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className={`${plex.className} text-sm font-medium text-white`}>
                  {t('notifications.errors.messagesDisabled.title')}
                </h4>
                <p className="text-xs text-white/80 mt-1">
                  {t('notifications.errors.messagesDisabled.description')}
                </p>
                <a
                  href="https://bsky.app/settings/app-passwords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-300 hover:text-blue-200 mt-2 inline-block"
                >
                  {t('notifications.errors.messagesDisabled.link')}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
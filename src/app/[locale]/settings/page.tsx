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
import PersonalizedSupportFlowSection from '@/app/_components/settings/PersonalizedSupportFlowSection';

export default function SettingsPage() {
  const t = useTranslations('settings');
  
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
            
            {/* Composant de flux pour le support personnalisé */}
            <PersonalizedSupportFlowSection
              consents={consents}
              onConsentChange={updateConsent}
            />
            
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
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
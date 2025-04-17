'use client';

import { Switch } from '@headlessui/react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { ConsentType } from '@/hooks/useNewsLetter';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface SwitchSettingsSectionProps {
  consents: { [key in ConsentType]?: boolean };
  onConsentChange: (type: ConsentType, value: boolean) => Promise<void>;
  showEmailForm: boolean;
  setShowEmailForm: (show: boolean) => void;
  email: string;
  setEmail: (email: string) => void;
  emailError: string;
  setEmailError: (error: string) => void;
  handleEmailSubmit: () => Promise<void>;
  isSubmittingEmail: boolean;
}

const CustomToast = ({ platform, message, buttonText }: { platform: string; message: string; buttonText: string }) => (
  <div className={`${plex.className} flex flex-col space-y-3 p-4 bg-[#d6356f] text-white rounded-lg`}>
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 bg-white rounded-full" />
      <span className="font-medium text-white/90">{platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}</span>
    </div>
    <p className="text-sm text-white/80">{message}</p>
    <button 
      onClick={() => window.location.href = '/dashboard'}
      className="px-4 py-2 bg-white text-[#d6356f] rounded-md text-sm font-medium hover:bg-white/90 transition-colors"
    >
      {buttonText}
    </button>
  </div>
);

export default function SwitchSettingsSection({
  consents,
  onConsentChange,
  showEmailForm,
  setShowEmailForm,
  email,
  setEmail,
  emailError,
  setEmailError,
  handleEmailSubmit,
  isSubmittingEmail,
}: SwitchSettingsSectionProps) {
  const t = useTranslations('settings');
  const { data: session } = useSession();

  const handleDMConsentChange = (platform: 'bluesky' | 'mastodon', value: boolean) => {
    if (!value) {
      onConsentChange(`${platform}_dm` as ConsentType, false);
      return;
    }

    const hasAccount = platform === 'bluesky' 
      ? !!session?.user?.bluesky_username
      : !!session?.user?.mastodon_username;

    if (!hasAccount) {
      toast.custom((id) => (
        <CustomToast 
          platform={platform}
          message={t(`notifications.${platform}Dm.connectRequiredDescription`)}
          buttonText={t(`notifications.${platform}Dm.goToDashboard`)}
        />
      ), {
        position: 'top-right',
        duration: 10000,
      });
      return;
    }

    onConsentChange(`${platform}_dm` as ConsentType, true);
  };

  console.log("CONSENTS FRONT SWITCH", consents)
  const renderSwitch = (
    type: ConsentType,
    title: string,
    description: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    srText?: string
  ) => (
    <div className="flex items-center justify-between w-full bg-white/5 p-4 rounded-lg backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
      <div className="flex-grow pr-6">
        <h3 className={`${plex.className} text-sm font-medium text-white`}>{title}</h3>
        <p className="text-xs text-white/70 mt-2 text-justify">{description}</p>
      </div>
      <div className="flex-shrink-0">
        <Switch
          checked={checked}
          onChange={onChange}
          className={`${
            checked ? 'bg-[#d6356f]' : 'bg-gray-700'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#d6356f] focus:ring-offset-2 focus:ring-offset-[#2a39a9]`}
        >
          <span className="sr-only">{srText || title}</span>
          <span
            className={`${
              checked ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Newsletter HelloQuitteX */}
      <div className="space-y-4">
        {renderSwitch(
          'email_newsletter',
          t('notifications.hqxNewsletter.title'),
          t('notifications.hqxNewsletter.description'),
          consents?.email_newsletter ?? false,
          (value) => {
            onConsentChange('email_newsletter', value);
            if (value) {
              setShowEmailForm(true);
            } else {
              setShowEmailForm(false);
            }
          }
        )}

        {showEmailForm && (
          <div className="ml-6 space-y-4 border-l-2 border-white/20 pl-6">
            <div className="flex flex-col space-y-3">
              <label htmlFor="email" className={`${plex.className} text-sm font-medium text-white`}>
                {t('emailLabel')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                }}
                placeholder={t('emailPlaceholder')}
                className={`w-full px-4 py-3 bg-white/5 border ${
                  emailError ? 'border-red-500' : 'border-white/20'
                } rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#d6356f] focus:border-transparent backdrop-blur-sm`}
              />
              {emailError && (
                <p className="text-xs text-red-500 mt-1">{emailError}</p>
              )}
            </div>
            <button
              onClick={handleEmailSubmit}
              disabled={isSubmittingEmail}
              className={`${plex.className} w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-[#d6356f] text-white rounded-full disabled:opacity-50 hover:bg-[#e6457f] transition-colors font-medium`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">{t('save')}</span>
            </button>
          </div>
        )}
      </div>

      {/* OEP Newsletter */}
      {renderSwitch(
        'oep_newsletter',
        t('notifications.oepNewsletter.title'),
        t('notifications.oepNewsletter.description'),
        consents?.oep_newsletter ?? false,
        (value) => onConsentChange('oep_newsletter', value)
      )}

      {/* Research Participation */}
      {renderSwitch(
        'research_participation',
        t('notifications.research.title'),
        t('notifications.research.description'),
        consents?.research_participation ?? false,
        (value) => onConsentChange('research_participation', value)
      )}

      {/* Personalized Support */}
      {renderSwitch(
        'personalized_support',
        t('notifications.personalizedSupport.title'),
        t('notifications.personalizedSupport.description'),
        consents?.personalized_support ?? false,
        (value) => onConsentChange('personalized_support', value)
      )}

      {/* Sub-switches for personalized support */}
      {consents?.personalized_support && (
        <div className="ml-6 space-y-4 border-l-2 border-white/20 pl-6">
          {renderSwitch(
            'bluesky_dm',
            t('notifications.blueskyDm.title'),
            t('notifications.blueskyDm.description'),
            consents?.bluesky_dm ?? false,
            (value) => handleDMConsentChange('bluesky', value)
          )}
          {renderSwitch(
            'mastodon_dm',
            t('notifications.mastodonDm.title'),
            t('notifications.mastodonDm.description'),
            consents?.mastodon_dm ?? false,
            (value) => handleDMConsentChange('mastodon', value)
          )}
        </div>
      )}
    </div>
  );
}
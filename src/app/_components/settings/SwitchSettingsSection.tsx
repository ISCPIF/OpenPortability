'use client';

import { Switch } from '@headlessui/react';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';

interface SwitchSettingsSectionProps {
  apiPreferences: {
    hqx_newsletter?: boolean;
    personalized_support?: boolean;
    bluesky_dm?: boolean;
    mastodon_dm?: boolean;
    oep_accepted?: boolean;
    research_accepted?: boolean;
  };
  onSwitchChange: (type: 'research' | 'oep' | 'personalized_support' | 'hqx', value: boolean) => Promise<void>;
  onDMConsentChange: (type: 'bluesky_dm' | 'mastodon_dm' | 'email_newsletter', value: boolean) => Promise<void>;
  showEmailForm: boolean;
  setShowEmailForm: (show: boolean) => void;
  email: string;
  setEmail: (email: string) => void;
  emailError: string;
  setEmailError: (error: string) => void;
  handleEmailSubmit: () => Promise<void>;
  isSubmittingEmail: boolean;
}

export default function SwitchSettingsSection({
  apiPreferences,
  onSwitchChange,
  onDMConsentChange,
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

  const renderSwitch = (
    title: string,
    description: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    srText?: string
  ) => (
    <div className="flex items-center justify-between w-full">
      <div className="flex-grow pr-4">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="text-xs text-white/60 mt-1">{description}</p>
      </div>
      <div className="flex-shrink-0">
        <Switch
          checked={checked}
          onChange={onChange}
          className={`${
            checked ? 'bg-[#d6356f]' : 'bg-gray-700'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
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
          t('notifications.hqxNewsletter.title'),
          t('notifications.hqxNewsletter.description'),
          apiPreferences.hqx_newsletter || false,
          (value) => {
            if (value) {
              onSwitchChange('hqx', value);
              setShowEmailForm(true);
            } else {
              onSwitchChange('hqx', value);
              setShowEmailForm(false);
            }
          }
        )}

        {showEmailForm && (
          <div className="ml-6 space-y-4 border-l-2 border-white/10 pl-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
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
                className={`w-full px-3 py-2 bg-white/10 border ${
                  emailError ? 'border-red-500' : 'border-white/20'
                } rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#d6356f] focus:border-transparent`}
              />
              {emailError && (
                <p className="text-xs text-red-500 mt-1">{emailError}</p>
              )}
            </div>
            <button
              onClick={handleEmailSubmit}
              disabled={isSubmittingEmail}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#d6356f] text-white rounded-full disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">{t('save')}</span>
            </button>
          </div>
        )}

        {/* Accompagnement personnalisé */}
        {renderSwitch(
          t('notifications.personalizedSupport.title'),
          t('notifications.personalizedSupport.description'),
          apiPreferences.personalized_support || false,
          (value) => onSwitchChange('personalized_support', value)
        )}

        {/* Options DM conditionnelles */}
        {apiPreferences.personalized_support && (
          <div className="ml-6 space-y-4 border-l-2 border-white/10 pl-4">
            {/* Bluesky DM */}
            {renderSwitch(
              t('notifications.blueskyDm.title'),
              t('notifications.blueskyDm.description'),
              apiPreferences.bluesky_dm || false,
              (value) => onDMConsentChange('bluesky_dm', value)
            )}

            {/* Mastodon DM */}
            {renderSwitch(
              t('notifications.mastodonDm.title'),
              t('notifications.mastodonDm.description'),
              apiPreferences.mastodon_dm || false,
              (value) => onDMConsentChange('mastodon_dm', value)
            )}
          </div>
        )}
      </div>

      {/* Newsletter OpenPortability */}
      {renderSwitch(
        t('notifications.oepNewsletter.title'),
        t('notifications.oepNewsletter.description'),
        apiPreferences.oep_accepted || false,
        (value) => onSwitchChange('oep', value)
      )}

      {/* Programme CNRS */}
      {renderSwitch(
        t('notifications.research.title'),
        t('notifications.research.description'),
        apiPreferences.research_accepted || false,
        (value) => onSwitchChange('research', value)
      )}
    </div>
  );
}
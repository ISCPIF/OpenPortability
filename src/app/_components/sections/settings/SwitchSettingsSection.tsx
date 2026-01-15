'use client';
import { Switch } from '@headlessui/react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, Settings, Bell, Zap } from 'lucide-react';
import { quantico } from '@/app/fonts/plex';
import { ConsentType } from '@/hooks/useNewsLetter';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';

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

type DivClickEvent = { stopPropagation: () => void };

const CustomToast = ({ platform, message, buttonText }: { platform: string; message: string; buttonText: string }) => (
  <div className={`${quantico.className} flex flex-col space-y-3 p-4 bg-slate-800 border border-amber-500/30 text-white rounded-lg shadow-lg`}>
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 bg-amber-400 rounded-full" />
      <span className="font-medium text-white text-[13px]">{platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}</span>
    </div>
    <p className="text-[12px] text-slate-300">{message}</p>
    <button 
      onClick={() => window.location.href = '/dashboard'}
      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-[12px] font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
    >
      {buttonText}
    </button>
  </div>
);

const WarningToast = ({ platform, message }: { platform: 'bluesky' | 'mastodon'; message: string }) => (
  <div className={`${quantico.className} flex flex-col space-y-3 p-4 bg-slate-800 border border-rose-500/30 text-white rounded-lg shadow-lg`}>
    <div className="flex items-center space-x-2">
      <AlertTriangle className="w-4 h-4 text-rose-400" />
      <span className="font-medium text-white text-[13px]">{platform === 'bluesky' ? 'Bluesky' : 'Mastodon'} DM</span>
    </div>
    <p className="text-[12px] text-slate-300">{message}</p>
    <div className="flex items-center space-x-2">
      <a
        href={platform === 'bluesky' 
          ? "https://bsky.app/profile/openportability.bsky.social" 
          : "https://mastodon.social/@openportability"}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-[11px] font-medium hover:bg-rose-500/30 transition-all"
      >
        {platform === 'bluesky' ? '@openportability.bsky.social' : '@OpenPortability@mastodon.social'}
      </a>
    </div>
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
  
  // Graph label consent state (separate from newsletter consents)
  const [graphLabelConsent, setGraphLabelConsent] = useState<boolean>(false);
  const [isLoadingGraphConsent, setIsLoadingGraphConsent] = useState(true);
  
  // Fetch current graph label consent on mount
  useEffect(() => {
    const fetchGraphConsent = async () => {
      try {
        const response = await fetch('/api/graph/consent_labels/user');
        if (response.ok) {
          const data = await response.json();
          setGraphLabelConsent(data.consent_level === 'all_consent');
        }
      } catch (error) {
        console.error('Failed to fetch graph consent:', error);
      } finally {
        setIsLoadingGraphConsent(false);
      }
    };
    fetchGraphConsent();
  }, []);
  
  // Handle graph label consent change
  const handleGraphLabelConsentChange = useCallback(async (value: boolean) => {
    // Optimistic UI: update state immediately
    setGraphLabelConsent(value);
    
    try {
      const response = await fetch('/api/graph/consent_labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_level: value ? 'all_consent' : 'no_consent' }),
      });
      
      if (response.ok) {
        toast.success(t('consentUpdate.success') ?? 'Consent updated');
        // Trigger server-side cache refresh in background (fire-and-forget)
        fetch('/api/graph/refresh-labels-cache', { method: 'POST' }).catch(() => {});
      } else {
        // Revert on error
        setGraphLabelConsent(!value);
        throw new Error('Failed to update consent');
      }
    } catch (error) {
      // Revert on error
      setGraphLabelConsent(!value);
      console.error('Failed to update graph consent:', error);
      toast.error(t('consentUpdate.error') ?? 'Failed to update consent');
    }
  }, [t]);

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

    toast.custom(() => (
      <WarningToast 
        platform={platform}
        message={t(`consentUpdate.${platform}DmWarning`)}
      />
    ), {
      position: 'top-right',
      duration: 8000,
    });

    onConsentChange(`${platform}_dm` as ConsentType, true);
  };

  const renderSwitch = (
    type: ConsentType,
    title: string,
    description: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    srText?: string
  ) => {
    return (
      <div
        className="relative w-full rounded-lg bg-slate-800/50 border border-slate-700/30 p-4 transition-all duration-200 cursor-pointer hover:bg-slate-800/70 hover:border-slate-600/50"
        onClick={() => onChange(!checked)}
      >
        <div className="flex flex-col gap-3">
          <div className="flex-1 min-w-0">
            <h3 className={`${quantico.className} text-[13px] font-medium mb-1.5 break-words ${checked ? 'text-amber-400' : 'text-white'}`}>
              {title}
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed break-words">
              {description}
            </p>
          </div>
          <div
            className="flex-shrink-0 pt-1 w-full flex justify-start sm:justify-end"
            onClick={(e: DivClickEvent) => {
              e.stopPropagation();
            }}
          >
            <Switch
              checked={checked}
              onChange={onChange}
              className={`relative w-11 h-6 rounded-full transition-all duration-200 ${checked ? 'bg-amber-500' : 'bg-slate-600'}`}
            >
              <span className="sr-only">{srText || title}</span>
              <span
                className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full bg-white shadow-sm"
                style={{
                  left: checked ? 'calc(100% - 22px)' : '2px',
                }}
              />
            </Switch>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700/30">
          <div className={`w-1.5 h-1.5 rounded-full ${checked ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          <span className={`${quantico.className} text-[10px] ${checked ? 'text-emerald-400' : 'text-slate-500'}`}>
            {checked ? t('active') ?? 'Active' : t('disabled') ?? 'Disabled'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={quantico.className}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Column 1: Consentement */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-blue-400" />
            <p className="text-[11px] text-white uppercase tracking-wider font-medium">{t('notifications.columnTitles.consents')}</p>
          </div>
          {renderSwitch(
            'research_participation',
            t('notifications.research.title'),
            t('notifications.research.description'),
            consents?.research_participation ?? false,
            (value) => onConsentChange('research_participation', value)
          )}

          {renderSwitch(
            'graph_label_consent' as ConsentType,
            t('notifications.graphLabel.title') ?? 'Display name on graph',
            t('notifications.graphLabel.description') ?? 'Allow your name to be visible to other users on the graph visualization',
            graphLabelConsent,
            handleGraphLabelConsentChange
          )}
        </div>

        {/* Column 2: Newsletter */}
        <div className="space-y-3 xl:border-l xl:border-slate-700/30 xl:pl-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-purple-400" />
            <p className="text-[11px] text-white uppercase tracking-wider font-medium">{t('notifications.columnTitles.notifications')}</p>
          </div>
          {renderSwitch(
            'email_newsletter',
            t('notifications.hqxNewsletter.title'),
            t('notifications.hqxNewsletter.description'),
            consents?.email_newsletter ?? false,
            (value) => {
              if (value && !consents?.email_newsletter) {
                setShowEmailForm(true);
              } else if (!value) {
                onConsentChange('email_newsletter', false);
                setShowEmailForm(false);
              }
            }
          )}

          {/* Mobile only: email form inline after newsletter switch */}
          {showEmailForm && (
            <div
              className="md:hidden rounded-lg border border-slate-700/30 bg-slate-800/30 p-4 space-y-3"
              onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
                e.stopPropagation();
              }}
              onClick={(e: MouseEvent<HTMLDivElement>) => {
                e.stopPropagation();
              }}
            >
              <div className="flex flex-col space-y-2">
                <label htmlFor="email-mobile" className="text-[12px] font-medium text-slate-300">
                  {t('emailLabel')}
                </label>
                <input
                  type="email"
                  id="email-mobile"
                  value={email}
                  onMouseDown={(e: MouseEvent<HTMLInputElement>) => {
                    e.stopPropagation();
                  }}
                  onClick={(e: MouseEvent<HTMLInputElement>) => {
                    e.stopPropagation();
                  }}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder={t('emailPlaceholder')}
                  className={`w-full px-3 py-2.5 text-[13px] rounded-lg bg-slate-800/50 border border-slate-700/30 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all ${
                    emailError ? 'border-rose-500/50' : ''
                  }`}
                />
                {emailError && <p className="text-[11px] text-rose-400 mt-1">{emailError}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onMouseDown={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                  }}
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    setShowEmailForm(false);
                    setEmailError('');
                  }}
                  disabled={isSubmittingEmail}
                  className="w-full px-5 py-2 rounded-lg border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50 disabled:opacity-50 transition-all text-slate-200 text-[12px] font-medium"
                >
                  {t('cancel') ?? 'Fermer'}
                </button>
                <button
                  onMouseDown={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                  }}
                  onClick={async (e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    if (!email.trim()) {
                      setEmailError(t('emailRequired'));
                      return;
                    }

                    try {
                      await onConsentChange('email_newsletter', true);
                      await handleEmailSubmit();
                    } catch (error) {
                      console.error('Error updating email newsletter consent:', error);
                    }
                  }}
                  disabled={isSubmittingEmail}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all text-white text-[12px] font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('save')}</span>
                </button>
              </div>
            </div>
          )}

          {renderSwitch(
            'oep_newsletter',
            t('notifications.oepNewsletter.title'),
            t('notifications.oepNewsletter.description'),
            consents?.oep_newsletter ?? false,
            (value) => onConsentChange('oep_newsletter', value)
          )}
        </div>

        {/* Column 3: Recommandations */}
        <div className="space-y-3 xl:border-l xl:border-slate-700/30 xl:pl-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <p className="text-[11px] text-white uppercase tracking-wider font-medium">{t('notifications.columnTitles.automations')}</p>
          </div>
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
      </div>

      {/* Desktop only: email form at bottom */}
      {showEmailForm && (
        <div
          className="hidden md:block mt-4 rounded-lg border border-slate-700/30 bg-slate-800/30 p-4 space-y-3"
          onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
            e.stopPropagation();
          }}
          onClick={(e: MouseEvent<HTMLDivElement>) => {
            e.stopPropagation();
          }}
        >
          <div className="flex flex-col space-y-2">
            <label htmlFor="email" className="text-[12px] font-medium text-slate-300">
              {t('emailLabel')}
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onMouseDown={(e: MouseEvent<HTMLInputElement>) => {
                e.stopPropagation();
              }}
              onClick={(e: MouseEvent<HTMLInputElement>) => {
                e.stopPropagation();
              }}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setEmail(e.target.value);
                setEmailError('');
              }}
              placeholder={t('emailPlaceholder')}
              className={`w-full px-3 py-2.5 text-[13px] rounded-lg bg-slate-800/50 border border-slate-700/30 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all ${
                emailError ? 'border-rose-500/50' : ''
              }`}
            />
            {emailError && <p className="text-[11px] text-rose-400 mt-1">{emailError}</p>}
          </div>
          <div className="flex flex-row gap-2 justify-start">
            <button
              onMouseDown={(e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
              }}
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                setShowEmailForm(false);
                setEmailError('');
              }}
              disabled={isSubmittingEmail}
              className="w-auto px-5 py-2 rounded-lg border border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/50 disabled:opacity-50 transition-all text-slate-200 text-[12px] font-medium"
            >
              {t('cancel') ?? 'Fermer'}
            </button>
            <button
              onMouseDown={(e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
              }}
              onClick={async (e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                if (!email.trim()) {
                  setEmailError(t('emailRequired'));
                  return;
                }

                try {
                  await onConsentChange('email_newsletter', true);
                  await handleEmailSubmit();
                } catch (error) {
                  console.error('Error updating email newsletter consent:', error);
                }
              }}
              disabled={isSubmittingEmail}
              className="w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all text-white text-[12px] font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('save')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
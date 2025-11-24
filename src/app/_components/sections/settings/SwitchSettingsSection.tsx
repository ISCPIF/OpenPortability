'use client';
import { Switch } from '@headlessui/react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { ConsentType } from '@/hooks/useNewsLetter';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

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

const WarningToast = ({ platform, message }: { platform: 'bluesky' | 'mastodon'; message: string }) => (
  <div className={`${plex.className} flex flex-col space-y-3 p-4 bg-red-600 text-white rounded-lg`}>
    <div className="flex items-center space-x-2">
      <AlertTriangle className="w-5 h-5 text-white" />
      <span className="font-medium text-white/90">{platform === 'bluesky' ? 'Bluesky' : 'Mastodon'} DM</span>
    </div>
    <p className="text-sm text-white/90">{message}</p>
    <div className="flex items-center space-x-2">
      <a
        href={platform === 'bluesky' 
          ? "https://bsky.app/profile/openportability.bsky.social" 
          : "https://mastodon.social/@openportability"}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-white text-red-600 rounded-md text-sm font-medium hover:bg-white/90 transition-colors"
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
  const { isDark } = useTheme();

  const neonPink = '#ff007f';
  const neonBlue = '#007bff';
  const columnBorderClass = isDark ? 'lg:border-white/10' : 'lg:border-slate-200';
  const columnDividerShadow = isDark ? 'lg:shadow-[inset_20px_0_50px_rgba(15,23,42,0.35)]' : 'lg:shadow-[inset_20px_0_50px_rgba(15,23,42,0.08)]';
  const columnHeadingClass = `${plex.className} text-xs tracking-[0.35em] uppercase mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`;

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
    const borderColor = checked ? neonPink : neonBlue;
    const textColor = checked ? neonPink : neonBlue;
    const baseBg = isDark ? 'bg-slate-900/70' : 'bg-white/95';

    return (
      <div
        className={`relative w-full rounded-2xl border-[1.5px] p-5 sm:p-6 transition-all duration-300 group cursor-pointer backdrop-blur-xl ${baseBg}`}
        style={{
          borderColor,
          boxShadow: checked
            ? '0 0 18px rgba(255,0,127,0.35), inset 0 0 18px rgba(255,0,127,0.08)'
            : '0 0 18px rgba(0,123,255,0.25), inset 0 0 18px rgba(0,123,255,0.05)'
        }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="absolute inset-x-4 top-0 h-px"
          style={{
            backgroundImage: `linear-gradient(90deg, ${borderColor}, transparent)`,
            opacity: 0.5
          }}
        />
        <div className="flex flex-col gap-4">
          <div className="flex-1 min-w-0">
            <h3
              className={`${plex.className} tracking-[0.2em] text-xs sm:text-sm mb-2`}
              style={{
                color: textColor,
                textShadow: `0 0 12px ${textColor}`,
                fontFamily: 'monospace'
              }}
            >
              {title}
            </h3>
            <p
              className="text-xs leading-relaxed break-words"
              style={{
                color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.7)',
                fontFamily: 'monospace'
              }}
            >
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
              className="relative w-14 h-7 rounded-full transition-all duration-300"
              style={{
                backgroundColor: checked ? 'rgba(255,0,127,0.18)' : 'rgba(0,123,255,0.2)',
                border: `2px solid ${borderColor}`,
                boxShadow: checked
                  ? '0 0 18px rgba(255,0,127,0.5), inset 0 0 12px rgba(255,0,127,0.25)'
                  : '0 0 18px rgba(0,123,255,0.5), inset 0 0 12px rgba(0,123,255,0.2)'
              }}
            >
              <span className="sr-only">{srText || title}</span>
              <span
                className="absolute top-0.5 transition-all duration-300 w-5 h-5 rounded-full"
                style={{
                  left: checked ? 'calc(100% - 22px)' : '2px',
                  backgroundColor: borderColor,
                  boxShadow: `0 0 12px ${borderColor}, 0 0 25px ${borderColor}`
                }}
              />
            </Switch>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              backgroundColor: borderColor,
              boxShadow: `0 0 8px ${borderColor}`
            }}
          />
          <span
            className="text-xs tracking-[0.3em]"
            style={{
              color: borderColor,
              fontFamily: 'monospace'
            }}
          >
            {checked ? '[ ACTIVE ]' : '[ DISABLED ]'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className={`space-y-4 lg:pr-6 ${columnDividerShadow}`}>
        <p className={columnHeadingClass}>{t('notifications.columnTitles.notifications')}</p>
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

        {showEmailForm && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
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
              onClick={async () => {
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
              className={`${plex.className} w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-full disabled:opacity-50 transition-all font-medium`}
              style={{
                backgroundColor: neonPink,
                boxShadow: '0 0 18px rgba(214,53,111,0.45)'
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">{t('save')}</span>
            </button>
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

      <div className={`space-y-4 lg:border-l lg:px-6 ${columnBorderClass} ${columnDividerShadow}`}>
        <p className={columnHeadingClass}>{t('notifications.columnTitles.automations')}</p>
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

      <div className={`space-y-4 lg:border-l lg:pl-6 ${columnBorderClass}`}>
        <p className={columnHeadingClass}>{t('notifications.columnTitles.consents')}</p>
        {renderSwitch(
          'research_participation',
          t('notifications.research.title'),
          t('notifications.research.description'),
          consents?.research_participation ?? false,
          (value) => onConsentChange('research_participation', value)
        )}
      </div>
    </div>
  );
}
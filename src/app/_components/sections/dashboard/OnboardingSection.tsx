// src/app/_components/dashboard/OnboardingSection.tsx
import type React from 'react';
import { useRouter } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { UserSession } from '@/lib/types/common';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/app/_components/ui/Button';

type OnboardingSectionProps = {
  session?: UserSession['user'];
  mastodonInstances: string[];
  setIsLoading: (loading: boolean) => void;
};

export default function OnboardingSection({ 
  session, 
  mastodonInstances, 
  setIsLoading 
}: OnboardingSectionProps) {
  const router = useRouter();
  const t = useTranslations('dashboard');
  const { isDark } = useTheme();
  const importButtonTextColor = isDark ? '#ff007f' : '#111827';
  const importButtonShadow = isDark
    ? '0 0 15px rgba(255, 0, 127, 0.45)'
    : '0 0 15px rgba(255, 0, 127, 0.25)';
    
  return (
    <div className="w-full flex flex-col gap-6 items-center justify-center">
      <div className="w-full bg-transparent p-4 sm:p-6 rounded-lg">
        <div className="flex flex-col space-y-6 sm:space-y-8 max-w-3xl mx-auto">
          {/* Bouton pour les utilisateurs qui ont déjà onboardé */}
          {session?.has_onboarded && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <Button
                onClick={() => router.push('/reconnect')}
                className={`${plex.className} sm:flex-1 px-8 py-6 tracking-widest border-2 transition-all duration-300 rounded-full`}
                style={{
                  backgroundColor: 'transparent',
                  borderColor: '#ff007f',
                  color: '#ff007f',
                  boxShadow: '0 0 15px rgba(255, 0, 127, 0.5), inset 0 0 15px rgba(255, 0, 127, 0.1)',
                  fontFamily: 'monospace',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = '#ff007f';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 0 30px #ff007f, inset 0 0 20px rgba(255, 0, 127, 0.3)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#ff007f';
                  e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 0, 127, 0.5), inset 0 0 15px rgba(255, 0, 127, 0.1)';
                }}
              >
                <span className="uppercase">{t('continue_to_reconnect')}</span>
              </Button>
              <div className={`text-xl sm:text-2xl hidden sm:block ${isDark ? 'text-white' : 'text-gray-900'}`}>›</div>
              <div className={`${plex.className} text-xs sm:text-sm flex-1 text-center sm:text-left sm:text-justify ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('continue_to_reconnect_description')}
              </div>
            </div>
          )}
                    
          {/* No archive option - pour les utilisateurs qui ont un twitter_id mais n'ont pas onboardé */}
          {session?.twitter_id && !session?.has_onboarded && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <Button
                onClick={() => router.push('/reconnect')}
                className={`${plex.className} sm:flex-1 px-8 py-6 tracking-widest border-2 transition-all duration-300 rounded-full`}
                style={{
                  backgroundColor: 'transparent',
                  borderColor: '#007bff',
                  color: '#007bff',
                  boxShadow: '0 0 15px rgba(0, 123, 255, 0.5), inset 0 0 15px rgba(0, 123, 255, 0.1)',
                  fontFamily: 'monospace',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = '#007bff';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 0 30px #ff007f, inset 0 0 20px rgba(255, 0, 127, 0.3)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#007bff';
                  e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 123, 255, 0.5), inset 0 0 15px rgba(0, 123, 255, 0.1)';
                }}
              >
                <span className="uppercase">{t('no_archive_yet')}</span>
              </Button>
              <div className={`text-xl sm:text-2xl hidden sm:block ${isDark ? 'text-white' : 'text-gray-900'}`}>›</div>
              <div className={`${plex.className} text-xs sm:text-sm flex-1 text-center sm:text-left sm:text-justify ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('no_archive_description')}
              </div>
            </div>
          )}
          
          {/* Import option - pour les utilisateurs qui n'ont pas de twitter_id et n'ont pas onboardé */}
          {(!session?.has_onboarded) && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <Button
                onClick={() => { router.push('/upload'); }}
                className={`${plex.className} sm:flex-1 px-8 py-6 tracking-widest border-2 transition-all duration-300 rounded-full`}
                style={{
                  backgroundColor: 'transparent',
                  borderColor: '#ff007f',
                  color: importButtonTextColor,
                  boxShadow: importButtonShadow,
                  fontFamily: 'monospace',
                } as React.CSSProperties}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = '#ff007f';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 0, 127, 0.6)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = importButtonTextColor;
                  e.currentTarget.style.boxShadow = importButtonShadow;
                }}
              >
                <span className="uppercase">{t('importButton')}</span>
              </Button>
              <div className={`text-xl sm:text-2xl hidden sm:block ${isDark ? 'text-white' : 'text-gray-900'}`}>›</div>
              <div className={`${plex.className} text-xs sm:text-sm flex-1 text-center sm:text-left sm:text-justify ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('import_description')}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
// src/app/_components/reconnect/states/MissingTokenState.tsx
import { useTranslations } from 'next-intl';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';

type MissingTokenStateProps = {
  session: any;
  stats: any;
  mastodonInstances: string[];
  setIsLoading: (value: boolean) => void;
  missingProviders: string[];
};

export default function MissingTokenState({
  session,
  stats,
  mastodonInstances,
  setIsLoading,
  missingProviders,
}: MissingTokenStateProps) {
  const t = useTranslations('refreshToken');
  
  return (
    <div className="bg-[#2a39a9] rounded-xl p-4 sm:p-6 mt-6 sm:mt-8 border border-white/20">
      <h2 className="text-xl sm:text-2xl font-semibold text-white text-center uppercase tracking-wider mb-4">
        {t('title')}
      </h2>
      
      <div className="w-full">
        <DashboardLoginButtons
          connectedServices={{
            bluesky: !missingProviders.includes('bluesky'),
            mastodon: !missingProviders.includes('mastodon'),
            twitter: true
          }}
          hasUploadedArchive={true}
          onLoadingChange={setIsLoading}
          mastodonInstances={mastodonInstances}
          isRefreshToken={true}
          blueskyNotFollowed={stats?.matches.bluesky.notFollowed ?? 0}
          mastodonNotFollowed={stats?.matches.mastodon.notFollowed ?? 0}
        />
      </div>
    </div>
  );
}
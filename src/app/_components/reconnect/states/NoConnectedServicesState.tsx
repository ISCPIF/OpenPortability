// src/app/_components/reconnect/states/NoConnectedServicesState.tsx
import { useTranslations } from 'next-intl';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';

type NoConnectedServicesStateProps = {
  session: any;
  stats: any;
  mastodonInstances: string[];
  setIsLoading: (value: boolean) => void;
};

export default function NoConnectedServicesState({
  session,
  stats,
  mastodonInstances,
  setIsLoading,
}: NoConnectedServicesStateProps) {
  const t = useTranslations('migrate');
  
  return (
    <div className="bg-[#2a39a9] rounded-xl p-4 sm:p-6 border border-white/20">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white text-center uppercase tracking-wider">
        {t('needBothAccounts')}
      </h2>
      
      <div className="w-full">
        <DashboardLoginButtons
          connectedServices={{
            bluesky: !!session?.user?.bluesky_username,
            mastodon: !!session?.user?.mastodon_username,
            twitter: true
          }}
          hasUploadedArchive={true}
          onLoadingChange={setIsLoading}
          mastodonInstances={mastodonInstances}
          isRefreshToken={false}
          blueskyNotFollowed={stats?.matches.bluesky.notFollowed ?? 0}
          mastodonNotFollowed={stats?.matches.mastodon.notFollowed ?? 0}
        />
      </div>
    </div>
  );
}
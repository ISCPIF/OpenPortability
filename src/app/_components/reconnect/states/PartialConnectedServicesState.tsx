// src/app/_components/reconnect/states/PartialConnectedServicesState.tsx
import { useTranslations } from 'next-intl';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';

type PartialConnectedServicesStateProps = {
  session: any;
  stats: any;
  mastodonInstances: string[];
  setIsLoading: (value: boolean) => void;
};

export default function PartialConnectedServicesState({
  session,
  stats,
  mastodonInstances,
  setIsLoading,
}: PartialConnectedServicesStateProps) {
  const t = useTranslations('migrate');
  
  return (
    <div className="flex items-center justify-center w-full mb-8">
      <div className="bg-[#2a39a9] rounded-xl p-4 sm:p-6 border border-white/20 w-full">
        <h2 className="text-lg sm:text-xl font-semibold text-white text-center mb-4">
          {t('connect_missing_service')}
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
    </div>
  );
}
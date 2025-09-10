import React from 'react';
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


  console.log("stats from NoConnectedServices ->", stats);
    
  // Calculer le nombre total de comptes non suivis
  const totalNotFollowedCount = 
    (stats?.matches?.bluesky?.notFollowed || 0) + 
    (stats?.matches?.mastodon?.notFollowed || 0);
  
  // Détermine quelle clé de traduction utiliser en fonction de has_onboarded
  const messageKey = session?.user?.has_onboarded ? 'needBothAccounts' : 'noUploadYet';
  
  return (
    <div className="bg-[#2a39a9] rounded-xl p-4 sm:p-6 border border-white/20">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white text-center uppercase tracking-wider">
        {t.raw(messageKey).split('{count}').map((part, index, parts) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className="text-[#d6356f]">{totalNotFollowedCount}</span>
            )}
          </React.Fragment>
        ))}
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
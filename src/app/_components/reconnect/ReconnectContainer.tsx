// src/app/_components/reconnect/ReconnectContainer.tsx
import { AnimatePresence } from 'framer-motion';
import { ReconnectState, determineReconnectState } from '@/lib/states/reconnectStates';

// États importés
import LoadingState from './states/LoadingState';
import NoConnectedServicesState from './states/NoConnectedServicesState';
import MissingTokenState from './states/MissingTokenState';
import PartialConnectedServicesState from './states/PartialConnectedServicesState';
import ReconnectionCompleteState from './states/ReconnectionCompleteState';
import AutomaticReconnectionState from './states/AutomaticReconnectionState';
import ShowOptionsState from './states/ShowOptionsState';
import ManualReconnectionState from './states/ManualReconnectionState';

type ReconnectContainerProps = {
  session: any;
  stats: any;
  globalStats: any;
  mastodonInstances: string[];
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  isAutomaticReconnect: boolean;
  showOptions: boolean;
  isReconnectionComplete: boolean;
  missingProviders: string[];
  accountsToProcess: any[];
  migrationResults: any;
  handleAutomaticReconnection: () => void;
  handleManualReconnection: () => void;
  handleStartMigration: (accounts: string[]) => void;
  refreshStats: () => void;
};

export default function ReconnectContainer({
  session,
  stats,
  globalStats,
  mastodonInstances,
  isLoading,
  setIsLoading,
  isAutomaticReconnect,
  showOptions,
  isReconnectionComplete,
  missingProviders,
  accountsToProcess,
  migrationResults,
  handleAutomaticReconnection,
  handleManualReconnection,
  handleStartMigration,
  refreshStats,
}: ReconnectContainerProps) {
  
  // Déterminer l'état actuel de la page
  const currentState = determineReconnectState({
    isLoading,
    isAuthenticated: !!session,
    hasOnboarded: !!session?.user?.has_onboarded,
    hasTwitter: !!session?.user?.twitter_username,
    hasBluesky: !!session?.user?.bluesky_username,
    hasMastodon: !!session?.user?.mastodon_username,
    missingProviders,
    statsLoaded: !!stats,
    blueskyNotFollowed: stats?.matches.bluesky.notFollowed ?? 0,
    mastodonNotFollowed: stats?.matches.mastodon.notFollowed ?? 0,
    isReconnectionComplete,
    isAutomaticReconnect,
    showOptions,
    blueskyHasFollowed: stats?.matches.bluesky.hasFollowed ?? 0,
    mastodonHasFollowed: stats?.matches.mastodon.hasFollowed ?? 0,
  });

  // Debugging
  console.log("Current state:", currentState);
  console.log("isAutomaticReconnect:", isAutomaticReconnect);
  console.log("showOptions:", showOptions);

  // Utiliser AnimatePresence pour une seule condition au lieu de plusieurs
  return (
    <div className="mt-6 sm:mt-8">
      <AnimatePresence mode="wait">
        {currentState === ReconnectState.LOADING && (
          <LoadingState />
        )}

        {currentState === ReconnectState.NO_CONNECTED_SERVICES && (
          <NoConnectedServicesState
            session={session}
            stats={stats}
            mastodonInstances={mastodonInstances}
            setIsLoading={setIsLoading}
          />
        )}

        {currentState === ReconnectState.MISSING_TOKEN && (
          <MissingTokenState
            session={session}
            stats={stats}
            mastodonInstances={mastodonInstances}
            setIsLoading={setIsLoading}
            missingProviders={missingProviders}
          />
        )}

        {currentState === ReconnectState.RECONNECTION_COMPLETE && (
          <ReconnectionCompleteState
            session={session}
            stats={stats}
            globalStats={globalStats}
            handleAutomaticReconnection={handleAutomaticReconnection}
            handleManualReconnection={handleManualReconnection}
            refreshStats={refreshStats}
          />
        )}

        {currentState === ReconnectState.AUTOMATIC_RECONNECTION && (
          <AutomaticReconnectionState
            session={session}
            stats={stats}
            migrationResults={migrationResults}
            handleAutomaticReconnection={handleAutomaticReconnection}
          />
        )}

        {currentState === ReconnectState.SHOW_OPTIONS && (
          <ShowOptionsState
            session={session}
            globalStats={globalStats}
            handleAutomaticReconnection={handleAutomaticReconnection}
            handleManualReconnection={handleManualReconnection}
          />
        )}

        {currentState === ReconnectState.MANUAL_RECONNECTION && (
          <ManualReconnectionState
            session={session}
            accountsToProcess={accountsToProcess}
            handleStartMigration={handleStartMigration}
            handleAutomaticReconnection={handleAutomaticReconnection}
          />
        )}

        {currentState === ReconnectState.PARTIAL_CONNECTED_SERVICES && (
          <PartialConnectedServicesState
            session={session}
            stats={stats}
            mastodonInstances={mastodonInstances}
            setIsLoading={setIsLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
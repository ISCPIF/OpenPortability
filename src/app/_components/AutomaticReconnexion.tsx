'use client';

import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { FaPause } from "react-icons/fa";

interface MigrationResults {
  attempted: number;
  succeeded: number;
}

interface AutomaticReconnexionProps {
  results: {
    bluesky: MigrationResults;
    mastodon: MigrationResults;
  };
  onPause?: () => void;
}

export default function AutomaticReconnexion({ results, onPause }: AutomaticReconnexionProps) {
  const t = useTranslations('AutomaticReconnexion');
  const { bluesky, mastodon } = results;

  const totalAccounts = bluesky.attempted + mastodon.attempted;
  const totalSucceeded = bluesky.succeeded + mastodon.succeeded;
  const progress = totalAccounts > 0 ? (totalSucceeded / totalAccounts) * 100 : 0;

  const calculateProgress = (current: number, max: number) => {
    return max > 0 ? (current / max) * 100 : 0;
  };

  return (
    <div className="flex flex-col space-y-8 w-full max-w-3xl mx-auto">
      <div className="flex flex-col space-y-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-4">
          {/* Bouton d'affichage */}
          <div className="flex-1 max-w-[300px] bg-[#d6356f] text-white rounded-full py-4 px-6">
            <div className="flex items-center justify-center gap-3">
              <FaPause className="text-xl" />
              <span className="font-bold">{t('reconnectionInProgress')}</span>
            </div>
          </div>

          {/* Bouton de pause */}
          <button
            onClick={onPause}
            className="flex-1 max-w-[300px] bg-[#e8e9e4] text-[#d6356f] rounded-full py-4 px-6 cursor-pointer text-sm text-italic"
          >
            <div className="flex flex-col text-center">
              <span>{t('switchToManual')}</span>
              {/* <span>{t('chooseManualy')}</span> */}
            </div>
          </button>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-6">
        {/* To connect */}
        <div className="flex items-center gap-4">
          <div className="w-24 text-right text-white font-mono">
            {totalSucceeded}/{totalAccounts}
          </div>
          <div className="flex-1 h-2 bg-[#1A237E] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#d6356f] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex-1 text-white text-sm">
            {t('accountsToConnect')}
          </div>
        </div>

        {/* Bluesky */}
        <div className="flex items-center gap-4">
          <div className="w-24 text-right text-white font-mono">
            {bluesky.succeeded}/{bluesky.attempted}
          </div>
          <div className="flex-1 h-2 bg-[#1A237E] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#d6356f] rounded-full transition-all duration-500"
              style={{ width: `${calculateProgress(bluesky.succeeded, bluesky.attempted)}%` }}
            />
          </div>
          <div className="flex-1 text-white text-sm">
            {t('blueskyAccounts')}
          </div>
        </div>

        {/* Mastodon */}
        <div className="flex items-center gap-4">
          <div className="w-24 text-right text-white font-mono">
            {mastodon.succeeded}/{mastodon.attempted}
          </div>
          <div className="flex-1 h-2 bg-[#1A237E] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#d6356f] rounded-full transition-all duration-500"
              style={{ width: `${calculateProgress(mastodon.succeeded, mastodon.attempted)}%` }}
            />
          </div>
          <div className="flex-1 text-white text-sm">
            {t('mastodonAccounts')}
          </div>
        </div>
      </div>
    </div>
  );
}
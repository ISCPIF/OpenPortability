'use client'

import { useTranslations } from 'next-intl'
import { FaPause } from 'react-icons/fa'

interface AutomaticReconnexionProps {
  onPause: () => void
  results: {
    bluesky: { attempted: number; succeeded: number }
    mastodon: { attempted: number; succeeded: number }
  }
}

export default function AutomaticReconnexion({
  onPause,
  results
}: AutomaticReconnexionProps) {
  const t = useTranslations('AutomaticReconnexion')

  // Calculer les pourcentages de progression
  const blueskyProgress = results.bluesky.attempted === 0 ? 0 : 
    (results.bluesky.succeeded / results.bluesky.attempted) * 100
  const mastodonProgress = results.mastodon.attempted === 0 ? 0 :
    (results.mastodon.succeeded / results.mastodon.attempted) * 100

  return (
    <div className="flex flex-col space-y-8 w-full max-w-3xl mx-auto">
      <div className="flex flex-col space-y-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-4">
          {/* Bouton d'affichage */}
          <div className="flex-1 max-w-[300px] bg-[#d6356f] text-white rounded-full py-4 px-6">
            <div className="flex items-center justify-center gap-3">
              <FaPause className="text-sm" />
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
              <span>{t('chooseManualy')}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-bold text-sm">{t('accountsToConnect')}</h3>
          <div className="space-y-4">
            {/* Bluesky progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('blueskyAccounts')}</span>
                <span>{results.bluesky.succeeded}/{results.bluesky.attempted}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-[#d6356f] h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${blueskyProgress}%` }}
                />
              </div>
            </div>

            {/* Mastodon progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('mastodonAccounts')}</span>
                <span>{results.mastodon.succeeded}/{results.mastodon.attempted}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-[#d6356f] h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${mastodonProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
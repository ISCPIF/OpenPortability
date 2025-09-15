'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import successBadge from '../../../public/v2/success-badge.svg';

interface MigrationResults {
  attempted: number
  succeeded: number
}

interface ReconnexionModaleResultsProps {
  onClose: () => void
  results: {
    bluesky: MigrationResults
    mastodon: MigrationResults
  }
  isComplete?: boolean
}

export default function ReconnexionModaleResults({
  onClose,
  results: { bluesky, mastodon },
  isComplete = false
}: ReconnexionModaleResultsProps) {
  const t = useTranslations('reconnexionModal')
  const hasSuccessfulMigration = bluesky.succeeded > 0 || mastodon.succeeded > 0
  const totalAccounts = bluesky.attempted + mastodon.attempted
  const totalSucceeded = bluesky.succeeded + mastodon.succeeded
  const progress = totalAccounts > 0 ? (totalSucceeded / totalAccounts) * 100 : 0

  // SVG circle parameters
  const size = 120
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const dash = (progress * circumference) / 100

  const isCompleteMigration = bluesky.succeeded === bluesky.attempted && mastodon.succeeded === mastodon.attempted;
  const blueskyProgress = bluesky ? Math.round((bluesky.succeeded / bluesky.attempted) * 100) : 0;
  const mastodonProgress = mastodon ? Math.round((mastodon.succeeded / mastodon.attempted) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 relative max-w-[500px] w-[90%]">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-1 hover:opacity-70"
        >
          <Image
            src="/v2/close.svg"
            alt="Close"
            width={24}
            height={24}
          />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            {isCompleteMigration && (
              <div className="mb-4">
                <Image
                  src={successBadge}
                  alt="Success"
                  width={80}
                  height={80}
                  className="mx-auto"
                />
              </div>
            )}
            {!isCompleteMigration && (
              <div className="relative" style={{ width: size, height: size }}>
                {/* Background circle */}
                <svg className="transform -rotate-90 absolute" width={size} height={size}>
                  <circle
                    cx={size/2}
                    cy={size/2}
                    r={radius}
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth={strokeWidth}
                  />
                  {/* Progress circle */}
                  <circle
                    cx={size/2}
                    cy={size/2}
                    r={radius}
                    fill="none"
                    stroke="#1D1B84"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                {/* Progress text */}
                <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#1D1B84]">
                  {Math.round(progress)}%
                </div>
              </div>
            )}
          </div>
          
          <h2 className="text-xl mb-4 text-black">
            {isCompleteMigration ? (
              t('migrationComplete')
            ) : (
              t('migrationInProgress')
            )}
          </h2>
          
          {bluesky.attempted > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Bluesky</h3>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${blueskyProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {isCompleteMigration ? 
                  t('migrationCompleteStats', { count: bluesky.attempted }) :
                  t('migrationProgress', { current: bluesky.succeeded, total: bluesky.attempted })}
              </p>
            </div>
          )}
          
          {mastodon.attempted > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Mastodon</h3>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-600 h-2.5 rounded-full"
                  style={{ width: `${mastodonProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {isCompleteMigration ? 
                  t('migrationCompleteStats', { count: mastodon.attempted }) :
                  t('migrationProgress', { current: mastodon.succeeded, total: mastodon.attempted })}
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-4 w-full bg-[#1D1B84] text-white py-2 px-4 rounded hover:bg-[#15134D] transition-colors"
          >
            {isCompleteMigration ? t('close') : t('minimize')}
          </button>
        </div>
      </div>
    </div>
  )
}
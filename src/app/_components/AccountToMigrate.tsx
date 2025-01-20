import { FaTwitter, FaMastodon } from 'react-icons/fa'
import { SiBluesky } from "react-icons/si"
import { CheckCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

type AccountToMigrateProps = {
  twitterId: string
  blueskyHandle: string | null
  mastodonHandle: string | null
  mastodonUsername: string | null
  mastodonInstance: string | null
  isSelected: boolean
  onToggle: () => void
  hasFollowBluesky: boolean
  hasFollowMastodon: boolean
}

export default function AccountToMigrate({
  twitterId,
  blueskyHandle,
  mastodonHandle,
  mastodonUsername,
  mastodonInstance,
  isSelected,
  onToggle,
  hasFollowBluesky,
  hasFollowMastodon
}: AccountToMigrateProps) {
  const t = useTranslations('AccountToMigrate');

  console.log("Props:", {
    twitterId,
    blueskyHandle,
    mastodonHandle,
    isSelected,
    onToggle,
    hasFollowBluesky,
    hasFollowMastodon
  });

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg ${
      hasFollowBluesky && hasFollowMastodon 
        ? 'bg-blue-50' 
        : 'bg-white hover:bg-gray-50'
    }`}>
      <div className="flex items-center space-x-4">
        {(!hasFollowBluesky || !hasFollowMastodon) && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="w-4 h-4 text-blue-600"
          />
        )}
        <div>
          <span className="font-medium text-black">
            {blueskyHandle ? 
              `@${blueskyHandle}` : 
              (mastodonUsername && mastodonInstance ? 
                `@${mastodonUsername}@${mastodonInstance}` : 
                '@' + twitterId
              )
            }
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {blueskyHandle && (
          hasFollowBluesky ? (
            <div className="flex items-center gap-1 px-3 py-1 text-sm text-blue-500">
              <CheckCircle className="w-3 h-3" />
              <span>{t('followedOnBluesky')}</span>
            </div>
          ) : (
            <button 
              onClick={() => window.open(`https://bsky.app/profile/${blueskyHandle}`, '_blank')}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
            >
              {t('followOnBluesky')}
            </button>
          )
        )}
        {mastodonHandle && (
          hasFollowMastodon ? (
            <div className="flex items-center gap-1 px-3 py-1 text-sm text-purple-500">
              <CheckCircle className="w-3 h-3" />
              <span>{t('followedOnMastodon')}</span>
            </div>
          ) : (
            <button 
              onClick={() => window.open(`https://${mastodonHandle.split('@')[1]}/@${mastodonHandle.split('@')[0]}`, '_blank')}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
            >
              {t('followOnMastodon')}
            </button>
          )
        )}
      </div>
    </div>
  )
}
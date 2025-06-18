import { FaTwitter, FaMastodon } from 'react-icons/fa';
import { SiBluesky } from "react-icons/si";
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MatchingTarget } from '@/lib/types/matching';

type AccountToMigrateProps = {
  targetTwitterId: string
  blueskyHandle: string | null
  mastodonHandle: string | null
  mastodonUsername: string | null
  mastodonInstance: string | null
  mastodonId: string | null
  isSelected: boolean
  onToggle: () => void
  onIgnore: (targetTwitterId: string) => void
  onUnignore?: (targetTwitterId: string) => void
  hasFollowBluesky: boolean
  hasFollowMastodon: boolean
  isDismissed?: boolean
  session: {
    user: {
      bluesky_username: string | null
      mastodon_username: string | null
    }
  }
}

export default function AccountToMigrate({
  targetTwitterId,
  blueskyHandle,
  mastodonHandle,
  mastodonUsername,
  mastodonInstance,
  mastodonId,
  isSelected,
  onToggle,
  onIgnore,
  onUnignore,
  hasFollowBluesky,
  hasFollowMastodon,
  isDismissed = false,
  session
}: AccountToMigrateProps) {
  const t = useTranslations('AccountToMigrate');

  const handleChange = () => {
    onToggle();
  };

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg gap-2 sm:gap-0 ${
      hasFollowBluesky && hasFollowMastodon 
        ? 'bg-blue-50' 
        : 'bg-white hover:bg-gray-50'
    }`}>
      <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
        {(!hasFollowBluesky || !hasFollowMastodon) && !isDismissed && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 flex-shrink-0"
            id={`checkbox-${targetTwitterId}`}
          />
        )}
        <div className="truncate max-w-[200px] sm:max-w-[300px]">
          <span className="font-medium text-sm sm:text-base text-black">
            {blueskyHandle ? 
              `@${blueskyHandle}` : 
              (mastodonUsername && mastodonInstance ? 
                `${mastodonUsername}@${mastodonInstance.replace('https://', '')}` : 
                '@' + targetTwitterId
              )
            }
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end mt-1 sm:mt-0">
        {blueskyHandle && session.user.bluesky_username && !isDismissed && (
          hasFollowBluesky ? (
            <div className="flex items-center gap-1 px-2 sm:px-3 py-1 text-xs sm:text-sm text-blue-500">
              <CheckCircle className="w-3 h-3" />
              <span>{t('followedOnBluesky')}</span>
            </div>
          ) : (
            <button 
              onClick={() => window.open(`https://bsky.app/profile/${blueskyHandle}`, '_blank')}
              className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
            >
              {t('followOnBluesky')}
            </button>
          )
        )}
        {(mastodonUsername && mastodonInstance && session.user.mastodon_username) && !isDismissed && (
          hasFollowMastodon ? (
            <div className="flex items-center gap-1 px-2 sm:px-3 py-1 text-xs sm:text-sm text-purple-500">
              <CheckCircle className="w-3 h-3" />
              <span>{t('followedOnMastodon')}</span>
            </div>
          ) : (
            <button 
              onClick={() => window.open(`${mastodonInstance}/@${mastodonUsername}`, '_blank')}
              className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
            >
              {t('followOnMastodon')}
            </button>
          )
        )}
        
        {/* Bouton pour ignorer le compte */}
        {!isDismissed && !hasFollowBluesky && !hasFollowMastodon && (
          <button 
            onClick={() => onIgnore(targetTwitterId)}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-1"
            title={t('ignore')}
          >
            <XCircle className="w-3 h-3" />
            <span>{t('ignore')}</span>
          </button>
        )}
        
        {/* Bouton pour annuler l'ignorance du compte */}
        {isDismissed && onUnignore && (
          <button 
            onClick={() => onUnignore(targetTwitterId)}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors flex items-center gap-1"
            title={t('unignore')}
          >
            <RefreshCw className="w-3 h-3" />
            <span>{t('unignore')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
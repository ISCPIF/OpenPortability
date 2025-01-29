import { FaTwitter, FaMastodon } from 'react-icons/fa';
import { SiBluesky } from "react-icons/si";
import { CheckCircle } from 'lucide-react';
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
  hasFollowBluesky: boolean
  hasFollowMastodon: boolean
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
  hasFollowBluesky,
  hasFollowMastodon
}: AccountToMigrateProps) {
  const t = useTranslations('AccountToMigrate');

  // console.log("Props:", {
  //   targetTwitterId,
  //   blueskyHandle,
  //   mastodonHandle,
  //   isSelected,
  //   onToggle,
  //   hasFollowBluesky,
  //   hasFollowMastodon
  // });

  // console.log("AccountToMigrate render for:", targetTwitterId, {
  //   isSelected,
  //   hasFollowBluesky,
  //   hasFollowMastodon
  // });

  const handleChange = () => {
    console.log("Checkbox clicked for:", targetTwitterId);
    console.log("Current isSelected state:", isSelected);
    onToggle();
  };

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
            onChange={handleChange}
            className="w-4 h-4 text-blue-600"
            id={`checkbox-${targetTwitterId}`}
          />
        )}
        <div>
        <span className="font-medium text-black">
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
        {(mastodonUsername && mastodonInstance) && (
          hasFollowMastodon ? (
            <div className="flex items-center gap-1 px-3 py-1 text-sm text-purple-500">
              <CheckCircle className="w-3 h-3" />
              <span>{t('followedOnMastodon')}</span>
            </div>
          ) : (
            <button 
              onClick={() => window.open(`${mastodonInstance}/@${mastodonUsername}`, '_blank')}
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
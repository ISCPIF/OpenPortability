import { FaTwitter } from 'react-icons/fa'
import { SiBluesky } from "react-icons/si"

type AccountToMigrateProps = {
  twitterId: string
  blueskyHandle: string | null
  isSelected: boolean
  onToggle: () => void
  relationship: 'follower' | 'following'
}

export default function AccountToMigrate({
  twitterId,
  blueskyHandle,
  isSelected,
  onToggle,
  relationship
}: AccountToMigrateProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <div className="flex items-center space-x-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <div className="flex items-center space-x-4">
          <FaTwitter className="text-blue-400" />
          <span className="font-medium text-gray-700">{twitterId}</span>
          {blueskyHandle && (
            <>
              <span className="text-gray-400">→</span>
              <SiBluesky className="text-blue-500" />
              <span className="font-medium text-gray-700">{blueskyHandle}</span>
            </>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-500 capitalize">{relationship}</span>
    </div>
  )
}
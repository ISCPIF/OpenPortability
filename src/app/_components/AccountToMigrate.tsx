import { FaTwitter } from 'react-icons/fa'
import { SiBluesky } from "react-icons/si"

type AccountToMigrateProps = {
  twitterId: string
  blueskyHandle: string | null
  isSelected: boolean
  onToggle: () => void
  relationship: 'following'
}

export default function AccountToMigrate({
  twitterId,
  blueskyHandle,
  isSelected,
  onToggle
}: AccountToMigrateProps) {
  return (
    <div className="flex items-center p-3 hover:bg-gray-50 transition-colors">
      <label className="flex items-center w-full cursor-pointer">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <div className="flex items-center ml-4 space-x-3">
          <FaTwitter className="text-[#1DA1F2] text-lg" />
          <span className="text-gray-700">@{twitterId}</span>
        </div>
      </label>
    </div>
  )
}
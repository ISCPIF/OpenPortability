'use client'

import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { FaTwitter } from 'react-icons/fa'
import { SiBluesky } from "react-icons/si"

type ProfileCardProps = {
  type: 'twitter' | 'bluesky'
}

export default function ProfileCard({ type }: ProfileCardProps) {
  const { data: session } = useSession()
  if (!session?.user) return null

  const isTwitter = type === 'twitter'
  const profile = isTwitter ? {
    username: session.user.twitter_username,
    image: session.user.twitter_image,
    id: session.user.twitter_id,
    icon: <FaTwitter className="text-[#1DA1F2] text-2xl" />,
    connected: !!session.user.twitter_id
  } : {
    username: session.user.bluesky_username,
    image: session.user.bluesky_image,
    id: session.user.bluesky_id,
    icon: <SiBluesky className="text-[#0085FF] text-2xl" />,
    connected: !!session.user.bluesky_id
  }

  if (!profile.connected) return null

  return (
    <div className="group">
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-black/40 to-black/20 backdrop-blur-md rounded-lg border border-white/10 hover:border-white/20 transition-all duration-300">
        {/* Avatar avec badge du réseau social */}
        <div className="relative">
          <div className="w-14 h-14 rounded-lg overflow-hidden ring-2 ring-white/20">
            {profile.image && (
              <Image
                src={profile.image}
                alt={`${profile.username || 'User'}'s avatar`}
                fill
                className="object-cover"
                sizes="56px"
              />
            )}
          </div>
          {/* Badge du réseau social */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/10">
            {profile.icon}
          </div>
        </div>
        
        {/* Infos utilisateur */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {profile.username}
          </p>
          <p className="text-xs text-white/50 truncate font-mono">
            {profile.id?.slice(0, 16)}...
          </p>
        </div>

        {/* Indicateur de connexion */}
        <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
      </div>
    </div>
  )
}
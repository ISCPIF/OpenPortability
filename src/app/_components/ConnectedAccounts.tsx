'use client'

import { useSession } from 'next-auth/react'
import ProfileCard from './ProfileCard'
import { motion } from 'framer-motion'
import { IoCheckmarkCircle } from 'react-icons/io5'

export default function ConnectedAccounts() {
  const { data: session } = useSession()
  if (!session?.user) return null

  const hasTwitter = !!session.user.twitter_id
  const hasBluesky = !!session.user.bluesky_id
  const hasMastodon = !!session.user.mastodon_id

  if (!hasTwitter && !hasBluesky && !hasMastodon) return null

  const connectedServices = [
    hasTwitter && 'Twitter',
    hasBluesky && 'BlueSky',
    hasMastodon && 'Mastodon'
  ].filter(Boolean).join(', ')

  const lastCommaIndex = connectedServices.lastIndexOf(',')
  const formattedServices = lastCommaIndex !== -1
    ? connectedServices.substring(0, lastCommaIndex) + ' et' + connectedServices.substring(lastCommaIndex + 1)
    : connectedServices

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2">
          <IoCheckmarkCircle className="text-green-500 size-10" />
        </div>
      </div>

      {/* Container principal */}
      <div className="relative p-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
        {/* Message de statut */}
        <div className="mb-4">
          <p className="text-center text-sm text-white/60">
            Vous êtes connecté avec {formattedServices} ✨
          </p>
        </div>

        {/* Cartes de profil */}
        <div className="space-y-3">
          {hasTwitter && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ProfileCard type="twitter" />
            </motion.div>
          )}
          {hasBluesky && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <ProfileCard type="bluesky" />
            </motion.div>
          )}
          {hasMastodon && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <ProfileCard type="mastodon" />
            </motion.div>
          )}
        </div>

        {/* Effet de gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-rose-500/10 blur-2xl rounded-2xl" />
      </div>
    </div>
  )
}
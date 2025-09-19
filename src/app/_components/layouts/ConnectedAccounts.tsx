'use client'

import { useSession } from 'next-auth/react'
import ProfileCard from './ProfileCard'
import { motion } from 'framer-motion'
import { IoCheckmarkCircle } from 'react-icons/io5'
import { useTranslations } from 'next-intl'

export default function ConnectedAccounts() {
  const { data: session } = useSession()
  const t = useTranslations('connectedAccounts')
  
  if (!session?.user) return null

  const hasTwitter = !!session.user.twitter_id
  const hasBluesky = !!session.user.bluesky_id
  const hasMastodon = !!session.user.mastodon_id

  if (!hasTwitter && !hasBluesky && !hasMastodon) return null

  const connectedServices = (
    [
      hasTwitter && t('services.twitter'),
      hasBluesky && t('services.bluesky'),
      hasMastodon && t('services.mastodon')
    ].filter((s): s is string => Boolean(s))
  )

  const formattedServices: string = connectedServices.length > 1
    ? `${connectedServices.slice(0, -1).join(', ')} ${t('and')} ${connectedServices[connectedServices.length - 1]}`
    : connectedServices[0]

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Badge de succès */}
      {/* <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2 bg-green-500/10 backdrop-blur-sm px-4 py-1.5 rounded-full border border-green-500/20">
          <IoCheckmarkCircle className="text-green-400 size-5" />
          <span className="text-xs font-medium text-green-400">{t('connected')}</span>
        </div>
      </div> */}

      {/* Container principal - Style plus moderne et épuré */}
      <div className="relative p-6 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10">
        {/* Message de statut */}
        <div className="mb-6">
          <h2 className="text-lg font-medium text-white mb-1">
            {t('yourAccounts')}
          </h2>
          <p className="text-sm text-white/60">
            {t('connectedWith', { services: formattedServices })}
          </p>
        </div>

        {/* Cartes de profil */}
        <div className="space-y-2">
          {hasTwitter && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ProfileCard type="twitter" showUnlink={true} />
            </motion.div>
          )}
          {hasBluesky && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <ProfileCard type="bluesky" showUnlink={true} />
            </motion.div>
          )}
          {hasMastodon && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <ProfileCard type="mastodon" showUnlink={true} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
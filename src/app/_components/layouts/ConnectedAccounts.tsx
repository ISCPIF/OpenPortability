'use client'

import { useSession } from 'next-auth/react'
import ProfileCard from './ProfileCard'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link2, CheckCircle2 } from 'lucide-react'
import { quantico } from '@/app/fonts/plex'

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
    <div className={`${quantico.className} relative w-full`}>
      {/* Container principal - Graph panel style */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-[13px] font-semibold text-white">
              {t('yourAccounts')}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider">
              {t('connected')}
            </span>
          </div>
        </div>

        {/* Status message */}
        <p className="text-[11px] text-slate-400 mb-4">
          {t('connectedWith', { services: formattedServices })}
        </p>

        {/* Profile cards */}
        <div className="space-y-2">
          {hasTwitter && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ProfileCard type="twitter" showUnlink={true} />
            </motion.div>
          )}
          {hasBluesky && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <ProfileCard type="bluesky" showUnlink={true} />
            </motion.div>
          )}
          {hasMastodon && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              <ProfileCard type="mastodon" showUnlink={true} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
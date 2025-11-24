'use client'

import { useSession } from 'next-auth/react'
import ProfileCard from './ProfileCard'
import { motion } from 'framer-motion'
import { IoCheckmarkCircle } from 'react-icons/io5'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'

export default function ConnectedAccounts() {
  const { data: session } = useSession()
  const t = useTranslations('connectedAccounts')
  const { isDark } = useTheme()
  
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

  const containerClasses = isDark
    ? 'bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/90 border-white/10 text-white shadow-[0_25px_65px_rgba(0,0,0,0.55)]'
    : 'bg-gradient-to-br from-white via-slate-50/90 to-white/95 border-slate-300 text-slate-900 shadow-[0_35px_80px_rgba(15,23,42,0.18)]'

  const subTextClass = isDark ? 'text-white/70' : 'text-slate-700'
  const statusBadgeClasses = isDark
    ? 'border-white/10 bg-white/5 text-white'
    : 'border-slate-200 bg-slate-900/5 text-slate-700'
  const accentColor = isDark ? '#7dd3fc' : '#ff007f'
  const titleTextClass = isDark ? 'text-white' : 'text-slate-900'

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
      <div className={`relative overflow-hidden p-6 sm:p-8 backdrop-blur-xl rounded-2xl border ${containerClasses}`}>
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: isDark
              ? 'radial-gradient(circle at top right, rgba(125,211,252,0.4), transparent 55%)'
              : 'radial-gradient(circle at top right, rgba(255,0,127,0.4), transparent 60%)'
          }}
        />
        <div
          className="absolute inset-x-8 top-0 h-px opacity-70"
          style={{ backgroundImage: `linear-gradient(90deg, ${accentColor}, transparent)` }}
        />
        {/* Message de statut */}
        <div className="mb-6 relative z-10">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 ${statusBadgeClasses}`}>
            <IoCheckmarkCircle className="text-green-400 size-5" />
            <span className="text-xs font-semibold tracking-[0.3em] uppercase">
              {t('connected')}
            </span>
          </div>
          <h2 className={`text-lg font-semibold tracking-wide mb-1 ${titleTextClass}`}>
            {t('yourAccounts')}
          </h2>
          <p className={`text-sm leading-relaxed ${subTextClass}`}>
            {t('connectedWith', { services: formattedServices })}
          </p>
        </div>

        {/* Cartes de profil */}
        <div className="space-y-3 relative z-10">
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
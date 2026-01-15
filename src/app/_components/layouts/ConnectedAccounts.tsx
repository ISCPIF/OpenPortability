'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import ProfileCard from './ProfileCard'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Link2, CheckCircle2 } from 'lucide-react'
import { quantico } from '@/app/fonts/plex'
import Image from 'next/image'
import { ReconnectLoginModal } from '@/app/_components/modales/ReconnectLoginModal'

import mastodonIcon from '../../../../public/newSVG/masto.svg'
import blueskyIcon from '../../../../public/newSVG/BS.svg'
import twitterIcon from '../../../../public/newSVG/X.svg'

export default function ConnectedAccounts() {
  const { data: session } = useSession()
  const t = useTranslations('connectedAccounts')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [mastodonInstances, setMastodonInstances] = useState<string[]>([])
  
  if (!session?.user) return null

  const hasTwitter = !!session.user.twitter_id
  const hasBluesky = !!session.user.bluesky_id
  const hasMastodon = !!session.user.mastodon_id
  const hasAnyAccount = hasTwitter || hasBluesky || hasMastodon

  // Fetch mastodon instances for the login modal
  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const res = await fetch('/api/auth/mastodon')
        if (res.ok) {
          const data = await res.json()
          setMastodonInstances(data.instances || [])
        }
      } catch (error) {
        console.error('Failed to fetch mastodon instances:', error)
      }
    }
    fetchInstances()
  }, [])

  const connectedServices = (
    [
      hasTwitter && t('services.twitter'),
      hasBluesky && t('services.bluesky'),
      hasMastodon && t('services.mastodon')
    ].filter((s): s is string => Boolean(s))
  )

  const formattedServices: string = connectedServices.length > 1
    ? `${connectedServices.slice(0, -1).join(', ')} ${t('and')} ${connectedServices[connectedServices.length - 1]}`
    : connectedServices[0] || ''

  return (
    <>
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
            {hasAnyAccount && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider">
                  {t('connected')}
                </span>
              </div>
            )}
          </div>

          {/* Status message - only if has accounts */}
          {hasAnyAccount && (
            <p className="text-[11px] text-slate-400 mb-4">
              {t('connectedWith', { services: formattedServices })}
            </p>
          )}

          {/* Non-connected platforms - clickable to open login modal */}
          <div className="space-y-3 mb-4">
            {!hasTwitter && (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-slate-600/20 hover:bg-slate-600/30 border border-slate-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700/50">
                    <Image src={twitterIcon} alt="X" width={20} height={20} className="opacity-70 group-hover:opacity-100" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">!</span>
                    </div>
                  </div>
                  <span className="text-[13px] font-medium text-slate-300 group-hover:text-white">{t('services.twitter')}</span>
                </div>
                <span className="text-[12px] text-slate-400 group-hover:text-white font-semibold px-3 py-1.5 rounded-lg bg-slate-700/50 group-hover:bg-slate-600/50">{t('connect')}</span>
              </button>
            )}

            {!hasBluesky && (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-sky-700/50">
                    <Image src={blueskyIcon} alt="Bluesky" width={20} height={20} className="opacity-80 group-hover:opacity-100" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">!</span>
                    </div>
                  </div>
                  <span className="text-[13px] font-medium text-sky-200 group-hover:text-white">{t('services.bluesky')}</span>
                </div>
                <span className="text-[12px] text-sky-300 group-hover:text-sky-100 font-semibold px-3 py-1.5 rounded-lg bg-sky-700/50 group-hover:bg-sky-600/50">{t('connect')}</span>
              </button>
            )}
            
            {!hasMastodon && (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-purple-700/50">
                    <Image src={mastodonIcon} alt="Mastodon" width={20} height={20} className="opacity-80 group-hover:opacity-100" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">!</span>
                    </div>
                  </div>
                  <span className="text-[13px] font-medium text-purple-200 group-hover:text-white">{t('services.mastodon')}</span>
                </div>
                <span className="text-[12px] text-purple-300 group-hover:text-purple-100 font-semibold px-3 py-1.5 rounded-lg bg-purple-700/50 group-hover:bg-purple-600/50">{t('connect')}</span>
              </button>
            )}
          </div>

          {/* Connected profile cards */}
          {hasAnyAccount && (
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
          )}
        </div>
      </div>

      {/* Login Modal */}
      <ReconnectLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        invalidProviders={[]}
        noAccountsConfigured={!hasAnyAccount}
        mastodonInstances={mastodonInstances}
        connectedServices={{
          twitter: hasTwitter,
          bluesky: hasBluesky,
          mastodon: hasMastodon,
        }}
        onLoginComplete={() => setShowLoginModal(false)}
        allowDismiss={true}
        mode="addPlatform"
        userId={session.user.id}
      />
    </>
  )
}
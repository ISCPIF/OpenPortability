'use client'

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { signIn } from "next-auth/react"
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { quantico } from "@/app/fonts/plex"
import Image from 'next/image'
import BlueSkyLogin from './BlueSkyLogin'
import MastodonLoginButton from '../logins/MastodonLoginButton'
import { useTheme } from '@/hooks/useTheme'
import { Sparkles, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react'

import mastodonIcon from '../../../../public/newSVG/masto.svg'
import blueskyIcon from '../../../../public/newSVG/BS.svg'
import twitterIcon from '../../../../public/newSVG/X.svg'


interface DashboardLoginButtonsProps {
  connectedServices: {
    twitter?: boolean
    bluesky?: boolean
    mastodon?: boolean
  }
  hasUploadedArchive: boolean
  onLoadingChange: (isLoading: boolean) => void
  mastodonInstances: string[]
  isRefreshToken?: boolean
  blueskyNotFollowed?: number
  mastodonNotFollowed?: number
  userId?: string // For account linking
  invalidProviders?: string[] // When set, only show buttons for these expired providers
}

const serviceConfig = {
  twitter: {
    bg: 'bg-zinc-900',
    border: 'border-zinc-700 hover:border-zinc-600',
    shadow: 'shadow-[0_0_25px_rgba(255,255,255,0.08)]',
    hoverShadow: 'hover:shadow-[0_0_35px_rgba(255,255,255,0.12)]',
    description: 'Import your X/Twitter network'
  },
  bluesky: {
    bg: 'bg-[#0085FF]',
    border: 'border-sky-500/30 hover:border-sky-400/50',
    shadow: 'shadow-[0_0_25px_rgba(0,133,255,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_35px_rgba(0,133,255,0.35)]',
    description: 'Connect your Bluesky identity'
  },
  mastodon: {
    bg: 'bg-[#6364FF]',
    border: 'border-violet-500/30 hover:border-violet-400/50',
    shadow: 'shadow-[0_0_25px_rgba(99,100,255,0.25)]',
    hoverShadow: 'hover:shadow-[0_0_35px_rgba(99,100,255,0.35)]',
    description: 'Link your Mastodon instance'
  }
} as const

export default function DashboardLoginButtons({
  connectedServices,
  hasUploadedArchive,
  onLoadingChange,
  mastodonInstances,
  isRefreshToken = false,
  blueskyNotFollowed = 0,
  mastodonNotFollowed = 0,
  userId,
  invalidProviders = [],
}: DashboardLoginButtonsProps) {
  const { isDark } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const t = useTranslations('dashboardLoginButtons')
  const pathname = usePathname()

  const handleTwitterSignIn = async () => {
    setIsLoading(true)
    onLoadingChange(true)
    try {
      await signIn('twitter', { callbackUrl: '/reconnect' })
    } catch (error) {
      console.error('Error signing in with Twitter:', error)
    }
    setIsLoading(false)
    onLoadingChange(false)
  }

  // If invalidProviders is set, only show those specific providers (for token refresh)
  // Otherwise, show all non-connected services
  const services = [
    { key: 'twitter', icon: twitterIcon, connected: connectedServices.twitter },
    { key: 'bluesky', icon: blueskyIcon, connected: connectedServices.bluesky },
    { key: 'mastodon', icon: mastodonIcon, connected: connectedServices.mastodon }
  ].filter(s => {
    // If we have specific invalid providers, only show those
    if (invalidProviders.length > 0) {
      return invalidProviders.includes(s.key);
    }
    // Otherwise show non-connected services
    return !s.connected;
  }) as { key: keyof typeof serviceConfig; icon: string; connected: boolean }[]

  return (
    <div className={`${quantico.className} relative p-5 sm:p-6`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
          <div className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Connect your accounts</span>
          </div>
          <div className={`flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <ShieldCheck className="h-3 w-3" />
            <span className="text-[10px]">OAuth secured</span>
          </div>
        </div>

        {/* Service cards */}
        <div className="space-y-3">
          {services.map(({ key, icon }) => {
            const config = serviceConfig[key]
            const isExpanded = selectedService === key

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <motion.button
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => {
                    if (key === 'twitter') {
                      handleTwitterSignIn()
                    } else {
                      setSelectedService(isExpanded ? null : key)
                    }
                  }}
                  disabled={isLoading}
                  className={`group relative w-full rounded-lg border ${config.border} ${config.bg} p-4 text-left transition-all duration-200 ${config.shadow} ${config.hoverShadow}`}
                >
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                      <Image src={icon} alt={key} width={24} height={24} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white">
                        {t(`connectedDashboard.${key}`)}
                      </p>
                      <p className="text-[11px] text-white/70 truncate">
                        {config.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {key !== 'twitter' && (
                        <span className="text-[10px] text-white/60 uppercase tracking-wider hidden sm:block">
                          {isExpanded ? 'Close' : 'Setup'}
                        </span>
                      )}
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                        {key === 'twitter' ? (
                          <Zap className="h-4 w-4 text-white" />
                        ) : (
                          <ArrowUpRight className={`h-4 w-4 text-white transition-transform ${isExpanded ? 'rotate-45' : ''}`} />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>

                {/* Expanded form */}
                <AnimatePresence>
                  {isExpanded && key === 'bluesky' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-1">
                        <BlueSkyLogin 
                          userId={userId}
                          onLoginComplete={() => {
                            setSelectedService(null)
                            onLoadingChange(true)
                          }} 
                        />
                      </div>
                    </motion.div>
                  )}
                  {isExpanded && key === 'mastodon' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4">
                        <MastodonLoginButton
                          onLoadingChange={onLoadingChange}
                          showForm={true}
                          instances={mastodonInstances}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* Footer hint */}
        {services.length > 0 && (
          <p className="text-center text-[11px] text-slate-500">
            Connect at least one account to start your migration journey
          </p>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from "react"
import type React from 'react'
import { motion, AnimatePresence } from "framer-motion"
import { signIn } from "next-auth/react"
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { plex } from "@/app/fonts/plex"
import Image from 'next/image'
import BlueSkyLogin from './BlueSkyLogin'
import MastodonLoginButton from '../logins/MastodonLoginButton'
import { Button } from '@/app/_components/ui/Button'

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
}

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
}

export default function DashboardLoginButtons({
  connectedServices,
  hasUploadedArchive,
  onLoadingChange,
  mastodonInstances,
  isRefreshToken = false,
  blueskyNotFollowed = 0,
  mastodonNotFollowed = 0
}: DashboardLoginButtonsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [instanceText, setInstanceText] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const t = useTranslations('dashboardLoginButtons')
  const pathname = usePathname()

  const identifierRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const handleTwitterSignIn = async () => {
    setIsLoading(true)
    onLoadingChange(true)
    try {
      await signIn('twitter', { callbackUrl: '/dashboard' })
    } catch (error) {
      console.error('Error signing in with Twitter:', error)
    }
    setIsLoading(false)
    onLoadingChange(false)
  }

  const handleMastodonSignIn = async () => {
    if (!instanceText) {
      setError(t('services.mastodon.error.missing_instance'))
      return
    }

    setIsLoading(true)
    onLoadingChange(true)
    try {
      await signIn('mastodon', {
        instance: instanceText,
        callbackUrl: '/dashboard',
      })
    } catch (error) {
      console.error('Error signing in with Mastodon:', error)
    }
    setIsLoading(false)
    onLoadingChange(false)
  }

  const renderServiceButton = (service: string, icon: string, label: string) => (
    <div className="flex flex-col gap-2">
      {!pathname.includes('dashboard') && (
        <p className="text-sm text-white text-center p-4">
          {isRefreshToken ? (
            service === 'bluesky' ? (
              t('services.reconnect.bluesky')
            ) : service === 'mastodon' ? (
              t('services.reconnect.mastodon')
            ) : (
              t('services.refresh')
            )
          ) : (
            service === 'bluesky' ? (
              <>
                {t('services.connect_bluesky_before')} <span className="font-bold text-[#d6356f]">{blueskyNotFollowed}</span> {t('services.connect_bluesky_after')}
              </>
            ) : service === 'mastodon' ? (
              <>
                {t('services.connect_mastodon_before')} <span className="font-bold text-[#d6356f]">{mastodonNotFollowed}</span> {t('services.connect_mastodon_after')}
              </>
            ) : (
              t('services.connect')
            )
          )}
        </p>
      )}
      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <Button
          onClick={() => {
            if (service === 'twitter') {
              handleTwitterSignIn()
            } else {
              setSelectedService(selectedService === service ? null : service)
            }
          }}
          disabled={isLoading}
          className={`${plex.className} w-full sm:flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 px-8 py-6 rounded-full uppercase tracking-[0.25em] sm:tracking-[0.35em] border-2 transition-all duration-300 text-center`}
          style={{
            backgroundColor: 'transparent',
            borderColor: service === 'twitter' ? '#ff007f' : service === 'bluesky' ? '#007bff' : '#6d28d9',
            color: service === 'twitter' ? '#ff007f' : service === 'bluesky' ? '#007bff' : '#6d28d9',
            boxShadow:
              service === 'twitter'
                ? '0 0 15px rgba(255, 0, 127, 0.5), inset 0 0 15px rgba(255, 0, 127, 0.1)'
                : service === 'bluesky'
                  ? '0 0 15px rgba(0, 123, 255, 0.5), inset 0 0 15px rgba(0, 123, 255, 0.1)'
                  : '0 0 15px rgba(16, 185, 129, 0.5), inset 0 0 15px rgba(16, 185, 129, 0.1)',
            fontFamily: 'monospace',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (service === 'twitter') {
              e.currentTarget.style.backgroundColor = '#ff007f'
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.boxShadow = '0 0 30px #ff007f, inset 0 0 20px rgba(255, 0, 127, 0.3)'
            } else if (service === 'bluesky') {
              e.currentTarget.style.backgroundColor = '#007bff'
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.boxShadow = '0 0 30px #007bff, inset 0 0 20px rgba(0, 123, 255, 0.3)'
            } else {
              e.currentTarget.style.backgroundColor = '#6d28d9'
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.boxShadow = '0 0 30px #6d28d9, inset 0 0 20px rgba(16, 185, 129, 0.3)'
            }
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = service === 'twitter' ? '#ff007f' : service === 'bluesky' ? '#007bff' : '#6d28d9'
            e.currentTarget.style.boxShadow =
              service === 'twitter'
                ? '0 0 15px rgba(255, 0, 127, 0.5), inset 0 0 15px rgba(255, 0, 127, 0.1)'
                : service === 'bluesky'
                  ? '0 0 15px rgba(0, 123, 255, 0.5), inset 0 0 15px rgba(0, 123, 255, 0.1)'
                  : '0 0 15px rgba(16, 185, 129, 0.5), inset 0 0 15px rgba(16, 185, 129, 0.1)'
          }}
        >
          <div className="flex items-center justify-center gap-3 w-full flex-wrap">
            <Image src={icon} alt={service} width={24} height={24} className="flex-shrink-0" />
            <span className="flex-1 min-w-[150px] text-xs sm:text-sm leading-tight break-words whitespace-normal text-center">
              {label}
            </span>
          </div>
        </Button>
      </motion.div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className={`grid grid-cols-1 ${Object.values(connectedServices).filter(v => !v).length === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} gap-8 max-w-3xl mx-auto`}>
        {!connectedServices.twitter && (
          <div className="flex flex-col">
            {renderServiceButton('twitter', twitterIcon, t('connectedDashboard.twitter'))}
          </div>
        )}

        {!connectedServices.bluesky && (
          <div className="flex flex-col">
            {renderServiceButton('bluesky', blueskyIcon, t('connectedDashboard.bluesky'))}
            <AnimatePresence>
              {selectedService === 'bluesky' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-2xl shadow-xl text-black mt-2">
                    <BlueSkyLogin onLoginComplete={() => {
                      setSelectedService(null)
                      onLoadingChange(true)
                    }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!connectedServices.mastodon && (
          <div className="flex flex-col">
            {renderServiceButton('mastodon', mastodonIcon, t('connectedDashboard.mastodon'))}
            <AnimatePresence>
              {selectedService === 'mastodon' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-2xl shadow-xl text-black mt-2">
                    <MastodonLoginButton
                      onLoadingChange={onLoadingChange}
                      showForm={true}
                      instances={mastodonInstances}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

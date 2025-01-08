'use client'

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { signIn } from "next-auth/react"
import { useTranslations } from 'next-intl'
import { Loader2, AlertCircle, Lock, User, ChevronDown, Plus } from 'lucide-react'
import { plex } from "@/app/fonts/plex"
import { BskyAgent } from '@atproto/api'
import Image from 'next/image'
import BlueSkyLogin from './BlueSkyLogin'
import MastodonLoginButton from './MastodonLoginButton'

import mastodonIcon from '../../../public/newSVG/masto.svg'
import blueskyIcon from '../../../public/newSVG/BS.svg'
import twitterIcon from '../../../public/newSVG/X.svg'


interface DashboardLoginButtonsProps {
  connectedServices: {
    twitter?: boolean
    bluesky?: boolean
    mastodon?: boolean
  }
  hasUploadedArchive: boolean
  onLoadingChange: (isLoading: boolean) => void
  mastodonInstances: string[]
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
  mastodonInstances
}: DashboardLoginButtonsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [instanceText, setInstanceText] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const t = useTranslations('dashboardLoginButtons')
  
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
    <motion.button
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        if (service === 'twitter') {
          handleTwitterSignIn()
        } else {
          setSelectedService(selectedService === service ? null : service)
        }
      }}
      disabled={isLoading}
      className="w-full flex items-center justify-between px-8 py-4 bg-white rounded-full text-black font-medium hover:bg-gray-50 transition-colors relative overflow-hidden group"
    >
      <div className="flex items-center gap-3">
        <Image src={icon} alt={service} width={24} height={24} />
        <span>{label}</span>
      </div>
      <span className="text-gray-400 group-hover:text-black transition-colors">›</span>
    </motion.button>
  )

  return (
    <div className="space-y-2">
      {!connectedServices.twitter && (
        <>
          {renderServiceButton('twitter', twitterIcon, t('connectedDashboard.twitter'))}
        </>
      )}

      {!connectedServices.bluesky && (
        <>
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
        </>
      )}

    {!connectedServices.mastodon && (
            <>
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
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

    </div>
  )
}
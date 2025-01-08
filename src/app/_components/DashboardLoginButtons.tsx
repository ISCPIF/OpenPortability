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
                <div className="space-y-6 p-6 bg-white rounded-2xl shadow-xl text-black mt-2">
                  {error && (
                    <div className="flex items-center gap-2 text-red-600 mb-4">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      {/* <label className="block text-sm font-medium mb-1">
                        {t('services.mastodon.title')}
                      </label> */}
                      
                      {!showCustomInput ? (
                        <div className="relative">
                          <select
                            className={`w-full px-4 py-2 bg-white border-2 border-purple-500/20 hover:border-purple-500/50 focus:border-purple-500 rounded-xl text-black focus:ring-2 focus:ring-purple-400/30 focus:outline-none transition-all duration-200 ${plex.className}`}
                            value={instanceText}
                            onChange={(e) => setInstanceText(e.target.value)}
                          >
                            <option value="">{t('services.mastodon.instance')}</option>
                            {mastodonInstances.map((instance) => (
                              <option key={instance} value={instance}>
                                {instance}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={instanceText}
                          onChange={(e) => setInstanceText(e.target.value)}
                          placeholder={t('services.mastodon.write_instance')}
                          className={`w-full px-4 py-2 bg-white border-2 border-purple-500/20 hover:border-purple-500/50 focus:border-purple-500 rounded-xl text-black focus:ring-2 focus:ring-purple-400/30 focus:outline-none transition-all duration-200 ${plex.className}`}
                        />
                      )}

                      <button
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className="mt-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        {showCustomInput 
                          ? t('services.mastodon.return')
                          : t('services.mastodon.instance_not_yet')
                        }
                      </button>
                    </div>

                    <button
                      onClick={handleMastodonSignIn}
                      disabled={isLoading}
                      className="w-full p-4 text-lg font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-xl disabled:bg-purple-300 disabled:hover:bg-purple-300 transform hover:scale-105 transition-all duration-200 shadow-lg"
                    >
                      {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      ) : (
                        t('services.mastodon.connect')
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
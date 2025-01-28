'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from "next-auth/react"
import { motion } from 'framer-motion'
import { plex } from '@/app/fonts/plex'
import BlueSkyLogin from './BlueSkyLogin'
import BlueSkyLoginButton from './BlueSkyLoginButton'
import MastodonLoginButton from './MastodonLoginButton'

type Provider = 'bluesky' | 'mastodon'

interface RefreshTokenModaleProps {
  providers: Provider[]
  onClose?: () => void
  onReconnectMastodon?: () => void
}

export default function RefreshTokenModale({ 
  providers, 
  onClose, 
  onReconnectMastodon,
}: RefreshTokenModaleProps) {
  const t = useTranslations('refreshTokenModal')
  const { data: session, status } = useSession()
  const tServices = useTranslations('connectedAccounts.services')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([])

  useEffect(() => {
    if (session?.user) {
      const filtered = providers.filter(provider => {
        if (provider === 'bluesky' && !session.user.bluesky_username) {
          return false
        }
        if (provider === 'mastodon' && !session.user.mastodon_username) {
          return false
        }
        return true
      })
      setFilteredProviders(filtered)
    }
  }, [session, providers])

  if (!session || !session.user) return null

  

  // Formater les noms des providers pour l'affichage
  const formatProviderName = (provider: Provider) => {
    const translations: Record<Provider, string> = {
      bluesky: tServices('bluesky'),
      mastodon: tServices('mastodon')
    }
    return translations[provider]
  }

  const getDescription = () => {
    if (filteredProviders.length > 1) {
      const formattedProviders = filteredProviders
        .map(formatProviderName)
        .join(', ')
      return t('descriptionMultiple', { providers: formattedProviders })
    }
    return t('description', { provider: formatProviderName(filteredProviders[0]) })
  }

  const getDetails = () => {
    if (filteredProviders.length > 1) {
      return t('details.both')
    }
    return t(`details.${filteredProviders[0]}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg p-8 max-w-lg w-full mx-4"
      >
        <div className="text-center mb-8">
          <h2 className={`${plex.className} text-2xl font-bold mb-4`}>
            {t('title')}
          </h2>
          <p className="text-gray-600 mb-4">
            {getDescription()}
          </p>
          <p className="text-sm text-gray-500 mb-6 whitespace-pre-line">
            {getDetails()}
          </p>
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>

        <div className="space-y-4">
          {filteredProviders.includes('bluesky') && (
            <BlueSkyLogin 
              onLoginComplete={() => {
                if (filteredProviders.length === 1 && onClose) onClose()
              }} 
            />
          )}
          
          {filteredProviders.includes('mastodon') && (
            <MastodonLoginButton
              data-testid="mastodon-login-button"
              onLoadingChange={setIsLoading}
              onError={setError}
              showForm={true}
            />
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 w-full py-2 px-4 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            disabled={isLoading}
          >
            {t('close')}
          </button>
        )}
      </motion.div>
    </div>
  )
}
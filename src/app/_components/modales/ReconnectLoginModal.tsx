'use client'

import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'
import { ModalShell } from './ModalShell'
import DashboardLoginButtons from '../logins/DashboardLoginButtons'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { plex } from '@/app/fonts/plex'

interface ReconnectLoginModalProps {
  isOpen: boolean
  onClose: () => void
  invalidProviders: string[]
  noAccountsConfigured: boolean
  mastodonInstances: string[]
  connectedServices: {
    twitter?: boolean
    bluesky?: boolean
    mastodon?: boolean
  }
  onLoginComplete?: () => void
  allowDismiss?: boolean
  mode?: 'default' | 'addPlatform'
  userId?: string // For account linking
}

export function ReconnectLoginModal({
  isOpen,
  onClose,
  invalidProviders,
  noAccountsConfigured,
  mastodonInstances,
  connectedServices,
  onLoginComplete,
  allowDismiss = false,
  mode = 'default',
  userId,
}: ReconnectLoginModalProps) {
  const { isDark } = useTheme()
  const t = useTranslations('loginModal')

  const handleLoadingChange = (isLoading: boolean) => {
    if (!isLoading && onLoginComplete) {
      onLoginComplete()
    }
  }

  // Determine which message to show
  const getTitle = () => {
    if (mode === 'addPlatform') {
      return t('addPlatformTitle')
    }
    if (noAccountsConfigured) {
      return t('noAccountsTitle')
    }
    if (invalidProviders.length > 0) {
      return t('expiredTitle')
    }
    return t('title')
  }

  const getMessage = () => {
    if (mode === 'addPlatform') {
      return t('addPlatformMessage')
    }
    if (noAccountsConfigured) {
      return t('noAccountsMessage')
    }
    if (invalidProviders.length > 0) {
      const providers = invalidProviders.join(' & ')
      return t('expiredMessage', { providers })
    }
    return t('message')
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      theme={isDark ? 'dark' : 'light'}
      size="lg"
      ariaLabel={getTitle()}
      closeOnOverlayClick={allowDismiss}
      closeOnEscape={allowDismiss}
      showCloseButton={allowDismiss}
    >
      <div className="space-y-6">
        {/* Header with icon */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div 
            className={`
              flex items-center justify-center w-16 h-16 rounded-full
              ${mode === 'addPlatform' || noAccountsConfigured 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-amber-500/20 text-amber-400'
              }
            `}
          >
            {mode === 'addPlatform' || noAccountsConfigured ? (
              <RefreshCw className="w-8 h-8" />
            ) : (
              <AlertTriangle className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-2">
            <h2 className={`${plex.className} text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {getTitle()}
            </h2>
            <p className={`text-sm max-w-md ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
              {getMessage()}
            </p>
          </div>
        </div>

        {/* Expired providers badges */}
        {invalidProviders.length > 0 && (
          <div className="flex justify-center gap-2">
            {invalidProviders.map(provider => (
              <span
                key={provider}
                className={`
                  px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider
                  ${provider === 'bluesky' 
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                    : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  }
                `}
              >
                {provider}
              </span>
            ))}
          </div>
        )}

        {/* Login buttons */}
        <DashboardLoginButtons
          connectedServices={connectedServices}
          hasUploadedArchive={true}
          onLoadingChange={handleLoadingChange}
          mastodonInstances={mastodonInstances}
          isRefreshToken={invalidProviders.length > 0}
          userId={userId}
          invalidProviders={invalidProviders}
        />

        {/* Skip button - allows viewing global view only */}
        <div className="flex justify-center pt-2">
          <button
            onClick={onClose}
            className={`
              text-sm underline underline-offset-4 transition-colors
              ${isDark 
                ? 'text-white/50 hover:text-white/70' 
                : 'text-slate-400 hover:text-slate-600'
              }
            `}
          >
            {t('skipButton')}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

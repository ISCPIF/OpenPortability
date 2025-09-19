'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { plex } from '@/app/fonts/plex'
import DashboardLoginButtons from './DashboardLoginButtons'

type Provider = 'bluesky' | 'mastodon'

interface RefreshTokenModaleProps {
  providers: Provider[]
  mastodonInstances: string[]
  onClose?: () => void
}

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

export default function RefreshTokenModale({ providers, mastodonInstances, onClose }: RefreshTokenModaleProps) {
  const [isLoading, setIsLoading] = useState(false)
  const t = useTranslations('refreshToken')

  // Convert providers array to connectedServices object
  // Si un provider est dans le tableau providers, il n'est PAS connecté
  const connectedServices = {
    bluesky: true,
    mastodon: true,
    ...Object.fromEntries(providers.map(provider => [provider, false]))
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`${plex.className} bg-gradient-to-b from-blue-950 to-blue-900 rounded-xl p-6 max-w-md w-full shadow-xl border border-blue-800`}
      >
        <h2 className="text-2xl font-semibold mb-4 text-white">{t('title')}</h2>
        <p className="text-blue-100 mb-6">{t('description')}</p>
        
        <DashboardLoginButtons
          connectedServices={connectedServices}
          hasUploadedArchive={true}
          onLoadingChange={setIsLoading}
          mastodonInstances={mastodonInstances}
        />

        <button
          onClick={onClose}
          className="mt-6 w-full py-2 px-4 bg-blue-800 hover:bg-blue-700 text-white rounded transition-colors"
        >
          {t('close')}
        </button>
      </motion.div>
    </div>
  )
}

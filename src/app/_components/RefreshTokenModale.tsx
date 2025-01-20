'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { plex } from '@/app/fonts/plex'
import BlueSkyLogin from './BlueSkyLogin'

interface RefreshTokenModaleProps {
  invalidProviders: string[]
  onClose?: () => void
}

export default function RefreshTokenModale({ invalidProviders, onClose }: RefreshTokenModaleProps) {
  const t = useTranslations('refreshTokenModal')

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
          <p className="text-gray-600 mb-6">
            {t('description')}
          </p>
        </div>

        <BlueSkyLogin onLoginComplete={() => {
          if (onClose) onClose()
        }} />

        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 w-full py-2 px-4 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
          >
            {t('close')}
          </button>
        )}
      </motion.div>
    </div>
  )
}
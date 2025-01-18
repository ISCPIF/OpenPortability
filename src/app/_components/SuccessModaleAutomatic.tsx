'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { plex } from '@/app/fonts/plex'
import Image from 'next/image'
import SuccessBadge from '../../../public/v2/success-badge.svg'

interface SuccessModaleAutomaticProps {
  totalAccounts: number
  onClose?: () => void
}

export default function SuccessModaleAutomatic({ totalAccounts, onClose }: SuccessModaleAutomaticProps) {
  const t = useTranslations('reconnexionModal')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 text-center relative"
      >
        {/* Icône de succès */}
        <div className="mb-6">
          <Image
            src={SuccessBadge}
            alt="Success"
            width={80}
            height={80}
            className="mx-auto"
          />
        </div>

        {/* Titre */}
        <h2 className={`${plex.className} text-2xl font-bold mb-4`}>
          {t('title', { count: totalAccounts })}
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {t('message')}
        </p>

        {/* Bouton */}
        <button
          onClick={onClose}
          className="bg-[#2a39a9] text-white font-bold py-3 px-6 rounded-full uppercase tracking-wide hover:bg-[#1a237e] transition-colors"
        >
          {t('stayInformed')}
        </button>
      </motion.div>
    </div>
  )
}
'use client'

import { Share2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { plex } from '../fonts/plex'
import { useTranslations } from 'next-intl'

interface PartageButtonProps {
  onClick: () => void
}

export default function PartageButton({ onClick }: PartageButtonProps) {
  const t = useTranslations('partageButton')

  return (
    <div className="flex justify-center">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-6 py-3 
                 bg-gradient-to-r from-pink-400/20 to-rose-500/20 hover:from-pink-400/30 hover:to-rose-500/30
                 text-white rounded-xl border border-pink-500/20 transition-all duration-200 ${plex.className}`}
      >
        <Share2 className="w-5 h-5 text-pink-400" />
        {t('share')}
      </motion.button>
    </div>
  )
}
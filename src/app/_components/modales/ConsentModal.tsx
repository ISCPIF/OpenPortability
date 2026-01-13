'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ShieldCheck, CheckCircle2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

import { cn } from '../ui/utils'
import { quantico } from '@/app/fonts/plex'

import logoBlanc from '@/../public/logo/logo-openport-blanc.svg'

interface ConsentModalProps {
  isOpen: boolean
  onAccept: () => void
  onDecline: () => void
}

export default function ConsentModal({ isOpen, onAccept, onDecline }: ConsentModalProps) {
  const t = useTranslations('consentModal')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const conditions = [
    { key: 'ownership', text: t('conditions.ownership') },
    { key: 'cnrsUsage', text: t('conditions.cnrsUsage') },
    { key: 'profileCreation', text: t('conditions.profileCreation') },
  ]

  if (!mounted) return null

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className={cn(
              quantico.className,
              'relative w-full max-w-lg bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-xl overflow-hidden'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-700/50">
              <Image
                src={logoBlanc}
                alt="OpenPort Logo"
                width={140}
                height={42}
                className="mx-auto mb-4 h-auto w-28 sm:w-36"
                priority
              />
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h2 className="text-base sm:text-lg font-semibold text-white tracking-wide">
                  {t('title')}
                </h2>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Description */}
              <p className="text-[13px] text-slate-300 text-center leading-relaxed">
                {t('description')}
              </p>

              {/* Conditions list */}
              <div className="space-y-2">
                {conditions.map((condition) => (
                  <div
                    key={condition.key}
                    className="flex items-start gap-3 rounded-lg bg-slate-800/50 border border-slate-700/30 p-3 transition-all hover:bg-slate-800/70"
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                    <span className="text-[12px] text-slate-200 leading-relaxed">
                      {condition.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-700/50 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onAccept}
                className="w-full max-w-xs py-2.5 px-6 text-[13px] font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg transition-all shadow-lg shadow-amber-500/20"
              >
                {t('buttons.accept')}
              </button>
              <button
                type="button"
                className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors"
                onClick={onDecline}
              >
                {t('buttons.cancel')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
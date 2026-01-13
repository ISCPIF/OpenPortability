'use client'

import { motion } from "framer-motion"
import { SiBluesky } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

interface BlueSkyLoginButtonProps {
  onLoadingChange?: (isLoading: boolean) => void;
  isConnected?: boolean;
  isSelected?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function BlueSkyLoginButton({
  onLoadingChange = () => { },
  isConnected = false,
  isSelected = false,
  className = "",
  onClick = () => {}
}: BlueSkyLoginButtonProps) {
  const t = useTranslations('dashboardLoginButtons')
  const { isDark } = useTheme()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="w-full"
    >
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        disabled={isConnected}
        className={`${plex.className} group relative w-full rounded-2xl border border-sky-500/30 bg-[#0085FF] p-5 text-left transition-all duration-300 shadow-[0_0_25px_rgba(0,133,255,0.25)] hover:shadow-[0_0_35px_rgba(0,133,255,0.35)] hover:border-sky-400/50 disabled:opacity-70 disabled:cursor-not-allowed`}
      >

        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <SiBluesky className="h-6 w-6 text-white" />
          </div>

          <div className="flex-1">
            <p className="text-base font-semibold text-white">
              {isConnected ? t('connected') : t('services.bluesky')}
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
            {isConnected ? (
              <CheckCircle2 className="h-5 w-5 text-white" />
            ) : (
              <ArrowRight className={`h-5 w-5 text-white transition-transform ${isSelected ? 'rotate-90' : ''}`} />
            )}
          </div>
        </div>
      </motion.button>
    </motion.div>
  )
}
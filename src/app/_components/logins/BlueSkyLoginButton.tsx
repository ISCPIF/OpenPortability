'use client'

import { motion, type Variants } from "framer-motion"
import { SiBluesky } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'

interface BlueSkyLoginButtonProps {
  onLoadingChange?: (isLoading: boolean) => void;
  isConnected?: boolean;
  isSelected?: boolean;
  className?: string;
  onClick?: () => void;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30
    }
  },
  exit: { opacity: 0, y: -8, scale: 0.95 }
}

export default function BlueSkyLoginButton({
  onLoadingChange = () => { },
  isConnected = false,
  isSelected = false,
  className = "",
  onClick = () => {}
}: BlueSkyLoginButtonProps) {
  const t = useTranslations('dashboardLoginButtons')

  return (
    <motion.button
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 w-full px-4 py-2 text-white 
                 ${isSelected 
                   ? 'bg-[#0074e0] ring-2 ring-sky-400/50' 
                   : 'bg-[#0085FF] hover:bg-[#0074e0]'} 
                 rounded-lg transition-all duration-200 ${plex.className} ${className}`}
      disabled={isConnected}
    >
      <SiBluesky className="w-5 h-5" />
      <span>
        {isConnected ? t('connected') : t('services.bluesky')}
      </span>
    </motion.button>
  )
}
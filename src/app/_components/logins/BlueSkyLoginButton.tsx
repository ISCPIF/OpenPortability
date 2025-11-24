'use client'

import { motion, type Variants } from "framer-motion"
import { SiBluesky } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'
import { Button } from '@/app/_components/ui/Button'
import { useTheme } from '@/hooks/useTheme'

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
  const { isDark } = useTheme()

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full"
    >
      <Button 
        onClick={onClick}
        className="w-full px-8 py-6 tracking-widest border-2 transition-all duration-300 flex items-center justify-center gap-2"
        style={{
          backgroundColor: isDark ? 'transparent' : '#0074e0',
          borderColor: '#0074e0',
          color: '#ffffff',
          boxShadow: isDark 
            ? '0 0 15px rgba(255, 0, 127, 0.5), inset 0 0 15px rgba(255, 0, 127, 0.1)'
            : '0 0 15px rgba(0, 116, 224, 0.3)',
          fontFamily: 'monospace',
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (isDark) {
            e.currentTarget.style.backgroundColor = '#0074e0';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.boxShadow = '0 0 30px #0074e0, inset 0 0 20px rgba(255, 0, 127, 0.3)';
          } else {
            e.currentTarget.style.backgroundColor = '#0056b3';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 116, 224, 0.6)';
          }
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (isDark) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 0, 127, 0.5), inset 0 0 15px rgba(255, 0, 127, 0.1)';
          } else {
            e.currentTarget.style.backgroundColor = '#0074e0';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 116, 224, 0.3)';
          }
        }}
        disabled={isConnected}
      >
        <SiBluesky className="w-5 h-5" />
      <span>
        {isConnected ? t('connected') : t('services.bluesky')}
      </span>
      </Button>
    </motion.div>
  )
}
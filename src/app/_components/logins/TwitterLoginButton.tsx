'use client'

import { signIn } from "next-auth/react"
import { motion, type Variants } from "framer-motion"
import { FaXTwitter } from 'react-icons/fa6'
import { plex } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'
import { Button } from '@/app/_components/ui/Button'
import { useTheme } from '@/hooks/useTheme'

interface TwitterLoginButtonProps {
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

export default function TwitterLoginButton({
  onLoadingChange = () => { },
  isConnected = false,
  isSelected = false,
  className = "",
  onClick
}: TwitterLoginButtonProps) {
  const t = useTranslations('dashboardLoginButtons')
  const { isDark } = useTheme()

  const handleSignIn = async () => {
    try {
      onLoadingChange(true)
      const result = await signIn("twitter", {
        redirect: false,
        callbackUrl: '/dashboard'
      })

      if (result?.error) {
        if (result.error.includes("temporairement indisponible")) {
          window.location.href = `/auth/error?error=RateLimit`;
        } else if (result.error.includes("Configuration")) {
          window.location.href = `/auth/error?error=Configuration`;
        } else if (result.error.includes("OAuthSignin")) {
          window.location.href = `/auth/error?error=OAuthSignin`;
        } else if (result.error.includes("OAuthCallback")) {
          window.location.href = `/auth/error?error=OAuthCallback`;
        } else if (result.error.includes("AccessDenied")) {
          window.location.href = `/auth/error?error=AccessDenied`;
        } else {
          window.location.href = `/auth/error?error=Default&message=${encodeURIComponent(result.error)}`;
        }
      } else if (result?.ok && result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Error during Twitter sign in:", error)
    } finally {
      onLoadingChange(false)
    }
  }

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full"
    >
      <Button 
        onClick={onClick ?? handleSignIn}
        className="w-full px-8 py-6 tracking-widest border-2 transition-all duration-300 flex items-center justify-center gap-2"
        style={{
          backgroundColor: isDark ? 'transparent' : '#000000',
          borderColor: isDark ? '#ffffff' : '#000000',
          color: '#ffffff',
          boxShadow: isDark 
            ? '0 0 15px rgba(0,123,255,0.5), inset 0 0 15px rgba(0,123,255,0.1)'
            : '0 0 15px rgba(0,0,0,0.3)',
          fontFamily: 'monospace',
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (isDark) {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.color = '#000000';
            e.currentTarget.style.boxShadow = '0 0 30px #007bff, inset 0 0 20px rgba(0,123,255,0.3)';
          } else {
            e.currentTarget.style.backgroundColor = '#1a1a1a';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(0,0,0,0.6)';
          }
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
          if (isDark) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0,123,255,0.5), inset 0 0 15px rgba(0,123,255,0.1)';
          } else {
            e.currentTarget.style.backgroundColor = '#000000';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0,0,0,0.3)';
          }
        }}
        disabled={isConnected}
      >
        <FaXTwitter className="w-5 h-5" />
      <span>
        {isConnected ? t('connected') : t('services.twitter')}
      </span>
            </Button>
    </motion.div>
  )
}

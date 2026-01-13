'use client'

import { useState } from 'react'
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { FaXTwitter } from 'react-icons/fa6'
import { quantico } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'
import { Loader2, Zap, CheckCircle2 } from 'lucide-react'

interface TwitterLoginButtonProps {
  onLoadingChange?: (isLoading: boolean) => void;
  isConnected?: boolean;
  isSelected?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function TwitterLoginButton({
  onLoadingChange = () => { },
  isConnected = false,
  isSelected = false,
  className = "",
  onClick
}: TwitterLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const t = useTranslations('dashboardLoginButtons')
  const { isDark } = useTheme()

  const handleSignIn = async () => {
    try {
      setIsLoading(true)
      onLoadingChange(true)
      const result = await signIn("twitter", {
        redirect: false,
        callbackUrl: '/reconnect'
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
      setIsLoading(false)
      onLoadingChange(false)
    }
  }

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
        onClick={onClick ?? handleSignIn}
        disabled={isConnected || isLoading}
        className={`${quantico.className} group relative w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-left transition-all duration-300 shadow-[0_0_25px_rgba(255,255,255,0.08)] hover:shadow-[0_0_35px_rgba(255,255,255,0.12)] hover:border-zinc-600 disabled:opacity-70 disabled:cursor-not-allowed`}
      >

        <div className="relative flex items-center gap-4">
          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <FaXTwitter className="h-6 w-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1">
            <p className="text-base font-semibold text-white">
              {isConnected ? t('connected') : t('services.twitter')}
            </p>
          </div>

          {/* Action indicator */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : isConnected ? (
              <CheckCircle2 className="h-5 w-5 text-white" />
            ) : (
              <Zap className="h-5 w-5 text-white" />
            )}
          </div>
        </div>
      </motion.button>
    </motion.div>
  )
}

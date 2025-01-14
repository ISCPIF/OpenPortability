'use client'

import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { FaXTwitter } from 'react-icons/fa6'
import { plex } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'

interface TwitterLoginButtonProps {
  onLoadingChange?: (isLoading: boolean) => void;
  isConnected?: boolean;
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30
    }
  }
}

export default function TwitterLoginButton({
  onLoadingChange = () => { },
  isConnected = false,
  className = ""
}: TwitterLoginButtonProps) {
  const t = useTranslations('dashboardLoginButtons')

  const handleSignIn = async () => {
    try {
      onLoadingChange(true)
      const result = await signIn("twitter", {
        redirect: false,
        callbackUrl: '/dashboard?linking=true'
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
    <motion.button
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleSignIn}
      className={`flex items-center justify-center gap-2 w-full px-4 py-2 text-white border bg-[#282729] border-white  hover:bg-gray-600 rounded-lg transition-colors ${plex.className} ${className}`}
      disabled={isConnected}
    >
      <FaXTwitter className="w-5 h-5" />
      <span>
        {isConnected ? t('connected') : t('services.twitter')}
      </span>
    </motion.button>
  )
}

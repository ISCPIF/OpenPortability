'use client'

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { SiMastodon } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { ChevronDown, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface MastodonLoginButtonProps {
  onLoadingChange?: (isLoading: boolean) => void;
  isConnected?: boolean;
  isSelected?: boolean;
  className?: string;
  onClick?: () => void;
  showForm?: boolean;
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

export default function MastodonLoginButton({
  onLoadingChange = () => { },
  isConnected = false,
  isSelected = false,
  className = "",
  onClick = () => {},
  showForm = false
}: MastodonLoginButtonProps) {
  const [instanceText, setInstanceText] = useState('')
  const [instances, setInstances] = useState<string[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const t = useTranslations('dashboardLoginButtons')

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const response = await fetch('/api/auth/mastodon')
        const data = await response.json()
        if (data.success) {
          setInstances(data.instances)
        }
      } catch (error) {
        console.error('Error fetching Mastodon instances:', error)
      }
    }

    if (showForm) {
      fetchInstances()
    }
  }, [showForm])

  const handleSignIn = async () => {
    if (!instanceText) return

    try {
      onLoadingChange(true)
      const result = await signIn("mastodon", {
        redirect: false,
        callbackUrl: '/dashboard'
      }, { instance: instanceText })

      if (result?.error) {
        if (result.error.includes("temporairement indisponible")) {
          window.location.href = `/auth/error?error=RateLimit`
        } else if (result.error.includes("Configuration")) {
          window.location.href = `/auth/error?error=Configuration`
        } else if (result.error.includes("OAuthSignin")) {
          window.location.href = `/auth/error?error=OAuthSignin`
        } else if (result.error.includes("OAuthCallback")) {
          window.location.href = `/auth/error?error=OAuthCallback`
        } else if (result.error.includes("AccessDenied")) {
          window.location.href = `/auth/error?error=AccessDenied`
        } else {
          window.location.href = `/auth/error?error=Default&message=${encodeURIComponent(result.error)}`
        }
      } else if (result?.ok && result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error("Error during Mastodon sign in:", error)
    } finally {
      onLoadingChange(false)
    }
  }

  if (!showForm) {
    return (
      <motion.button
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClick}
        className={`flex items-center justify-center gap-2 w-full px-4 py-2 text-white 
                   ${isSelected 
                     ? 'bg-[#4c32b5] ring-2 ring-purple-400/50' 
                     : 'bg-[#563ACC] hover:bg-[#4c32b5]'} 
                   rounded-lg transition-all duration-200 ${plex.className} ${className}`}
        disabled={isConnected}
      >
        <SiMastodon className="w-5 h-5" />
        <span>
          {isConnected ? t('connected') : t('services.mastodon.title')}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
      </motion.button>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-2xl shadow-xl text-black">
      <div className="space-y-4">
        {!showCustomInput ? (
          <>
            <div className="relative">
              <select
                value={instanceText}
                onChange={(e) => setInstanceText(e.target.value)}
                className="w-full p-4 bg-white border-2 border-blue-500/20 hover:border-blue-500/50 focus:border-blue-500 rounded-xl text-black focus:ring-2 focus:ring-blue-400/30 focus:outline-none transition-all duration-200 text-sm appearance-none cursor-pointer shadow-sm"
              >
                <option value="" disabled className="text-gray-500">
                  {t('services.mastodon.instance')}
                </option>
                {instances.map((instance) => (
                  <option key={instance} value={instance} className="py-2">
                    {instance}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-600">
                <ChevronDown className="w-4 h-4 transition-transform" />
              </div>
            </div>

            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-2 text-sm text-blue-600/80 hover:text-blue-500 transition-colors group"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
              {t('services.mastodon.instance_not_yet')}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setShowCustomInput(false)}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
            {t('services.mastodon.return')}

            </button>
            <input
              type="text"
              value={instanceText}
              onChange={(e) => setInstanceText(e.target.value)}
              placeholder={t('services.mastodon.write_instance')}
              className="w-full p-4 bg-white border-2 border-blue-500 rounded-xl text-black placeholder-gray-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-200 text-sm"
            />
          </div>
        )}
      </div>
      
      {instanceText && (
        <button
          onClick={handleSignIn}
          className="w-full p-4 text-lg font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl disabled:bg-blue-300 disabled:hover:bg-blue-300 transform hover:scale-105 transition-all duration-200 shadow-lg"
        >
          {t('services.mastodon.connect')}
        </button>
      )}
    </div>
  )
}
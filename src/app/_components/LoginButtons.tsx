'use client'

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import TwitterLoginButton from "./TwitterLoginButton"
import MastodonLoginButton from "./MastodonLoginButton"
import BlueSkyLoginButton from "./BlueSkyLoginButton"
import BlueSkyLogin from "./BlueSkyLogin"
import TwitterRateLimit from "./TwitterRateLimit"
import { plex } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'


const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3
    }
  }
}

type ActiveService = 'bluesky' | 'mastodon' | 'twitter' | null;

interface LoginButtonsProps {
  onLoadingChange: (isLoading: boolean) => void;
  onError?: (error: string | null) => void;
}

export default function LoginButtons({ onLoadingChange, onError }: LoginButtonsProps) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [activeService, setActiveService] = useState<ActiveService>(null)
  const [error, setError] = useState<string | null>(null)

  const handleServiceSelect = (service: ActiveService) => {
    setActiveService(service === activeService ? null : service)
    setError(null)
    onError?.(null)
  }

  const handleError = (error: string) => {
    if (error.includes('temporairement indisponible')) {
      setIsRateLimited(true)
    } else {
      setError(error)
      onError?.(error)
    }
  }

  return (
    <div className="max-w-96 mx-auto mt-8">
      {isRateLimited && (
        <TwitterRateLimit onShowAlternatives={() => setShowAlternatives(true)} />
      )}

      
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <TwitterLoginButton 
          onLoadingChange={onLoadingChange} 
          className={plex.className}
          isSelected={activeService === 'twitter'}
          onClick={() => handleServiceSelect('twitter')}
        />

        {(showAlternatives || !isRateLimited) && (
          <>
            <BlueSkyLoginButton 
              onLoadingChange={onLoadingChange} 
              className={plex.className}
              isSelected={activeService === 'bluesky'}
              onClick={() => handleServiceSelect('bluesky')}
            />
            
            <MastodonLoginButton 
              onLoadingChange={onLoadingChange} 
              className={plex.className}
              isSelected={activeService === 'mastodon'}
              onClick={() => handleServiceSelect('mastodon')}
            />
          </>
        )}

        <AnimatePresence mode="wait">
          {activeService === 'bluesky' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6">
                <BlueSkyLogin onLoginComplete={() => {
                  setActiveService(null)
                  onLoadingChange(true)
                }} />
              </div>
            </motion.div>
          )}

          {activeService === 'mastodon' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 p-6 bg-white/5 backdrop-blur-lg rounded-xl">
                <MastodonLoginButton 
                  onLoadingChange={onLoadingChange}
                  className={plex.className}
                  showForm={true}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
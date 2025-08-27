'use client'

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import TwitterLoginButton from "./TwitterLoginButton"
import MastodonLoginButton from "./MastodonLoginButton"
import BlueSkyLoginButton from "./BlueSkyLoginButton"
import FacebookLoginButton from "./FacebookLoginButton"
import BlueSkyLogin from "./BlueSkyLogin"
import TwitterRateLimit from "./TwitterRateLimit"
import { plex } from "@/app/fonts/plex"
import { useTranslations } from 'next-intl'
import { useMastodonInstances } from '@/hooks/useMastodonInstances'


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

type ActiveService = 'bluesky' | 'mastodon' | 'twitter' | 'facebook' | null;

interface LoginButtonsProps {
  onLoadingChange: (isLoading: boolean) => void;
  onError?: (error: string | null) => void;
}

export default function LoginButtons({ onLoadingChange, onError }: LoginButtonsProps) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [activeService, setActiveService] = useState<ActiveService>(null)
  const [error, setError] = useState<string | null>(null)
  const mastodonInstances = useMastodonInstances()

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
    <div className="w-full mx-auto bg-transparent">
      {isRateLimited && (
        <TwitterRateLimit onShowAlternatives={() => setShowAlternatives(true)} />
      )}
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4 bg-transparent"
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
              instances={mastodonInstances}
              onClick={() => handleServiceSelect('mastodon')}
            />
            
            <FacebookLoginButton 
              onLoadingChange={onLoadingChange} 
              className={plex.className}
              isSelected={activeService === 'facebook'}
              onClick={null} 
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
              <div className="mt-4 sm:mt-6">
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
              <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-white/5 backdrop-blur-lg rounded-xl">
                <MastodonLoginButton 
                  onLoadingChange={onLoadingChange}
                  className={plex.className}
                  showForm={true}
                  instances={mastodonInstances}
                  onError={handleError}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
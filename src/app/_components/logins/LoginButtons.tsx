'use client'

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import TwitterLoginButton from "./TwitterLoginButton"
import MastodonLoginButton from "./MastodonLoginButton"
import BlueSkyLoginButton from "./BlueSkyLoginButton"
import BlueSkyLogin from "./BlueSkyLogin"
import { plex, quantico } from "@/app/fonts/plex"
import { useMastodonInstances } from '@/hooks/useMastodonInstances'
import { useTheme } from '@/hooks/useTheme'
import { Sparkles, ShieldCheck } from 'lucide-react'

type ActiveService = 'bluesky' | 'mastodon' | 'twitter' | null;

interface LoginButtonsProps {
  onLoadingChange: (isLoading: boolean) => void;
  onError?: (error: string | null) => void;
  userId?: string; // For account linking
}

export default function LoginButtons({ onLoadingChange, onError, userId }: LoginButtonsProps) {
  const [activeService, setActiveService] = useState<ActiveService>(null)
  const [error, setError] = useState<string | null>(null)
  const mastodonInstances = useMastodonInstances()
  const { isDark } = useTheme()

  const handleServiceSelect = (service: ActiveService) => {
    setActiveService(service === activeService ? null : service)
    setError(null)
    onError?.(null)
  }

  const handleError = (error: string) => {
    setError(error)
    onError?.(error)
  }

  const cardClasses = isDark
    ? 'bg-gradient-to-br from-white/10 via-white/5 to-transparent border-white/10 text-white shadow-[0_25px_50px_rgba(0,0,0,0.4)]'
    : 'bg-white/80 border-white/70 text-slate-900 shadow-[0_25px_50px_rgba(15,23,42,0.15)]'

  return (
    <div className={`relative rounded-2xl border p-6 sm:p-8 transition-all duration-300 ${cardClasses}`}>
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <div
          className="absolute inset-x-8 top-0 h-px opacity-60"
          style={{ backgroundImage: 'linear-gradient(90deg, #ff4fa8, #38bdf8, transparent)' }}
        />
        <div
          className="absolute -left-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-20"
          style={{ background: '#ff4fa8' }}
        />
        <div
          className="absolute -right-12 -bottom-12 w-40 h-40 rounded-full blur-3xl opacity-20"
          style={{ background: '#8b5cf6' }}
        />
      </div>

      <div className="relative space-y-6">
        {/* Header */}
        <div className={`${quantico.className} flex items-center gap-3 text-xs uppercase tracking-[0.35em] opacity-80`}>
          <Sparkles className="h-4 w-4" />
          <span>Sign in to continue</span>
          <span className="ml-auto flex items-center gap-1.5 text-[10px]">
            <ShieldCheck className="h-3.5 w-3.5" />
            OAuth secured
          </span>
        </div>

        {/* Service buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <TwitterLoginButton 
            onLoadingChange={onLoadingChange} 
            className={quantico.className}
          />

          <BlueSkyLoginButton 
            onLoadingChange={onLoadingChange} 
            className={quantico.className}
            isSelected={activeService === 'bluesky'}
            onClick={() => handleServiceSelect('bluesky')}
          />
          
          <MastodonLoginButton 
            onLoadingChange={onLoadingChange} 
            className={quantico.className}
            isSelected={activeService === 'mastodon'}
            instances={mastodonInstances}
            onClick={() => handleServiceSelect('mastodon')}
          />
        </motion.div>

        {/* Expanded forms */}
        <AnimatePresence mode="wait">
          {activeService === 'bluesky' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`rounded-2xl border p-1 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                <BlueSkyLogin 
                  userId={userId}
                  onLoginComplete={() => {
                    setActiveService(null)
                    onLoadingChange(true)
                  }} 
                />
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
              <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                <MastodonLoginButton 
                  onLoadingChange={onLoadingChange}
                  className={quantico.className}
                  showForm={true}
                  instances={mastodonInstances}
                  onError={handleError}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
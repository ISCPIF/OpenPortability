'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Home, RefreshCw, HelpCircle } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { quantico } from '@/app/fonts/plex'
import { useTheme } from '@/hooks/useTheme'
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground'
import SupportModal from '@/app/_components/modales/SupportModale'
import logoBlanc from '@/../public/logo/logo-openport-blanc.svg'
import logoRose from '@/../public/logos/logo-openport-rose.svg'

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const message = searchParams.get('message')
  const [retryTime, setRetryTime] = useState<number | null>(null)
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false)
  const { isDark, colors } = useTheme()
  const t = useTranslations('authError')

  useEffect(() => {
    if (error === 'RateLimit') {
      const resetTimeStr = searchParams.get('reset')
      if (resetTimeStr) {
        const resetTime = new Date(parseInt(resetTimeStr))
        const now = new Date()
        const waitSeconds = Math.ceil((resetTime.getTime() - now.getTime()) / 1000)
        setRetryTime(waitSeconds)
      }
    }
  }, [error, searchParams])

  const getErrorInfo = (errorCode: string, customMessage?: string) => {
    const validCodes = ['MastodonAccountAlreadyLinked', 'BlueskyAccountAlreadyLinked', 'TwitterAccountAlreadyLinked', 'RateLimit', 'InvalidProfile', 'Configuration', 'OAuthSignin', 'OAuthCallback', 'AccessDenied']
    const code = validCodes.includes(errorCode) ? errorCode : 'Default'
    
    // Special handling for RateLimit with time
    if (code === 'RateLimit' && retryTime) {
      return {
        title: t(`errors.${code}.title`),
        message: t('errors.RateLimit.messageWithTime', { 
          minutes: Math.floor(retryTime / 60), 
          seconds: retryTime % 60 
        }),
        action: t(`errors.${code}.action`)
      }
    }
    
    return {
      title: t(`errors.${code}.title`),
      message: customMessage || t(`errors.${code}.message`),
      action: t(`errors.${code}.action`)
    }
  }

  const { title, message: displayMessage, action } = getErrorInfo(error || 'Default', message || undefined)

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: colors.background }}
    >
      <ParticulesBackground />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src={isDark ? logoBlanc : logoRose}
            alt="OpenPort Logo"
            width={180}
            height={54}
            className="h-auto w-[140px] sm:w-[180px]"
            priority
          />
        </div>

        {/* Error Card */}
        <div className={`${quantico.className} rounded-xl backdrop-blur-sm border shadow-xl overflow-hidden ${
          isDark 
            ? 'bg-slate-900/95 border-slate-700/50' 
            : 'bg-white/90 border-slate-200'
        }`}>
          {/* Header */}
          <div className={`px-5 py-4 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                isDark 
                  ? 'bg-red-500/20 border-red-500/30' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h1 className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {title}
                </h1>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('subtitle')}
                </p>
              </div>
            </div>
          </div>
          
          {/* Body */}
          <div className="px-5 py-4">
            <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {displayMessage}
            </p>
          </div>
          
          {/* Footer */}
          <div className={`px-5 py-4 border-t flex flex-wrap justify-end gap-3 ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <button
              onClick={() => window.location.href = '/'}
              className={`flex items-center gap-2 px-4 py-2 text-[12px] font-medium rounded-lg transition-all ${
                isDark 
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Home className="w-4 h-4" />
              {t('home')}
            </button>
            <button
              onClick={() => setIsSupportModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 text-[12px] font-medium rounded-lg transition-all ${
                isDark 
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/30' 
                  : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-300'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              {t('support')}
            </button>
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className={`flex items-center gap-2 px-4 py-2 text-[12px] font-medium rounded-lg transition-all ${
                isDark
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-500/20'
                  : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-500/20'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              {action}
            </button>
          </div>
        </div>

        {/* Error code badge */}
        {error && (
          <div className="flex justify-center mt-4">
            <span className={`text-[10px] px-3 py-1 rounded-full ${
              isDark 
                ? 'bg-slate-800/50 text-slate-500 border border-slate-700/50' 
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}>
              {t('errorCode')}: {error}
            </span>
          </div>
        )}
      </motion.div>

      {/* Support Modal */}
      <SupportModal 
        isOpen={isSupportModalOpen} 
        onClose={() => setIsSupportModalOpen(false)} 
      />
    </div>
  )
}
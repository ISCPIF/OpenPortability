import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from "next-auth/react"
import { useSearchParams } from 'next/navigation'
import { SiMastodon } from 'react-icons/si'
import { quantico } from "@/app/fonts/plex"
import { Loader2, AlertCircle, Globe, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'

// Error codes matching auth.ts MastodonErrorCode
type MastodonErrorCode = 
  | 'INSTANCE_UNREACHABLE'
  | 'INSTANCE_INVALID'
  | 'OAUTH_CREATION_FAILED'
  | 'UNKNOWN_ERROR'

interface MastodonLoginButtonProps {
  onLoadingChange?: (loading: boolean) => void
  onError?: (error: string) => void
  isConnected?: boolean
  isSelected?: boolean
  className?: string
  onClick?: () => void
  showForm?: boolean
  instances: string[]
}

export default function MastodonLoginButton({
  onLoadingChange = () => { },
  onError = () => { },
  isConnected = false,
  isSelected = false,
  className = "",
  onClick = () => { },
  showForm = false,
  instances = []
}: MastodonLoginButtonProps) {
  const [instanceText, setInstanceText] = useState('')
  const [instanceError, setInstanceError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [serverError, setServerError] = useState<{ code: MastodonErrorCode; instance: string } | null>(null)
  const t = useTranslations('dashboardLoginButtons')
  const { isDark } = useTheme()
  const searchParams = useSearchParams()

  // Check for server-side Mastodon errors in URL params
  useEffect(() => {
    const errorCode = searchParams.get('mastodon_error') as MastodonErrorCode | null
    const errorInstance = searchParams.get('mastodon_instance')
    
    if (errorCode && errorInstance) {
      setServerError({ code: errorCode, instance: errorInstance })
      setInstanceText(errorInstance)
      
      // Clean up URL params after reading
      const url = new URL(window.location.href)
      url.searchParams.delete('mastodon_error')
      url.searchParams.delete('mastodon_instance')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  // Get user-friendly error message based on error code
  const getErrorMessage = (code: MastodonErrorCode, instance: string): string => {
    switch (code) {
      case 'INSTANCE_UNREACHABLE':
        return t('services.mastodon.error.unreachable_instance', { instance })
      case 'INSTANCE_INVALID':
        return t('services.mastodon.error.invalid_instance', { instance })
      case 'OAUTH_CREATION_FAILED':
        return t('services.mastodon.error.oauth_failed', { instance })
      case 'UNKNOWN_ERROR':
      default:
        return t('services.mastodon.error.unknown', { instance })
    }
  }

  // Clear server error when user starts typing
  const handleInstanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInstanceError('')
    setServerError(null)
    const instanceName = e.target.value?.trim()
    validateInstance(instanceName)
    setInstanceText(e.target.value)
  }

  const validateInstance = (instance: string): boolean => {
    setInstanceError('')
    instance = instance.trim()

    if (!instance) {
      setInstanceError(t('services.mastodon.error.required'))
      return false
    }

    const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9\.\-]+$/;
    if (!hostnameRegex.test(instance)) {
      setInstanceError(t('services.mastodon.error.invalid_format'))
      return false
    }

    return true
  }

  const handleSignIn = async (instance: string) => {
    if (!instance) return

    if (!instances.includes(instance) && !validateInstance(instance)) {
      return
    }

    try {
      setIsLoading(true)
      onLoadingChange(true)
      setServerError(null)
      
      const trimmedInstance = instance.trim()
      
      // First, verify the instance is reachable before starting OAuth flow
      const verifyResponse = await fetch('/api/auth/mastodon/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: trimmedInstance })
      })
      
      const verifyResult = await verifyResponse.json()
      
      if (!verifyResult.valid) {
        // Instance is not valid - show error instead of starting broken OAuth flow
        const errorCode = verifyResult.error as MastodonErrorCode
        setServerError({ code: errorCode, instance: trimmedInstance })
        setIsLoading(false)
        onLoadingChange(false)
        return
      }
      
      // Instance is valid, proceed with OAuth
      const callbackUrl = window.location.pathname.includes('/reconnect') ? '/reconnect' : '/dashboard'

      const result = await signIn("mastodon", {
        redirect: false,
        callbackUrl: callbackUrl
      }, { instance: trimmedInstance })

      if (result?.error) {
        onError(result.error)
      } else if (result?.ok && result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error("Error during Mastodon sign in:", error)
      onError(t('services.mastodon.error.unreachable'))
    } finally {
      setIsLoading(false)
      onLoadingChange(false)
    }
  }

  // Button mode (showForm = false)
  if (!showForm) {
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
          onClick={onClick}
          disabled={isConnected}
          className={`${quantico.className} group relative w-full rounded-2xl border border-violet-500/30 bg-[#6364FF] p-5 text-left transition-all duration-300 shadow-[0_0_25px_rgba(99,100,255,0.25)] hover:shadow-[0_0_35px_rgba(99,100,255,0.35)] hover:border-violet-400/50 disabled:opacity-70 disabled:cursor-not-allowed`}
        >

          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <SiMastodon className="h-6 w-6 text-white" />
            </div>

            <div className="flex-1">
              <p className="text-base font-semibold text-white">
                {isConnected ? t('connected') : t('services.mastodon.title')}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
              {isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-white" />
              ) : (
                <ArrowRight className={`h-5 w-5 text-white transition-transform ${isSelected ? 'rotate-90' : ''}`} />
              )}
            </div>
          </div>
        </motion.button>
      </motion.div>
    )
  }

  // Form mode (showForm = true)
  const inputClasses = isDark
    ? 'bg-white/5 border-white/20 text-white placeholder-white/40 focus:border-violet-400'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-violet-500'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
          <SiMastodon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className={`${quantico.className} text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('services.mastodon.title')}
          </h3>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
            Enter your instance to connect
          </p>
        </div>
      </div>

      <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleSignIn(instanceText) }} className="space-y-4">
        {/* Instance input */}
        <div className="space-y-2">
          <label className={`${quantico.className} block text-xs font-medium uppercase tracking-wider ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
            {t('services.mastodon.instance')}
          </label>
          <div className="relative">
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              <Globe className="h-4 w-4" />
            </div>
            <input
              type="text"
              list="known_instances"
              value={instanceText}
              onChange={handleInstanceChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="mastodon.social"
              className={`${quantico.className} w-full pl-11 pr-4 py-3 rounded-xl border-2 transition-all duration-200 outline-none ${inputClasses} ${instanceError || serverError ? 'border-red-500' : ''}`}
              disabled={isLoading}
            />
            {isFocused && !instanceError && (
              <motion.div
                layoutId="mastodon-focus-ring"
                className="absolute inset-0 rounded-xl border-2 border-violet-400 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </div>
          <datalist id="known_instances">
            {instances.map((instance, index) => (
              <option key={index} value={instance} />
            ))}
          </datalist>
        </div>

        {/* Error - client-side validation or server-side error */}
        <AnimatePresence>
          {(instanceError || serverError) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}
            >
              <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
              <p className={`${quantico.className} text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                {instanceError || (serverError && getErrorMessage(serverError.code, serverError.instance))}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button
          type="submit"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={isLoading || !instanceText || !!instanceError}
          className={`${quantico.className} w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>{t('services.mastodon.connect')}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  )
}
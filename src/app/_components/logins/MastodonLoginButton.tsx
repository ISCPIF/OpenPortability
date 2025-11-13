import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from "next-auth/react"
import { SiMastodon } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/app/_components/ui/Button'
import { useTheme } from '@/hooks/useTheme'

interface MastodonLoginButtonProps {
  onLoadingChange?: (loading: boolean) => void
  onError?: (error: string) => void
  isConnected?: boolean
  isSelected?: boolean
  className?: string
  onClick?: () => void
  showForm?: boolean
  instances: string[]
  // prompt?: string
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const formVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
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
  const [searchTerm, setSearchTerm] = useState('')
  const [instanceError, setInstanceError] = useState('')
  const t = useTranslations('dashboardLoginButtons')
  const { isDark } = useTheme()


  // useEffect(() => {
  //   const fetchInstances = async () => {
  //     try {
  //       const response = await fetch('/api/auth/mastodon')
  //       const data = await response.json()
  //       if (data.success) {
  //         setInstances(data.instances)
  //       }
  //     } catch (error) {
  //       console.error('Error fetching Mastodon instances:', error)
  //     }
  //   }

  //   if (showForm) {
  //     fetchInstances()
  //   }
  // }, [showForm])

  const validateInstance = (instance: string): boolean => {
    setInstanceError('')

    // Enlever les espaces
    instance = instance.trim()

    // Vérifier que ce n'est pas vide
    if (!instance) {
      setInstanceError(t('services.mastodon.error.required'))
      return false
    }

    // Vérification basique du hostname de l’instance
    const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9\.\-]+$/;
    if (!hostnameRegex.test(instance)) {
      setInstanceError(t('services.mastodon.error.invalid_format'))
      return false
    }

    return true
  }

  const handleSignIn = async (instance: string) => {
    if (!instance) return

    // Pour une instance personnalisée, on valide
    if (!instances.includes(instance) && !validateInstance(instance)) {
      return
    }

    try {
      onLoadingChange(true)
      const callbackUrl = window.location.pathname.includes('/reconnect') ? '/reconnect' : '/dashboard'

      const result = await signIn("mastodon", {
        redirect: false,
        callbackUrl: callbackUrl
      }, { instance: instance.trim()})

      if (result?.error) {
        onError(result.error)
      } else if (result?.ok && result.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error("Error during Mastodon sign in:", error)
      onError(t('services.mastodon.error.unreachable'))
    } finally {
      onLoadingChange(false)
    }
  }

  if (!showForm) {
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
            backgroundColor: isDark ? 'transparent' : '#7c3aed',
            borderColor: '#7c3aed',
            color: '#ffffff',
            boxShadow: isDark 
              ? '0 0 15px rgba(0, 123, 255, 0.3), 0 0 15px rgba(255, 0, 127, 0.3)'
              : '0 0 15px rgba(124, 58, 237, 0.3)',
            fontFamily: 'monospace',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (isDark) {
              e.currentTarget.style.backgroundImage = '#6d28d9';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.boxShadow = '0 0 30px #007bff, 0 0 30px #ff007f';
            } else {
              e.currentTarget.style.backgroundColor = '#6d28d9';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(124, 58, 237, 0.6)';
            }
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (isDark) {
              e.currentTarget.style.backgroundImage = 'none';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 123, 255, 0.3), 0 0 15px rgba(255, 0, 127, 0.3)';
            } else {
              e.currentTarget.style.backgroundColor = '#7c3aed';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(124, 58, 237, 0.3)';
            }
          }}
          disabled={isConnected}
        >
          <SiMastodon className="w-5 h-5" />
        <span className="font-medium">
          {isConnected ? t('connected') : t('services.mastodon.title')}
        </span>        </Button>
      </motion.div>
    )
  }

  return (
    <div className="w-full">
      <datalist id="known_instances">
        {instances.map((instance, index) => (
          <option key={index} value={instance} />
        ))}
      </datalist>
      <form onSubmit={() => handleSignIn(instanceText)} className="space-y-4">
        <div className="relative">
          <label className={`${plex.className} block text-sm font-medium mb-2`}
            style={{ color: isDark ? '#ffffff' : '#000000' }}>
            {t('services.mastodon.instance')}
          </label>
          <input
            type="text"
            list="known_instances"
            value={instanceText}
            onChange={(e) => {
              setInstanceError('')
              const instanceName = e.target.value?.trim();
              validateInstance(instanceName)
              setInstanceText(e.target.value)
            }}
            placeholder="mastodon.social"
            className={`${plex.className} w-full px-4 py-3 border-2 rounded-lg transition-all duration-300 tracking-wide
              ${isDark 
                ? 'bg-transparent text-white placeholder-white-600 border-[#7c3aed]'
                : 'bg-[#ffffff] text-black placeholder-white/60 border-[#7c3aed]'
              }
              ${instanceError
                ? 'border-red-500 focus:border-red-500'
                : isDark
                  ? 'focus:border-[#7c3aed] focus:shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                  : 'focus:border-[#6d28d9] focus:shadow-[0_0_15px_rgba(124,58,237,0.3)]'
              }
              focus:outline-none`}
            style={{
              fontFamily: 'monospace'
            }}
          />
          {instanceError && (
            <p className={`${plex.className} mt-2 text-sm font-medium`}
              style={{ color: '#ef4444' }}>
              {instanceError}
            </p>
          )}
        </div>

        <button
          type="submit"
          className={`${plex.className} w-full py-3 px-4 border-2 rounded-lg transition-all duration-300 
            flex items-center justify-center gap-2 tracking-widest font-medium disabled:opacity-50`}
          style={{
            backgroundColor: isDark ? 'transparent' : '#7c3aed',
            borderColor: '#7c3aed',
            color: isDark ? '#7c3aed' : '#ffffff',
            boxShadow: isDark 
              ? '0 0 15px rgba(124, 58, 237, 0.3)'
              : '0 0 15px rgba(124, 58, 237, 0.3)',
            fontFamily: 'monospace'
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (!instanceText || instanceError) return;
            if (isDark) {
              e.currentTarget.style.backgroundColor = '#7c3aed';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(124, 58, 237, 0.6)';
            } else {
              e.currentTarget.style.backgroundColor = '#6d28d9';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(124, 58, 237, 0.6)';
            }
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (!instanceText || instanceError) return;
            if (isDark) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#7c3aed';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(124, 58, 237, 0.3)';
            } else {
              e.currentTarget.style.backgroundColor = '#7c3aed';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(124, 58, 237, 0.3)';
            }
          }}
          disabled={!instanceText || !!instanceError}
        >
          <SiMastodon className="w-5 h-5" />
          {t('services.mastodon.connect')}
        </button>
      </form>
    </div>
  )
}
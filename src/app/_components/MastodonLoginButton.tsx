import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from "next-auth/react"
import { SiMastodon } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { ChevronDown, Construction, Plus, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface MastodonLoginButtonProps {
  onLoadingChange?: (loading: boolean) => void
  onError?: (error: string) => void
  isConnected?: boolean
  isSelected?: boolean
  className?: string
  onClick?: () => void
  showForm?: boolean
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
  showForm = false
}: MastodonLoginButtonProps) {
  const [instanceText, setInstanceText] = useState('')
  const [instances, setInstances] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [instanceError, setInstanceError] = useState('')
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
      // Détermine l'URL de redirection basée sur l'URL courante
      const currentPath = window.location.pathname
      const callbackUrl = currentPath.includes('/migrate') ? '/migrate' : '/dashboard'

      const result = await signIn("mastodon", {
        redirect: false,
        callbackUrl,
      }, { instance: instance.trim() })

      console.log("RESULSSSS OAUTH")
      console.log(result)

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
      <motion.button
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClick}
        className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 text-white 
                   ${isSelected
            ? 'bg-[#4c32b5] ring-2 ring-purple-400/50'
            : 'bg-[#563ACC] hover:bg-[#4c32b5]'} 
                   rounded-xl transition-all duration-200 ${plex.className} ${className}
                   hover:shadow-lg hover:shadow-purple-500/20`}
        disabled={isConnected}
      >
        <SiMastodon className="w-5 h-5" />
        <span className="font-medium">
          {isConnected ? t('connected') : t('services.mastodon.title')}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`}
        />
      </motion.button>
    )
  }

  return (
    <div
      className={`px-4 py-4 bg-white rounded-2xl shadow-xl text-sm text-gray-800`}
    >
      <div className="">
        <datalist id="known_instances">
          {instances.map((instance, index) => (
            <option key={index} value={instance} />
          ))}
        </datalist>
        <form onSubmit={() => handleSignIn(instanceText)}>
          <div className="relative">
            <p>
              {t('services.mastodon.instance')}
            </p>
            <input
              type="text" list="known_instances"
              value={instanceText}
              onChange={(e) => {
                setInstanceError('')
                const instanceName = e.target.value?.trim();
                validateInstance(instanceName)
                setInstanceText(e.target.value)
              }}
              className={`w-full px-4 py-3 my-3 bg-gray-50 border rounded-xl 
                              text-gray-800 placeholder-gray-500 
                              focus:ring-2 focus:outline-none 
                              ${instanceError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20'
                  : 'border-gray-200 focus:border-purple-400 focus:ring-purple-400/20'
                }`}
            />
            {instanceError && (
              <p
                className="mt-2 text-sm text-red-600"
              >
                {instanceError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 
                            text-white font-medium rounded-xl shadow-lg 
                            shadow-purple-600/20 hover:shadow-purple-600/30 
                            disabled:bg-purple-200
                             flex items-center justify-center gap-2"
            disabled={!instanceText || !!instanceError}
          >
            <SiMastodon className="w-5 h-5" />
            {t('services.mastodon.connect')}
          </button>
        </form>
      </div>
    </div>
  )
}

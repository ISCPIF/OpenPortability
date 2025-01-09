import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from "next-auth/react"
import { SiMastodon } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { ChevronDown, Plus, Search, X } from 'lucide-react'
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
    onClick = () => {},
    showForm = false
  }: MastodonLoginButtonProps) {
    const [instanceText, setInstanceText] = useState('')
  const [instances, setInstances] = useState<string[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
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

  const filteredInstances = instances.filter(instance =>
    instance.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5)

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
      const result = await signIn("mastodon", {
        redirect: false,
        callbackUrl: '/dashboard'
      }, { instance: instance.trim() })

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
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="p-6 bg-white rounded-2xl shadow-xl"
    >
      <div className="space-y-6">
        {!showCustomInput ? (
          <>
            {/* <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('services.mastodon.search')}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl 
                          text-gray-800 placeholder-gray-500 focus:border-purple-400 
                          focus:ring-2 focus:ring-purple-400/20 focus:outline-none 
                          transition-all duration-200"
              />
            </div> */}

            <div className="p-1">
              {filteredInstances.map((instance, index) => (
                <motion.button
                  key={instance}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSignIn(instance)}
                  className="w-full p-3 flex items-center justify-between bg-gray-50 
                            hover:bg-purple-50 border border-gray-200 hover:border-purple-200 
                            rounded-lg transition-all duration-200 group"
                >
                  <span className="text-gray-700 group-hover:text-purple-700">{instance}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-purple-500 
                                       rotate-[-90deg] transition-all duration-200" />
                </motion.button>
              ))}
            </div>

            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-500 
                        transition-colors group"
            >
              {/* <Plus className="w-4 h-4 transition-transform group-hover:scale-110" /> */}
              {t('services.mastodon.instance_not_yet')}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {/* <h3 className="text-lg font-medium text-gray-900">
                {t('services.mastodon.custom_instance')}
              </h3> */}
              <button
                onClick={() => setShowCustomInput(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={instanceText}
                onChange={(e) => {
                  setInstanceText(e.target.value)
                  setInstanceError('')
                }}
                placeholder={t('services.mastodon.write_instance')}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl 
                          text-gray-800 placeholder-gray-500 
                          focus:ring-2 focus:outline-none transition-all duration-200
                          ${instanceError
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20'
                    : 'border-gray-200 focus:border-purple-400 focus:ring-purple-400/20'
                  }`}
              />
              {instanceError && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-red-600"
                >
                  {instanceError}
                </motion.p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSignIn(instanceText)}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 
                        text-white font-medium rounded-xl shadow-lg 
                        shadow-purple-600/20 hover:shadow-purple-600/30 
                        transition-all duration-200 flex items-center justify-center gap-2"
              disabled={!instanceText}
            >
              <SiMastodon className="w-5 h-5" />
              {t('services.mastodon.connect')}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

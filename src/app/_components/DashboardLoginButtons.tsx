'use client'

import { signIn } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import BlueSkyLogin from "./BlueSkyLogin"
import { SiBluesky, SiMastodon } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"
import { CheckCircle, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      when: "beforeChildren"
    }
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
      when: "afterChildren"
    }
  }
}

interface DashboardLoginButtonsProps {
  onLoadingChange?: (isLoading: boolean) => void;
  connectedServices: {
    twitter?: boolean;
    bluesky?: boolean;
    mastodon?: boolean;
  };
  hasUploadedArchive?: boolean;
}

export default function DashboardLoginButtons({
  onLoadingChange = () => { },
  connectedServices,
  hasUploadedArchive
}: DashboardLoginButtonsProps) {
  const [showBlueSkyForm, setShowBlueSkyForm] = useState(false)
  const [activeButton, setActiveButton] = useState<string | null>(null)
  const [showMastodonMenu, setShowMastodonMenu] = useState(false)
  const t = useTranslations('dashboardLoginButtons')

  const handleSignIn = async (provider: string, instance?: string) => {

    onLoadingChange(true)
    await signIn(provider, {
      callbackUrl: '/dashboard?linking=true',
    }, { instance })
  }

  if (!hasUploadedArchive) {
    return (
      <motion.button
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => window.location.href = '/upload'}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 
                 bg-gradient-to-br from-blue-500/90 to-blue-600/90 rounded-2xl
                 hover:from-blue-500 hover:to-blue-600
                 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-500/20
                 backdrop-blur-sm text-lg relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <CheckCircle className="w-6 h-6 relative z-10" />
        <span className={`${plex.className} relative z-10`}>
          {t('importTwitter')}
        </span>
      </motion.button>
    )
  }

  // Vérifier s'il reste des services à connecter
  const hasRemainingServices = !connectedServices.twitter || !connectedServices.bluesky || !connectedServices.mastodon;

  if (!hasRemainingServices) {
    return null;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-3"
    >
      {!connectedServices.twitter && (
        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleSignIn("twitter")}
          onMouseEnter={() => setActiveButton("twitter")}
          onMouseLeave={() => setActiveButton(null)}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 
                   bg-gradient-to-br from-blue-500/80 to-blue-600/80 rounded-xl
                   hover:from-blue-500 hover:to-blue-600
                   transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-blue-500/20
                   backdrop-blur-sm relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <motion.div
            animate={{
              scale: activeButton === "twitter" ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.2 }}
            className="relative z-10"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
          </motion.div>
          <span className={`${plex.className} relative z-10 text-xs font-medium`}>{t('services.twitter')}</span>
        </motion.button>
      )}

      {!connectedServices.bluesky && (
        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setShowBlueSkyForm(true)}
          onMouseEnter={() => setActiveButton("bluesky")}
          onMouseLeave={() => setActiveButton(null)}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 
                   bg-gradient-to-br from-sky-500/80 to-sky-600/80 rounded-xl
                   hover:from-sky-500 hover:to-sky-600
                   transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-sky-500/20
                   backdrop-blur-sm relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sky-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <motion.div
            animate={{
              scale: activeButton === "bluesky" ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.2 }}
            className="relative z-10"
          >
            <SiBluesky className="w-5 h-5" />
          </motion.div>
          <span className={`${plex.className} relative z-10 text-xs font-medium`}>{t('services.bluesky')}</span>
        </motion.button>
      )}

      {!connectedServices.mastodon && (
        <div className="relative w-full">
          <AnimatePresence mode="wait">
            {<motion.div>
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleSignIn("mastodon", "mastodon.social")}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 
                           bg-gradient-to-br from-purple-500/80 to-purple-600/80 rounded-xl
                           hover:from-purple-500 hover:to-purple-600
                           transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-purple-500/20
                           backdrop-blur-sm relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <SiMastodon className="w-5 h-5 relative z-10" />
                <span className={`${plex.className} relative z-10 text-xs font-medium`}>mastodon.social</span>
              </motion.button>
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleSignIn("mastodon", "piaille.fr")}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 
                          bg-gradient-to-br from-purple-500/80 to-purple-600/80 rounded-xl
                          hover:from-purple-500 hover:to-purple-600
                          transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-purple-500/20
                          backdrop-blur-sm relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <SiMastodon className="w-5 h-5 relative z-10" />
                <span className={`${plex.className} relative z-10 text-xs font-medium`}>piaille.fr</span>
              </motion.button>
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleSignIn("mastodon", "mapstodon.space")}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 
                          bg-gradient-to-br from-purple-500/80 to-purple-600/80 rounded-xl
                          hover:from-purple-500 hover:to-purple-600
                          transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-purple-500/20
                          backdrop-blur-sm relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <SiMastodon className="w-5 h-5 relative z-10" />
                <span className={`${plex.className} relative z-10 text-xs font-medium`}>mapstodon.space</span>
              </motion.button>
            </motion.div>
            }
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showBlueSkyForm && (
          <BlueSkyLogin
            onClose={() => setShowBlueSkyForm(false)}
            onLoadingChange={onLoadingChange}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
//     </div>
//   )
// }

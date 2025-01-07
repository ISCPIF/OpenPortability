'use client'

import { signIn } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import BlueSkyLogin from "./BlueSkyLogin"
import TwitterRateLimit from "./TwitterRateLimit"
import { SiBluesky } from 'react-icons/si'
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

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
}

interface LoginButtonsProps {
  onLoadingChange: (isLoading: boolean) => void;
}

export default function LoginButtons({ onLoadingChange }: LoginButtonsProps) {
  const t = useTranslations('loginButtons');
  const [showBlueSkyForm, setShowBlueSkyForm] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [showMastodonMenu, setShowMastodonMenu] = useState(false)
  const [activeButton, setActiveButton] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (provider: string, instance?: string) => {
    try {
      setError(null)
      setIsRateLimited(false)
      onLoadingChange(true)
      const result = await signIn(provider, {
        redirect: false,
        callbackUrl: '/dashboard'
      }, { instance })

      if (result?.error) {
        // Rediriger vers la page d'erreur avec le code d'erreur approprié
        if (result.error.includes("temporairement indisponible")) {
          window.location.href = `/auth/error?error=RateLimit`;
        } else if (result.error.includes("Configuration")) {
          window.location.href = `/auth/error?error=Configuration`;
        } else if (result.error.includes("OAuthSignin")) {
          window.location.href = `/auth/error?error=OAuthSignin`;
        } else if (result.error.includes("OAuthCallback")) {
          window.location.href = `/auth/error?error=OAuthCallback`;
        } else if (result.error.includes("AccessDenied")) {
          window.location.href = `/auth/error?error=AccessDenied`;
        } else {
          window.location.href = `/auth/error?error=Default&message=${encodeURIComponent(result.error)}`;
        }
      } else if (result?.ok && result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      window.location.href = `/auth/error?error=Default&message=${encodeURIComponent(err.message || "Une erreur inattendue s'est produite")}`;
    } finally {
      onLoadingChange(false)
    }
  }

  return (
    <div className="max-w-96 mx-auto mt-8">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <span className="block sm:inline">{error}</span>
        </motion.div>
      )}
      {isRateLimited && (
        <TwitterRateLimit onShowAlternatives={() => setShowAlternatives(true)} />
      )}
      <motion.div variants={containerVariants} className="space-y-6">
        {/* Twitter Button */}
        <AnimatePresence mode="wait">
          {!showAlternatives && (
            <motion.button
              initial={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              variants={itemVariants}
              whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSignIn("twitter")}
              onMouseEnter={() => setActiveButton("twitter")}
              onMouseLeave={() => setActiveButton(null)}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 
                       bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl 
                       hover:from-blue-600 hover:to-blue-700 
                       transition-all duration-300 shadow-lg hover:shadow-blue-500/20
                       relative overflow-hidden text-lg"
            >
              <motion.div
                animate={{
                  scale: activeButton === "twitter" ? [1, 1.2, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </motion.div>
              <span className={`${plex.className} relative z-10`}>{t('twitter.continue')}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Alternative Button */}
        <AnimatePresence mode="wait">
          {!showAlternatives && (
            <motion.button
              variants={itemVariants}
              initial={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAlternatives(true)}
              className="w-full flex justify-center items-center py-8"
            >
              <span className={`${plex.className} bg-[#2a39a9] px-6 py-2 text-sm text-gray-200 rounded-full backdrop-blur-sm bg-opacity-80 shadow-lg hover:bg-opacity-100 transition-all duration-300 cursor-pointer`}>
                {t('deleteAccount')}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Alternative Buttons Container */}
        <AnimatePresence mode="wait">
          {showAlternatives && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{
                opacity: 1,
                height: "auto",
                transition: {
                  height: {
                    duration: 0.4,
                    ease: [0.04, 0.62, 0.23, 0.98]
                  },
                  opacity: {
                    duration: 0.25,
                    delay: 0.1
                  }
                }
              }}
              exit={{
                opacity: 0,
                height: 0,
                transition: {
                  height: {
                    duration: 0.4,
                    ease: [0.04, 0.62, 0.23, 0.98]
                  },
                  opacity: {
                    duration: 0.25
                  }
                }
              }}
              className="space-y-4"
            >
              <div className="overflow-visible space-y-6">
                {/* BlueSky Button and Form */}
                <motion.div
                  variants={itemVariants}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.3,
                      delay: 0.2,
                      ease: "easeOut"
                    }
                  }}
                >
                  {!showBlueSkyForm ? (
                    <motion.button
                      variants={itemVariants}
                      whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowBlueSkyForm(true)}
                      onMouseEnter={() => setActiveButton("bluesky")}
                      onMouseLeave={() => setActiveButton(null)}
                      className="w-full flex items-center justify-center gap-3 px-4 py-4 
                               bg-gradient-to-r from-sky-400 to-blue-500 rounded-xl 
                               hover:from-sky-500 hover:to-blue-600 
                               transition-all duration-300 shadow-lg hover:shadow-blue-500/20
                               relative overflow-hidden text-lg"
                    >
                      <motion.div
                        animate={{
                          scale: activeButton === "bluesky" ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <SiBluesky className="w-6 h-6" />
                      </motion.div>
                      <span className={`${plex.className}`}>{t('bluesky.connect')}</span>
                    </motion.button>
                  ) : (
                    <BlueSkyLogin onLoginComplete={() => onLoadingChange(true)} />
                  )}
                </motion.div>

                {/* Mastodon Button with Dropdown */}
                <div className="relative w-full">
                  <motion.button
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowMastodonMenu(!showMastodonMenu)}
                    onMouseEnter={() => setActiveButton("mastodon")}
                    onMouseLeave={() => setActiveButton(null)}
                    className="w-full flex items-center justify-center gap-3 px-4 py-4 
                             bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl 
                             hover:from-indigo-600 hover:to-purple-700 
                             transition-all duration-300 shadow-lg hover:shadow-indigo-500/20
                             relative overflow-hidden text-lg"
                  >
                    <motion.div
                      animate={{
                        scale: activeButton === "mastodon" ? [1, 1.2, 1] : 1,
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <svg className="w-6 h-6" viewBox="0 0 16 16">
                        <path fill="currentColor" d="M11.19 12.195c2.016-.24 3.77-1.475 3.99-2.603.348-1.778.32-4.339.32-4.339 0-3.47-2.286-4.488-2.286-4.488C12.062.238 10.083.017 8.027 0h-.05C5.92.017 3.942.238 2.79.765c0 0-2.285 1.017-2.285 4.488l-.002.662c-.004.64-.007 1.35.011 2.091.083 3.394.626 6.74 3.78 7.57 1.454.383 2.703.463 3.709.408 1.823-.1 2.847-.647 2.847-.647l-.06-1.317s-1.303.41-2.767.36c-1.45-.05-2.98-.156-3.215-1.928a3.614 3.614 0 0 1-.033-.496s1.424.346 3.228.428c1.103.05 2.137-.064 3.188-.189zm1.613-2.47H11.13v-4.08c0-.859-.364-1.295-1.091-1.295-.804 0-1.207.517-1.207 1.541v2.233H7.168V5.89c0-1.024-.403-1.541-1.207-1.541-.727 0-1.091.436-1.091 1.296v4.079H3.197V5.522c0-.859.22-1.541.66-2.046.456-.505 1.052-.764 1.793-.764.856 0 1.504.328 1.933.983L8 4.39l.417-.695c.429-.655 1.077-.983 1.934-.983.74 0 1.336.259 1.791.764.442.505.661 1.187.661 2.046v4.203z"/>
                      </svg>
                    </motion.div>
                    <span className={`${plex.className} relative z-10`}>{t('mastodon.connect')}</span>
                    <svg
                      className={`w-4 h-4 ml-2 transition-transform duration-200 ${showMastodonMenu ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {showMastodonMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMastodonMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 w-full mt-2 overflow-hidden  rounded-xl shadow-lg bg-gray-800"
                          style={{ transform: 'translateZ(0)' }}
                        >
                          <button
                            onClick={() => {
                              handleSignIn("mastodon", "mastodon.social")
                              setShowMastodonMenu(false)
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors duration-200"
                          >
                            <span className={`${plex.className} flex items-center gap-2`}>
                              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                              mastodon.social
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              handleSignIn("mastodon", "piaille.fr")
                              setShowMastodonMenu(false)
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors duration-200"
                          >
                            <span className={`${plex.className} flex items-center gap-2`}>
                              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                              piaille.fr
                            </span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Return to Twitter Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.3,
                    delay: 0.4,
                    ease: "easeOut"
                  }
                }}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAlternatives(false)}
                  className="w-full flex justify-center items-center mt-6"
                >
                  <span className={`${plex.className} bg-[#2a39a9] px-6 py-2 text-sm text-gray-200 rounded-full backdrop-blur-sm bg-opacity-80 shadow-lg hover:bg-opacity-100 transition-all duration-300 cursor-pointer flex items-center gap-2`}>
                    <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {t('twitter.notDeleted')}
                  </span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
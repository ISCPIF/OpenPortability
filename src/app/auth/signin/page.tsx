'use client'

import { signIn, useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import BlueSkyLogin from "@/app/_components/BlueSkyLogin"
import MastodonLogin from "@/app/_components/MastodonLogin"
import Header from "@/app/_components/Header"
import { plex } from "@/app/fonts/plex"
import Link from "next/link"
import { SiBluesky } from 'react-icons/si'

import logo from '../../../../public/logo-bg-bleu.svg'


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

export default function SignIn() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showBlueSkyForm, setShowBlueSkyForm] = useState(false)
  const [showMastodonForm, setShowMastodonForm] = useState(false)
  const [activeButton, setActiveButton] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)

  useEffect(() => {
    // setIsLoading(true)

    console.log('useEffect session auth/signin:', session)
    if (session) {
      setIsLoading(true)
      router.push("/dashboard")
    }
  }, [session, router])

  const handleSignIn = async (provider: string) => {
    setIsLoading(true)
    await signIn(provider)
  }

  // useEffect

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-gray-300"
          >
            Chargement...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#2a39a9] text-white relative overflow-hidden">

      <Link href="/" className="contents ">
        <Image
          src={logo}
          alt="HelloQuitteX Logo"
          width={306}
          height={125}
          className="mx-auto mt-8"
        />
      </Link>

      <div className="container mx-auto px-4 py-12">

        <div className="container flex flex-col m-auto text-center gap-y-8 text-[#E2E4DF]">
          <h1 className={`${plex.className} text-3xl`}>Prêt à migrer vers de nouveaux rivages ?</h1>
          <AnimatePresence mode="wait">
            {!showAlternatives ? (
              <motion.p
                key="twitter"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`${plex.className} text-xl`}
              >
                Commencez par vous connecter avec Twitter pour migrer vos données :
              </motion.p>
            ) : (
              <motion.p
                key="alternatives"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`${plex.className} text-xl`}
              >
                Je me connecte avec d'autres plateformes
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="max-w-96 mx-auto mt-8">
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
                  <span className={`${plex.className} relative z-10`}>Continuer avec Twitter</span>
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
                    J'ai déjà supprimé mon compte Twitter
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
                  className="space-y-4 overflow-hidden"
                >
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
                        <span className={`${plex.className}`}>Se connecter avec BlueSky</span>
                      </motion.button>
                    ) : (
                      <BlueSkyLogin onLoginComplete={() => setIsLoading(true)} />
                    )}
                  </motion.div>

                  {/* Mastodon Button */}
                  <motion.div 
                    variants={itemVariants}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0,
                      transition: {
                        duration: 0.3,
                        delay: 0.3,
                        ease: "easeOut"
                      }
                    }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(168, 85, 247, 0.5)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSignIn("mastodon")}
                      onMouseEnter={() => setActiveButton("mastodon")}
                      onMouseLeave={() => setActiveButton(null)}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 
                                 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl 
                                 hover:from-purple-600 hover:to-indigo-600 
                                 transition-all duration-300 shadow-lg hover:shadow-purple-500/20"
                    >
                      <motion.div
                        animate={{
                          scale: activeButton === "mastodon" ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <svg className="w-6 h-6" viewBox="0 0 216.4144 232.00976">
                          <path fill="currentColor" d="M211.80734 139.0875c-3.18125 16.36625-28.4925 34.2775-57.5625 37.74875-15.15875 1.80875-30.08375 3.47125-45.99875 2.74125-26.0275-1.1925-46.565-6.2125-46.565-6.2125 0 2.53375.15625 4.94625.46875 7.2025 3.38375 25.68625 25.47 27.225 46.39125 27.9425 21.11625.7225 39.91875-5.20625 39.91875-5.20625l.8675 19.09s-14.77 7.93125-41.08125 9.39c-14.50875.7975-32.52375-.365-53.50625-5.91875C9.23234 213.82 1.40609 165.31125.20859 116.09125c-.365-14.61375-.14-28.39375-.14-39.91875 0-50.33 32.97625-65.0825 32.97625-65.0825C49.67234 3.45375 78.20359.2425 107.86484 0h.72875c29.66125.2425 58.21125 3.45375 74.8375 11.09 0 0 32.975 14.7525 32.975 65.0825 0 0 .41375 37.13375-4.59875 62.915" />
                          <path fill="currentColor" d="M177.50984 80.077v60.94125h-24.14375v-59.15c0-12.46875-5.24625-18.7975-15.74-18.7975-11.6025 0-17.4175 7.5075-17.4175 22.3525v32.37625H96.20734V85.42325c0-14.845-5.81625-22.3525-17.41875-22.3525-10.49375 0-15.74 6.32875-15.74 18.7975v59.15H38.90484V80.077c0-12.455 3.17125-22.3525 9.54125-29.675 6.56875-7.3225 15.17125-11.07625 25.85-11.07625 12.355 0 21.71125 4.74875 27.8975 14.2475l6.01375 10.08125 6.015-10.08125c6.185-9.49875 15.54125-14.2475 27.8975-14.2475 10.6775 0 19.28 3.75375 25.85 11.07625 6.36875 7.3225 9.54 17.22 9.54 29.675" />
                        </svg>
                      </motion.div>
                      <span className={`${plex.className}`}>Se connecter avec Mastodon</span>
                    </motion.button>
                  </motion.div>

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
                        J'ai un compte Twitter
                      </span>
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { signIn, useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import BlueSkyLogin from "@/app/_components/BlueSkyLogin"
import MastodonLogin from "@/app/_components/MastodonLogin"
import Header from "@/app/_components/Header"

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

  useEffect(() => {
    if (session) {
      router.push("/dashboard")
    }
  }, [session, router])

  const handleSignIn = async (provider: string) => {
    setIsLoading(true)
    await signIn(provider)
  }

  // useEffect

  if (status === "loading" || isLoading ){
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-xl animate-blob"/>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-500/30 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"/>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-500/30 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"/>
        </div>
      </div>

      <Header />
      
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-12 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="w-full max-w-md"
        >
          <motion.div
            variants={itemVariants}
            className="backdrop-blur-xl bg-white/10 py-8 px-4 shadow-2xl rounded-2xl sm:px-10 border border-white/10
                     hover:border-white/20 transition-colors duration-300
                     relative overflow-hidden group"
          >
            {/* Gradient hover effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent
                          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>

            <motion.div variants={itemVariants} className="sm:mx-auto sm:w-full sm:max-w-md mb-6">
              <h2 className="text-center text-3xl font-extrabold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Choisissez votre réseau pour vous connecter à HelloQuitteX :
              </h2>
              <p className="mt-2 text-center text-sm text-gray-300">
                Connectez-vous avec votre compte préféré
              </p>
            </motion.div>

            <motion.div variants={containerVariants} className="space-y-6">
              {/* Twitter Button */}
              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSignIn("twitter")}
                onMouseEnter={() => setActiveButton("twitter")}
                onMouseLeave={() => setActiveButton(null)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 
                         bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl 
                         hover:from-blue-600 hover:to-blue-700 
                         transition-all duration-300 shadow-lg hover:shadow-blue-500/20
                         relative overflow-hidden"
              >
                <motion.div
                  animate={{
                    scale: activeButton === "twitter" ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </motion.div>
                <span className="relative z-10">Continuer avec Twitter</span>
              </motion.button>

              {/* BlueSky Button and Form */}
              <motion.div variants={itemVariants}>
                {!showBlueSkyForm ? (
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(14, 165, 233, 0.5)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowBlueSkyForm(true)}
                    onMouseEnter={() => setActiveButton("bluesky")}
                    onMouseLeave={() => setActiveButton(null)}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 
                             bg-gradient-to-r from-sky-400 to-blue-500 rounded-xl 
                             hover:from-sky-500 hover:to-blue-600 
                             transition-all duration-300 shadow-lg hover:shadow-sky-500/20"
                  >
                    <motion.div
                      animate={{
                        rotate: activeButton === "bluesky" ? [0, 360] : 0,
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 288 288" fill="currentColor">
                        <path d="M 144 0 L 288 144 L 144 288 L 0 144 Z"/>
                      </svg>
                    </motion.div>
                    <span>Continuer avec BlueSky</span>
                  </motion.button>
                ) : (
                  <BlueSkyLogin onLoginComplete={() => setIsLoading(true)} />
                )}
              </motion.div>

              {/* Mastodon Button and Form */}
               <motion.div variants={itemVariants}>
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(168, 85, 247, 0.5)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowMastodonForm(!showMastodonForm)}
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
                    <svg className="w-5 h-5" viewBox="0 0 216.4144 232.00976">
                      <path fill="currentColor" d="M211.80734 139.0875c-3.18125 16.36625-28.4925 34.2775-57.5625 37.74875-15.15875 1.80875-30.08375 3.47125-45.99875 2.74125-26.0275-1.1925-46.565-6.2125-46.565-6.2125 0 2.53375.15625 4.94625.46875 7.2025 3.38375 25.68625 25.47 27.225 46.39125 27.9425 21.11625.7225 39.91875-5.20625 39.91875-5.20625l.8675 19.09s-14.77 7.93125-41.08125 9.39c-14.50875.7975-32.52375-.365-53.50625-5.91875C9.23234 213.82 1.40609 165.31125.20859 116.09125c-.365-14.61375-.14-28.39375-.14-39.91875 0-50.33 32.97625-65.0825 32.97625-65.0825C49.67234 3.45375 78.20359.2425 107.86484 0h.72875c29.66125.2425 58.21125 3.45375 74.8375 11.09 0 0 32.975 14.7525 32.975 65.0825 0 0 .41375 37.13375-4.59875 62.915"/>
                      <path fill="currentColor" d="M177.50984 80.077v60.94125h-24.14375v-59.15c0-12.46875-5.24625-18.7975-15.74-18.7975-11.6025 0-17.4175 7.5075-17.4175 22.3525v32.37625H96.20734V85.42325c0-14.845-5.81625-22.3525-17.41875-22.3525-10.49375 0-15.74 6.32875-15.74 18.7975v59.15H38.90484V80.077c0-12.455 3.17125-22.3525 9.54125-29.675 6.56875-7.3225 15.17125-11.07625 25.85-11.07625 12.355 0 21.71125 4.74875 27.8975 14.2475l6.01375 10.08125 6.015-10.08125c6.185-9.49875 15.54125-14.2475 27.8975-14.2475 10.6775 0 19.28 3.75375 25.85 11.07625 6.36875 7.3225 9.54 17.22 9.54 29.675"/>
                    </svg>
                  </motion.div>
                  <span>Continuer avec Mastodon</span>
                </motion.button>
                <AnimatePresence>
                  {showMastodonForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="mt-4"
                    >
                      <MastodonLogin />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div> 
            </motion.div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
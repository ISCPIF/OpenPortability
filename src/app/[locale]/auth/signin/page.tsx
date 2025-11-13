'use client'

import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { plex } from "@/app/fonts/plex"
import Link from "next/link"
import LoginButtons from "@/app/_components/logins/LoginButtons"
import LoadingIndicator from "@/app/_components/layouts/LoadingIndicator"
import { ParticulesBackground } from "@/app/_components/layouts/ParticulesBackground"
import Footer from "@/app/_components/layouts/Footer";
import { useTranslations } from 'next-intl'
import Header from "@/app/_components/layouts/Header"
import { useTheme } from "@/hooks/useTheme"

export default function SignIn() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const t = useTranslations('signin')
  const params = useParams()
  const locale = params.locale as string;
  const [error, setError] = useState<string | null>(null)
  
  // 🎨 Utiliser le hook useTheme pour accéder aux couleurs du thème
  // Cela retourne : theme ('dark'|'light'), colors (objet avec toutes les couleurs), isDark (boolean), mounted (boolean)
  const { colors, isDark, mounted } = useTheme()


  useEffect(() => {
    if (session) {
      setIsLoading(true)
      const locale = params.locale as string || 'fr'
      router.push(`/${locale}/dashboard`)
    }
  }, [session, router, params.locale])

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading)
  }

  // Éviter le flash de contenu avant le montage du hook
  if (!mounted) {
    return null
  }

  return (
    <div 
      className="flex flex-col min-h-screen"
      // 🎨 Appliquer la couleur de fond du thème
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <Header />
      
      {/* Arrière-plan avec particules - prend l'espace restant */}
      <div className="flex-1 overflow-hidden">
        <ParticulesBackground />
      </div>
      
      {/* Contenu principal avec couleur de texte adaptée au thème */}
      <div 
        className="w-full max-w-md mx-auto px-4 relative z-20"
        style={{ color: colors.text }}
      >
        
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // 🎨 Adapter la couleur d'erreur au thème
            className="text-center text-sm mt-4"
            style={{ color: isDark ? '#ff6b6b' : '#d32f2f' }}
          >
            {t(`errors.${error}`)}
          </motion.div>
        )}
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  )
}
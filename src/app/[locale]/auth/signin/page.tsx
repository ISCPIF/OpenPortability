'use client'

import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { plex, quantico } from "@/app/fonts/plex"
import Link from "next/link"
import LoginButtons from "@/app/_components/logins/LoginButtons"
import LoadingIndicator from "@/app/_components/layouts/LoadingIndicator"
import { useTranslations } from 'next-intl'
import { useTheme } from "@/hooks/useTheme"
import logoBlanc from "@/../public/logo/logo-openport-blanc.svg"
import logoRose from "@/../public/logos/logo-openport-rose.svg"

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
      router.push(`/${locale}/reconnect`)
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
    <div className="w-full px-4">
      <div className="mx-auto max-w-md flex flex-col items-center text-center gap-6">
        <Image
          src={isDark ? logoBlanc : logoRose}
          alt="OpenPort Logo"
          width={306}
          height={82}
          className="mx-auto sm:w-[200px] md:w-[280px] flex-shrink-0"
          priority
        />

        <p className={`${quantico.className} text-lg lg:text-xl my-1 lg:my-2 ${isDark ? 'text-white' : 'text-black'}`}>
          {true
            ? t('subtitle')
            : (session?.user?.twitter_id ? t('embark') : t('embarkOrLogin'))}
        </p>

        <div className="w-full max-w-sm">
          <LoginButtons onLoadingChange={handleLoadingChange} />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm"
            style={{ color: isDark ? '#ff6b6b' : '#d32f2f' }}
          >
            {t(`errors.${error}`)}
          </motion.div>
        )}

        {/* Discover link - explore without signing in */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 pt-4 border-t border-opacity-20"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
        >
          <p className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            {t('discoverLink.prefix')}{' '}
            <Link 
              href={`/${locale}/discover`}
              className="font-medium underline underline-offset-2 hover:no-underline transition-all"
              style={{ color: isDark ? '#ec4899' : '#db2777' }}
            >
              {t('discoverLink.link')}
            </Link>
            {' '}{t('discoverLink.suffix')}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
'use client'

import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { plex } from "@/app/fonts/plex"
import Link from "next/link"
import LoginButtons from "@/app/_components/LoginButtons"
import LoadingIndicator from "@/app/_components/LoadingIndicator"
import LoginSea from "@/app/_components/LoginSea"
import Footer from "@/app/_components/Footer";
import { useTranslations } from 'next-intl'
import Header from "@/app/_components/Header"

export default function SignIn() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const t = useTranslations('signin')
  const params = useParams()
  const locale = params.locale as string;
  const [error, setError] = useState<string | null>(null)


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

  return (
    <div className="min-h-screen bg-[#2a39a9] w-full">
      <Header />
      <div className="w-full">
        <div className="flex flex-col text-center text-[#E2E4DF]">
          {/* Sea background that takes full width */}
          <LoginSea />
          
          {/* Login buttons positioned below the sea background */}
          <div className="w-full max-w-md mx-auto px-4">
            {(status === "loading" || isLoading) ? (
              <div className="py-8">
                <LoadingIndicator msg={t('loading')} />
              </div>
            ) : (
              <div className="z-10">
                <LoginButtons onLoadingChange={handleLoadingChange} />
              </div>
            )}
            
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm text-red-600 mt-4"
              >
                {t(`errors.${error}`)}
              </motion.div>
            )}
          </div>
        </div>
        <div className="mt-16">
          <Footer />
        </div>
      </div>
    </div>
  )
}

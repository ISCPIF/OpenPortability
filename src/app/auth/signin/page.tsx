'use client'

import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { plex } from "@/app/fonts/plex"
import Link from "next/link"
import LoginButtons from "@/app/_components/LoginButtons"
import LoadingIndicator from "@/app/_components/LoadingIndicator"
import LoginSea from "@/app/_components/LoginSea"
import Footer from "@/app/_components/Footer";


export default function SignIn() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)

  // Log des paramètres d'URL pour débogage
  useEffect(() => {
    const error = searchParams.get('error')
    const callbackUrl = searchParams.get('callbackUrl')
    console.log('[SignIn] URL Parameters:', {
      error,
      callbackUrl,
      otherParams: Object.fromEntries(searchParams.entries())
    })
  }, [searchParams])

  // Log des changements de statut de session
  useEffect(() => {
    console.log('[SignIn] Session Status:', {
      status,
      session: session ? {
        user: session.user,
        expires: session.expires
      } : null
    })
  }, [session, status])

  // Log des changements d'état de chargement
  useEffect(() => {
    console.log('[SignIn] Loading State:', isLoading)
  }, [isLoading])

  useEffect(() => {
    if (session) {
      console.log('[SignIn] Session detected, redirecting to dashboard')
      setIsLoading(true)
      router.push("/dashboard")
    }
  }, [session, router])

  const handleLoadingChange = (loading: boolean) => {
    console.log('[SignIn] Loading change:', loading)
    setIsLoading(loading)
  }

  return (
    <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <div className="container mx-auto py-12">
        <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
          <LoginSea />
          <div className="m-auto relative my-32 lg:my-40">
            {(status === "loading" || isLoading) ? (
              <>
                <div className="my-24 sm:my-36" />
                <LoadingIndicator msg="Chargement des informations…" />
              </>
            ) : (
              <div className="relative z-10">
                <h1 className={`${plex.className} text-2xl lg:text-3xl`}>Prêt à migrer vers de nouveaux rivages ?</h1>
                <p className={`${plex.className} text-lg lg:text-xl my-8 lg:my-10`}>
                  Commencez par vous connecter avec Twitter pour migrer vos données
                </p>
                <div className="my-40 lg:my-28" />
                <LoginButtons onLoadingChange={handleLoadingChange} />
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  )
}

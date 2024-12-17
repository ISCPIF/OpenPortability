'use client'

import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { plex } from "@/app/fonts/plex"
import Link from "next/link"
import LoginButtons from "@/app/_components/LoginButtons"

import logo from '../../../../public/logo-bg-bleu.svg'

export default function SignIn() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    console.log('useEffect session auth/signin:', session)
    if (session) {
      setIsLoading(true)
      router.push("/dashboard")
    }
  }, [session, router])

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
      <Link href="/" className="contents">
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
          <p className={`${plex.className} text-xl`}>
            Commencez par vous connecter avec Twitter pour migrer vos données
          </p>
        </div>

        <LoginButtons onLoadingChange={setIsLoading} />
      </div>
    </div>
  )
}

'use client'

import { useSearchParams } from 'next/navigation'
import { motion } from "framer-motion"
import TwitterRateLimit from "@/app/_components/TwitterRateLimit"
import { useRouter } from 'next/navigation'
import { plex } from "@/app/fonts/plex"

export default function ErrorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get('error')
  const provider = searchParams.get('provider')

  // Décode l'erreur si elle est encodée en URI
  const decodedError = error ? decodeURIComponent(error) : null

  console.log("Error page - Decoded error:", decodedError)
  console.log("Error page - Provider:", provider)

  // Si l'erreur vient de Twitter
  const isTwitterError = provider === 'twitter'

  return (
    <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <div className="container mx-auto py-12">
        <div className="container flex flex-col m-auto text-center gap-y-8 text-[#E2E4DF]">
          <div className="m-auto relative my-[10rem]">
            {isTwitterError ? (
              <TwitterRateLimit onShowAlternatives={() => router.push('/auth/signin?show_alternatives=true')} />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-100 border-l-4 border-red-400 p-4"
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className={`${plex.className} text-sm font-medium text-red-800`}>
                      Erreur d'authentification
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{decodedError || "Une erreur est survenue lors de la connexion."}</p>
                      <button
                        onClick={() => router.push('/auth/signin')}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Retour à la connexion
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
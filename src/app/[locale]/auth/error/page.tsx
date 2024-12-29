'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { plex } from '@/app/fonts/plex'

export default function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const message = searchParams.get('message')
  const [retryTime, setRetryTime] = useState<number | null>(null)

  useEffect(() => {
    if (error === 'RateLimit') {
      const resetTimeStr = searchParams.get('reset')
      if (resetTimeStr) {
        const resetTime = new Date(parseInt(resetTimeStr))
        const now = new Date()
        const waitSeconds = Math.ceil((resetTime.getTime() - now.getTime()) / 1000)
        setRetryTime(waitSeconds)
      }
    }
  }, [error, searchParams])

  const getErrorMessage = (errorCode: string, customMessage?: string) => {
    switch (errorCode) {
      case 'RateLimit':
        return {
          title: 'Trop de requêtes',
          message: retryTime 
            ? `Limite d'API Twitter dépassée. Veuillez réessayer dans ${Math.floor(retryTime / 60)} minutes et ${retryTime % 60} secondes.`
            : `Limite d'API Twitter dépassée. Veuillez réessayer plus tard.`,
          action: 'Réessayer'
        }
      case 'InvalidProfile':
        return {
          title: 'Profil invalide',
          message: 'Impossible de récupérer votre profil Twitter. Veuillez vérifier que votre compte Twitter est actif et réessayer.',
          action: 'Réessayer'
        }
      case 'Configuration':
        return {
          title: 'Erreur de configuration',
          message: 'Une erreur de configuration est survenue. Veuillez contacter le support.',
          action: 'Retour à l\'accueil'
        }
      case 'OAuthSignin':
        return {
          title: 'Erreur de connexion',
          message: 'Une erreur est survenue lors de l\'initialisation de la connexion.',
          action: 'Réessayer'
        }
      case 'OAuthCallback':
        return {
          title: 'Erreur de callback',
          message: 'Une erreur est survenue lors de la validation de votre connexion.',
          action: 'Réessayer'
        }
      case 'AccessDenied':
        return {
          title: 'Accès refusé',
          message: 'Vous avez refusé l\'accès à votre compte.',
          action: 'Réessayer'
        }
      default:
        return {
          title: 'Erreur d\'authentification',
          message: customMessage || 'Une erreur inattendue est survenue lors de l\'authentification.',
          action: 'Réessayer'
        }
    }
  }

  const { title, message: displayMessage, action } = getErrorMessage(error || 'Default', message || undefined)

  return (
    <div className="min-h-screen bg-[#2a39a9] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/10 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h1 className={`${plex.className} text-xl font-semibold text-white`}>{title}</h1>
          </div>
          
          <p className={`${plex.className} text-white/80 mb-6`}>{displayMessage}</p>
          
          <div className="flex justify-end gap-4">
            <button
              onClick={() => window.location.href = '/'}
              className={`${plex.className} px-4 py-2 text-sm text-white/60 hover:text-white transition-colors`}
            >
              Retour à l'accueil
            </button>
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className={`${plex.className} px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors`}
            >
              {action}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
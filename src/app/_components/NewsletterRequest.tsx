'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { plex } from '@/app/fonts/plex'
import Link from 'next/link'

interface NewsletterRequestProps {
  userId: string
  onSubscribe?: () => void
}

export default function NewsletterRequest({ userId, onSubscribe }: NewsletterRequestProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [acceptHQX, setAcceptHQX] = useState(false)
  const [acceptOEP, setAcceptOEP] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('dashboard.newsletter')
  const params = useParams()

  const handleSubscribe = async () => {
    try {
      setIsLoading(true)
      setError('')
        const response = await fetch(`/api/newsletter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          userId,
          acceptHQX,
          acceptOEP
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe')
      }

      setIsSubscribed(true)
      onSubscribe?.()
    } catch (error) {
      console.error('Error subscribing to newsletter:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Fonction pour rendre le texte avec le lien
  const renderCheckboxLabel = (text: string) => {
    const parts = text.split(/(\[.*?\]\(.*?\))/)
    return parts.map((part, index) => {
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/)
      if (linkMatch) {
        return (
          <Link
            key={index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline transition-colors duration-200"
          >
            {linkMatch[1]}
          </Link>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  if (isSubscribed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-green-400/20 to-green-500/10 rounded-xl"
      >
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className={`${plex.className} text-xl font-semibold text-green-500`}>
          {t('subscribed')}
        </p>
      </motion.div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-indigo-400/10 via-purple-400/10 to-pink-400/10 backdrop-blur-sm rounded-xl p-8 max-w-md w-full shadow-xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className={`${plex.className} text-2xl font-semibold text-white mb-1`}>
            {t('title')}
          </h2>
          <p className="text-gray-300">
            {t('description')}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
            {t('emailLabel')}
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg 
                     text-white placeholder-gray-400
                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     transition-all duration-200"
            placeholder={t('emailPlaceholder')}
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={acceptHQX}
                onChange={(e) => setAcceptHQX(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-white/30 rounded 
                           peer-checked:bg-gradient-to-r peer-checked:from-indigo-400 peer-checked:to-purple-500
                           peer-checked:border-transparent transition-all duration-200"
              />
              <CheckCircle2 className="absolute w-4 h-4 text-white transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors duration-200">
              {t('acceptHQX')}
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={acceptOEP}
                onChange={(e) => setAcceptOEP(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-white/30 rounded 
                           peer-checked:bg-gradient-to-r peer-checked:from-indigo-400 peer-checked:to-purple-500
                           peer-checked:border-transparent transition-all duration-200"
              />
              <CheckCircle2 className="absolute w-4 h-4 text-white transform scale-0 peer-checked:scale-100 transition-transform duration-200" />
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors duration-200">
              {renderCheckboxLabel(t('acceptOEP'))}
            </span>
          </label>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubscribe}
          disabled={isLoading || !email || !acceptHQX}
          className="w-full py-3 px-4 bg-gradient-to-r from-indigo-400 to-purple-500 
                   hover:from-indigo-500 hover:to-purple-600
                   text-white font-semibold rounded-lg shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all duration-300"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t('subscribing')}</span>
            </div>
          ) : (
            t('confirmSubscribe')
          )}
        </motion.button>
      </div>
    </div>
  )
}
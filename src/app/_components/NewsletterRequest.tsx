'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, CheckCircle2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { plex } from '@/app/fonts/plex'
import Link from 'next/link'
import { isValidEmail } from '@/lib/utils'

interface NewsletterRequestProps {
  userId: string
  onSubscribe?: () => void
  onClose?: () => void
}

export default function NewsletterRequest({ userId, onSubscribe, onClose }: NewsletterRequestProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [acceptOEP, setAcceptOEP] = useState(false)
  const [acceptResearch, setAcceptResearch] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('dashboard.newsletter')
  const tt = useTranslations('firstSeen')

  const handleSubscribe = async () => {
    try {
      setIsLoading(true)
      setError('')

      // Vérifier si un email est fourni, et s'il l'est, s'assurer qu'il est valide
      if (email && !isValidEmail(email)) {
        setError(t('errors.invalidEmail'))
        return
      }

      const response = await fetch(`/api/newsletter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email || null, // Envoyer null si pas d'email
          acceptHQX: Boolean(email), // Accepter les newsletters HQX seulement si email fourni
          acceptOEP,
          research_accepted: acceptResearch,
          have_seen_newsletter: true
        }),
      })

      if (!response.ok) {
        const data = await response.json()
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
        className="flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50"
      >
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <p className={`${plex.className} text-xl font-semibold text-green-500`}>
          {t('subscribed')}
        </p>
      </motion.div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 max-w-md w-full 
                    shadow-xl border border-slate-700/50 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-700/50 text-slate-400 hover:text-white
                  transition-all duration-200"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className={`${plex.className} text-2xl font-semibold text-white mb-1`}>
            {t('title')}
          </h2>
          <p className="text-slate-400 text-sm">
            {t('description')}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
            {t('emailLabel')}
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    placeholder-slate-400 text-white"
          />
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptResearch}
              onChange={(e) => setAcceptResearch(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">{renderCheckboxLabel(tt('newsletter.researchConsent'))}</span>
          </label>


          <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptOEP}
              onChange={(e) => setAcceptOEP(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">{renderCheckboxLabel(t('acceptOEP'))}</span>
          </label>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubscribe}
          disabled={isLoading || (email && !isValidEmail(email))}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 
                   hover:from-blue-600 hover:to-indigo-600
                   text-white font-semibold rounded-xl shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800
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

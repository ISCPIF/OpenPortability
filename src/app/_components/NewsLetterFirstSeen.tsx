'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { plex } from '@/app/fonts/plex'
import Image from 'next/image'
import HQXBadge from '../../../public/newSVG/HQX-badge.svg'

interface NewsLetterFirstSeenProps {
  userId: string
  onSubscribe?: () => void
  onClose?: () => void
}

export default function NewsLetterFirstSeen({ userId, onSubscribe, onClose }: NewsLetterFirstSeenProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [acceptOEP, setAcceptOEP] = useState(false)
  const [acceptResearch, setAcceptResearch] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('firstSeen')

  const updatePreferences = async (submit: boolean) => {
    try {
      setIsLoading(true)
      setError('')
      
      if (!submit) {
        // Si c'est un dismiss, on fait juste une requête GET pour mettre à jour have_seen_newsletter
        const response = await fetch(`/api/newsletter`, {
          method: 'GET'
        });
        
        if (!response.ok) {
          throw new Error('Failed to update preferences')
        }
        
        onClose?.()
        return
      }
      
      // Si c'est un submit, on continue avec la requête POST normale
      const response = await fetch(`/api/newsletter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          acceptHQX: true,
          acceptOEP,
          research_accepted: acceptResearch,
          have_seen_newsletter: true
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (data.error === 'Missing required fields') {
          setError(t('newsletter.errors.missingEmail'))
          return
        }
        throw new Error(data.error || 'Failed to update preferences')
      }

      onSubscribe?.()
      onClose?.()
    } catch (error) {
      console.error('Error updating preferences:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = () => updatePreferences(true)
  const handleDismiss = () => updatePreferences(false)

  const isEmailValid = email.trim().length > 0 && email.includes('@')

  return (
    <div className="bg-white rounded-2xl p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700
                  transition-all duration-200 z-10"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="flex flex-col items-center gap-6">
        <Image
          src={HQXBadge}
          alt="HelloQuitteX Logo"
          width={120}
          height={120}
          className="mb-4"
        />

        <h2 className={`${plex.className} text-2xl font-semibold text-center text-gray-900`}>
          {t('title')}
        </h2>

        <div className="space-y-4 text-center text-sm">
          {t('description').split('\n').map((paragraph, index) => (
            <p key={index} className="text-gray-700">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="w-full max-w-xl bg-gray-100 p-6 rounded-lg space-y-4">
          <div className="space-y-2 text-center">
            <p className="text-gray-600">{t('newsletter.subtitle')}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('newsletter.emailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('newsletter.emailPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder:text-gray-400" 
              />
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acceptOEP}
                onChange={(e) => setAcceptOEP(e.target.checked)}
                className="mt-1"
              />
              <label className="text-sm text-gray-600">
                {t('newsletter.consent')}
              </label>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acceptResearch}
                onChange={(e) => setAcceptResearch(e.target.checked)}
                className="mt-1"
              />
              <label className="text-sm text-gray-600">
                {t('newsletter.researchConsent')}
              </label>
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading || (email.length > 0 && !isEmailValid)}
          className="w-full bg-[#46489B] text-white py-4 rounded-lg font-semibold hover:bg-opacity-90 
                    transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Loading...
            </span>
          ) : (
            t('cta')
          )}
        </button>

        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          {t('dismiss')}
        </button>
      </div>
    </div>
  )
}
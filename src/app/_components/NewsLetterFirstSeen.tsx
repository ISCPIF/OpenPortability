'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { plex } from '@/app/fonts/plex'
import Image from 'next/image'
import HQXBadge from '../../../public/newSVG/HQX-badge.svg'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react';

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
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  const t = useTranslations('firstSeen')
  const pathname = usePathname()

  const languages = [
    { code: 'fr', name: 'FR'},
    { code: 'en', name: 'EN'},
    { code: 'es', name: 'ES'}
  ];
  const currentLocale = pathname.split('/')[1]

  const switchLanguage = (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`)
    window.location.href = newPath
  }

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
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Language Selector */}
            {/* Language Selector */}
            <div className="relative mr-6">
              <button
                onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 transition-colors"
              >
                <Globe className="w-5 h-5 bg-black" aria-hidden="true" />
                <span className="text-lg text-black">
                  {languages.find(lang => lang.code === currentLocale)?.name}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-black/60 transition-transform duration-200 
                    ${isLanguageOpen ? 'rotate-180' : ''}`}
                />
              </button>

          <AnimatePresence>
            {isLanguageOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-40 origin-top-right"
              >
                <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        switchLanguage(lang.code);
                        setIsLanguageOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-xs ${plex.className} text-gray-700 hover:bg-gray-50 transition-colors text-left flex items-center gap-2
                        ${currentLocale === lang.code ? 'bg-gray-50' : ''}`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={handleDismiss}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700
                  transition-all duration-200 z-10"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Image
          src={HQXBadge}
          alt="HelloQuitteX Logo"
          width={80}
          height={80}
          className="mb-1"
        />

        <h2 className={`${plex.className} text-xl font-semibold text-center text-gray-900`}>
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
          <div className="space-y-2 text-center text-sm">
            <p className="text-gray-600 text-sm">{t('newsletter.subtitle')}</p>
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
                className="w-full px-4 py-2 border border-gray-300 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder:text-gray-400" 
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
          className="mt-2 px-6 py-3 bg-[#46489B] text-white rounded-lg font-semibold hover:bg-opacity-90 
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
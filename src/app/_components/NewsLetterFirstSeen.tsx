'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { plex } from '@/app/fonts/plex'
import Image from 'next/image'
import Badge from '../../../public/newSVG/HQX-badge.svg'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { isValidEmail } from '@/lib/utils'
import { Switch } from '@headlessui/react'
import Link from 'next/link'

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

  useEffect(() => {
    const fetchPreferences = async () => {
      console.log('Fetching preferences...');
      try {
        const response = await fetch('/api/newsletter', { method: 'GET' });
        console.log('Response status:', response.status);
        if (response.ok) {
          const responseData = await response.json();
          console.log('Preferences data:', responseData);
          // Access the nested data object
          const preferences = responseData.data;
          // Force boolean values with !!
          setAcceptResearch(!!preferences.research_accepted);
          setAcceptOEP(!!preferences.oep_accepted);
          console.log('Set research to:', !!preferences.research_accepted);
          console.log('Set OEP to:', !!preferences.oep_accepted);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      }
    };
    fetchPreferences();
  }, []);

  const languages = [
    { code: 'fr', name: 'FR' },
    { code: 'en', name: 'EN' },
    { code: 'es', name: 'ES' }
  ];
  const currentLocale = pathname.split('/')[1]

  const switchLanguage = (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`)
    window.location.href = newPath
  }

  const handleSwitchChange = async (type: 'research' | 'oep', value: boolean) => {
    console.log(`🔄 Switch changed: ${type} = ${value}`);
    if (type === 'research') {
      setAcceptResearch(value);
      console.log('✅ Updated research to:', value);
    } else {
      setAcceptOEP(value);
      console.log('✅ Updated OEP to:', value);
    }
  };

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

      // Get the current state values at the time of submission
      const currentResearch = acceptResearch;
      const currentOEP = acceptOEP;

      // Si c'est un submit, on continue avec la requête POST normale
      const response = await fetch(`/api/newsletter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          acceptHQX: true,
          acceptOEP: currentOEP,
          research_accepted: currentResearch,
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


  return (
    <div className="bg-white rounded-2xl p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
      <div className="absolute top-4 right-4 flex items-center gap-2">
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
      </div>

      <div className="flex flex-col items-center gap-1">
        <Image
          src={Badge}
          alt="Logo"
          width={80}
          height={80}
          className="mb-1"
        />

        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">{t('title')}</h2>
          <div className="text-sm text-gray-600 text-center">
            {t.raw('description').split('\n').map((line, index) => {
              const parts = line.split(/\{(lien)\}/);
              return (
                <p key={index} className="mb-3">
                  {parts.map((part, partIndex) => {
                    if (part === 'lien') {
                      return (
                        <Link 
                          key={partIndex}
                          href={`/${currentLocale}/privacy_policy`} 
                          className="text-blue-600 hover:underline"
                        >
                          {t('privacyPolicyLink')}
                        </Link>
                      );
                    }
                    return <span key={partIndex}>{part}</span>;
                  })}
                </p>
              );
            })}
          </div>
        </div>

        <div className="w-full max-w-xl bg-gray-100 p-6 rounded-lg space-y-4">

        <div className="flex items-center space-x-3">
              <Switch
                checked={acceptOEP}
                onChange={(newValue) => handleSwitchChange('oep', newValue)}
                className={`${
                  acceptOEP ? 'bg-blue-600' : 'bg-gray-200'
                } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              >
                <span
                  className={`${
                    acceptOEP ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                />
              </Switch>
              <span className="text-sm text-gray-700">
              {t('newsletter.consent')}
              </span>
            </div>
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
                placeholder={t('newsletter.emailPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-3">
              <Switch
                checked={acceptResearch}
                onChange={(newValue) => handleSwitchChange('research', newValue)}
                className={`${
                  acceptResearch ? 'bg-blue-600' : 'bg-gray-200'
                } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              >
                <span
                  className={`${
                    acceptResearch ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                />
              </Switch>
              <span className="text-sm text-gray-700">
              {t('newsletter.researchConsent')}
              </span>
            </div>


            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
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
          // onClick={}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          {t('dismiss')}
        </button>
      </div>
    </div>
  )
}

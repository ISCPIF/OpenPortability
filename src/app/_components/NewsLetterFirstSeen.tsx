'use client'

import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { plex } from '@/app/fonts/plex'
import Image from 'next/image'
import Badge from '../../../public/v2/HQX-badge.svg'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { isValidEmail } from '@/lib/utils'
import { Switch } from '@headlessui/react'
import Link from 'next/link'
import { useNewsletter, ConsentType } from '@/hooks/useNewsLetter'

interface NewsLetterFirstSeenProps {
  userId: string
  onSubscribe?: () => void
  onClose?: () => void
}

const NewsletterLink = memo(({ href, children }: { href: string; children: React.ReactNode }) => (
  <a 
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#46489B] font-bold hover:underline"
  >
    {children}
  </a>
));

NewsletterLink.displayName = 'NewsletterLink';

export default function NewsLetterFirstSeen({ userId, onSubscribe, onClose }: NewsLetterFirstSeenProps) {
  const { updateMultipleConsents } = useNewsletter();
  
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  
  // États locaux pour les consentements
  const [localConsents, setLocalConsents] = useState({
    email_newsletter: false,
    oep_newsletter: false,
    research_participation: false,
    personalized_support: false,
    bluesky_dm: false,
    mastodon_dm: false
  })
  
  const t = useTranslations('firstSeen')
  const pathname = usePathname()

  const languages = [
    { code: 'fr', name: 'FR' },
    { code: 'en', name: 'EN' },
    { code: 'es', name: 'ES' },
    { code: 'it', name: 'IT' },
    { code: 'de', name: 'DE' },
    { code: 'sv', name: 'SV' },
    { code: 'pt', name: 'PT'},
  ]
  
  const currentLocale = pathname.split('/')[1]

  const switchLanguage = (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`)
    window.location.href = newPath
  }

  const handleLocalConsentChange = (type: ConsentType, value: boolean) => {
    setLocalConsents(prev => ({
      ...prev,
      [type]: value,
      // Si on désactive personalized_support, on désactive aussi les DMs
      ...(type === 'personalized_support' && !value ? {
        bluesky_dm: false,
        mastodon_dm: false
      } : {})
    }))
  }

  const handleSubmit = async () => {
    // Vérifier l'email si newsletter est activée
    if (localConsents.email_newsletter && (!email || !isValidEmail(email))) {
      setError(t('newsletter.errors.missingEmail'))
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Préparer le tableau de tous les consentements avec leur valeur
      const consentsToUpdate = Object.entries(localConsents).map(([type, value]) => ({
        type: type as ConsentType,
        value
      }))

      // Envoyer tous les consentements d'un coup
      console.log("consents to update ---->", consentsToUpdate)
      const response = await fetch('/api/newsletter/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consents: consentsToUpdate,
          ...(localConsents.email_newsletter ? { email } : {})
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        onSubscribe?.()
        onClose?.()
      } else {
        // Afficher l'erreur spécifique de l'API
        const errorMessage = data.error?.message || t('newsletter.errors.updateFailed')
        if (data.error?.code === '23505') {
          setError(t('newsletter.errors.emailExists'))
        } else {
          setError(errorMessage)
        }
      }
    } catch (err) {
      console.error('Error updating consents:', err)
      setError(t('newsletter.errors.updateFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 max-w-2xl md:max-w-3xl w-full relative max-h-[90vh] overflow-y-auto mx-auto">
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
          <h2 className="text-2xl font-semibold mb-2 text-black">{t('title')}</h2>
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
              checked={localConsents.research_participation}
              onChange={(value) => handleLocalConsentChange('research_participation', value)}
              className={`${
                localConsents.research_participation ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  localConsents.research_participation ? 'translate-x-[22px]' : 'translate-x-[2px]'
                } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <span className="text-sm text-gray-700">
              {t('newsletter.researchConsent')}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-3">
              <Switch
                checked={localConsents.email_newsletter}
                onChange={(value) => handleLocalConsentChange('email_newsletter', value)}
                className={`${
                  localConsents.email_newsletter ? 'bg-blue-600' : 'bg-gray-200'
                } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              >
                <span
                  className={`${
                    localConsents.email_newsletter ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                />
              </Switch>
              <span className="text-sm text-gray-700">
                {t('newsletter.subtitle')}
              </span>
            </div>

            {localConsents.email_newsletter && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('newsletter.emailLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder={t('newsletter.emailPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              checked={localConsents.personalized_support}
              onChange={(value) => handleLocalConsentChange('personalized_support', value)}
              className={`${
                localConsents.personalized_support ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  localConsents.personalized_support ? 'translate-x-[22px]' : 'translate-x-[2px]'
                } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <span className="text-sm text-gray-700">
              {t('newsletter.personalizedSupport')}
            </span>
          </div>

          {localConsents.personalized_support && (
            <div className="ml-8 space-y-3">
              <div className="flex items-center space-x-3">
                <Switch
                  checked={localConsents.bluesky_dm}
                  onChange={(value) => handleLocalConsentChange('bluesky_dm', value)}
                  className={`${
                    localConsents.bluesky_dm ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      localConsents.bluesky_dm ? 'translate-x-[22px]' : 'translate-x-[2px]'
                    } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
                <span className="text-sm text-gray-700">
                  {t('newsletter.blueskyDM')}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <Switch
                  checked={localConsents.mastodon_dm}
                  onChange={(value) => handleLocalConsentChange('mastodon_dm', value)}
                  className={`${
                    localConsents.mastodon_dm ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      localConsents.mastodon_dm ? 'translate-x-[22px]' : 'translate-x-[2px]'
                    } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
                <span className="text-sm text-gray-700">
                  {t('newsletter.mastodonDM')}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <Switch
              checked={localConsents.oep_newsletter}
              onChange={(value) => handleLocalConsentChange('oep_newsletter', value)}
              className={`${
                localConsents.oep_newsletter ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  localConsents.oep_newsletter ? 'translate-x-[22px]' : 'translate-x-[2px]'
                } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <span className="text-sm text-gray-700">
              {t.raw('newsletter.consent').split(/\{(link_oep)\}/).map((part, index) => {
                if (part === 'link_oep') {
                  return (
                    <NewsletterLink key="oep" href="https://onestpret.com">
                      On est Prêt
                    </NewsletterLink>
                  );
                }
                return <span key={index}>{part}</span>;
              })}
            </span>
          </div>

          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
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

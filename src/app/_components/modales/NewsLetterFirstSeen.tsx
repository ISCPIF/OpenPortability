'use client'

import { useState, memo, useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import Badge from '../../../../public/v2/HQX-badge.svg'
import { Button } from '@/app/_components/ui/Button'
import { CyberSwitch } from '@/app/_components/ui/CyberSwitch'
import { ModalBody, ModalFooter, ModalHeader, ModalShell } from './ModalShell'
import { useTheme } from '@/hooks/useTheme'
import { isValidEmail } from '@/lib/utils'

interface NewsLetterFirstSeenProps {
  userId: string
  newsletterData: any
  onSubscribe?: () => void
  onClose?: () => void
  isOpen?: boolean
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

// Shared helper to ensure a single in-flight language fetch across components
const ensureLanguagePreference = async (userId: string | undefined, currentLocale: string) => {
  if (!userId) return;

  const storageKey = `user_language_${userId}`;
  const existing = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
  if (existing) return existing;

  const w = typeof window !== 'undefined' ? (window as any) : {};

  if (!w.__languageFetchPromise) {
    w.__languageFetchPromise = (async () => {
      try {
        const response = await fetch('/api/users/language');
        const data = await response.json();
        const languageToStore = data.language || currentLocale;

        if (!data.language) {
          await fetch('/api/users/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: currentLocale }),
          });
        }

        return languageToStore as string;
      } catch (err) {
        console.error('Error checking/saving language preference:', err);
        return currentLocale;
      }
    })();
  }

  const lang = await w.__languageFetchPromise;
  try {
    localStorage.setItem(storageKey, lang);
  } catch {}
  return lang as string;
};

export default function NewsLetterFirstSeen({
  userId,
  newsletterData,
  onSubscribe,
  onClose,
  isOpen = true,
}: NewsLetterFirstSeenProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
  const { isDark } = useTheme()

  const currentLocale = pathname.split('/')[1]

  // Vérifier et sauvegarder la langue à la connexion + hydrater les valeurs existantes
  useEffect(() => {
    ensureLanguagePreference(userId, currentLocale)
  }, [userId, currentLocale])

  useEffect(() => {
    if (!newsletterData) return
    if (newsletterData.email) {
      setEmail(newsletterData.email)
    }
    if (newsletterData.consents) {
      setLocalConsents((prev) => ({
        ...prev,
        ...newsletterData.consents,
      }))
    }
  }, [newsletterData])

  const handleLocalConsentChange = (type: string, value: boolean) => {
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
        type: type as string,
        value
      }))

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
    <ModalShell
      isOpen={isOpen}
      onClose={() => onClose?.()}
      theme={isDark ? 'dark' : 'light'}
      size="xl"
      className="overflow-hidden"
    >

      <ModalHeader className="flex flex-col items-center text-center gap-4">
        <div className="relative">
          <Image src={Badge} alt="Logo" width={96} height={96} />
          <span
            className="absolute inset-0 rounded-full blur-3xl"
            style={{
              background: isDark
                ? 'radial-gradient(circle, rgba(71,85,255,0.45), transparent 70%)'
                : 'radial-gradient(circle, rgba(70,72,155,0.35), transparent 70%)',
              zIndex: -1,
            }}
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-wide">
            {t('title')}
          </h2>
          <div className="mt-3 text-sm text-muted-foreground" data-slot="modal-description">
            {t.raw('description').split('\n').map((line: string, index: number) => {
              const parts: string[] = line.split(/\{(lien)\}/)
              return (
                <p key={index} className="mb-2">
                  {parts.map((part: string, partIndex: number) => {
                    if (part === 'lien') {
                      return (
                        <Link
                          key={partIndex}
                          href={`/${currentLocale}/privacy_policy`}
                          className="font-semibold text-indigo-500 hover:underline"
                        >
                          {t('privacyPolicyLink')}
                        </Link>
                      )
                    }
                    return <span key={partIndex}>{part}</span>
                  })}
                </p>
              )
            })}
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <CyberSwitch
            label={t('newsletter.researchConsent')}
            description={t('newsletter.researchDescription')}
            checked={localConsents.research_participation}
            onChange={(value) => handleLocalConsentChange('research_participation', value)}
          />

          <CyberSwitch
            label={t('newsletter.subtitle')}
            description={t('newsletter.emailDescription')}
            checked={localConsents.email_newsletter}
            onChange={(value) => handleLocalConsentChange('email_newsletter', value)}
          />

          {localConsents.email_newsletter && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/15 bg-white/5 p-4 text-left backdrop-blur"
            >
              <label className="text-xs font-semibold uppercase tracking-[0.4em] text-white/80">
                {t('newsletter.emailLabel')} <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                placeholder={t('newsletter.emailPlaceholder')}
                className="mt-3 w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff007f]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </motion.div>
          )}

          <CyberSwitch
            label={t('newsletter.personalizedSupport')}
            description={t('newsletter.personalizedSupportDescription')}
            checked={localConsents.personalized_support}
            onChange={(value) => handleLocalConsentChange('personalized_support', value)}
          />

          {localConsents.personalized_support && (
            <div className="space-y-4">
              <CyberSwitch
                label={t('newsletter.blueskyDM')}
                description={t('newsletter.blueskyDMDescription')}
                checked={localConsents.bluesky_dm}
                onChange={(value) => handleLocalConsentChange('bluesky_dm', value)}
                size="compact"
              />
              <CyberSwitch
                label={t('newsletter.mastodonDM')}
                description={t('newsletter.mastodonDMDescription')}
                checked={localConsents.mastodon_dm}
                onChange={(value) => handleLocalConsentChange('mastodon_dm', value)}
                size="compact"
              />
            </div>
          )}

          <CyberSwitch
            label="OEP NEWSLETTER"
            description={
              <span className="text-left">
                {t.raw('newsletter.consent').split(/\{(link_oep)\}/).map((part: string, index: number) => {
                  if (part === 'link_oep') {
                    return (
                      <NewsletterLink key="oep" href="https://onestpret.com">
                        On est Prêt
                      </NewsletterLink>
                    )
                  }
                  return <span key={index}>{part}</span>
                })}
              </span>
            }
            checked={localConsents.oep_newsletter}
            onChange={(value) => handleLocalConsentChange('oep_newsletter', value)}
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <Button
          variant="ghost"
          className="order-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => onClose?.()}
        >
          {t('dismiss')}
        </Button>
        <Button
          className="order-1 flex-1 bg-[#46489B] text-white shadow-lg hover:bg-[#37387c] sm:flex-none"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
              {t('newsletter.loading') ?? 'Loading...'}
            </span>
          ) : (
            t('cta')
          )}
        </Button>
      </ModalFooter>
    </ModalShell>
  )
}

function LanguageSelector({
  languages,
  currentLocale,
  isOpen,
  onToggle,
  onSelect,
}: {
  languages: { code: string; name: string }[]
  currentLocale: string
  isOpen: boolean
  onToggle: () => void
  onSelect: (locale: string) => void
}) {
  return (
    <div className="absolute right-6 top-6">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-widest text-white/80 transition hover:border-white/40"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span>{languages.find((lang) => lang.code === currentLocale)?.name}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen ? 'rotate-180' : '')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 mt-2 w-32 overflow-hidden rounded-xl border border-white/10 bg-[#050814]/95 shadow-xl"
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => onSelect(lang.code)}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2 text-sm text-white/80 transition hover:bg-white/5',
                  currentLocale === lang.code && 'bg-white/10 text-white',
                )}
              >
                <span>{lang.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ConsentToggle({
  label,
  checked,
  onChange,
  isDark,
}: {
  label: React.ReactNode
  checked: boolean
  onChange: (value: boolean) => void
  isDark: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition',
        isDark
          ? 'border-white/10 bg-white/5 hover:border-white/40'
          : 'border-slate-200 bg-white hover:border-indigo-200',
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <Switch
        checked={checked}
        onChange={onChange}
        className={cn(
          'relative h-6 w-11 rounded-full border transition',
          checked
            ? 'border-transparent bg-gradient-to-r from-indigo-500 to-pink-500'
            : 'border-current/20 bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </Switch>
    </button>
  )
}

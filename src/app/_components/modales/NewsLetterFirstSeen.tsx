'use client'

import { useState, memo, useEffect, ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Globe } from 'lucide-react'
import { Switch } from '@headlessui/react'
import { cn } from '../ui/utils'
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from './ModalShell'
import { quantico } from '@/app/fonts/plex'

import logoBlanc from '@/../public/logo/logo-openport-blanc.svg'
import logoRose from '@/../public/logos/logo-openport-rose.svg'
import blueskyIcon from '@/../public/newSVG/BS.svg'
import mastodonIcon from '@/../public/newSVG/masto.svg'
import { isValidEmail } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

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
    className="text-rose-600 dark:text-rose-400 font-medium hover:underline"
  >
    {children}
  </a>
));

NewsletterLink.displayName = 'NewsletterLink';

// Glass panel toggle component - consistent with SwitchSettingsSection style
function ConsentToggleSimple({
  label,
  description,
  checked,
  onChange,
  isDark,
  compact = false,
  icon,
}: {
  label: string
  description?: React.ReactNode
  checked: boolean
  onChange: (value: boolean) => void
  isDark: boolean
  compact?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative w-full rounded-lg p-3 transition-all duration-200 cursor-pointer',
        isDark
          ? 'bg-slate-800/50 border border-slate-700/30 hover:bg-slate-800/70 hover:border-slate-600/50'
          : 'bg-slate-100/80 border border-slate-200 hover:bg-slate-200/80 hover:border-slate-300',
        checked && (isDark ? 'border-amber-500/50 bg-amber-500/10' : 'border-amber-400 bg-amber-50'),
        compact && 'p-2.5'
      )}
      onClick={() => onChange(!checked)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
    >
      <div className="flex items-start gap-3">
        <Switch
          checked={checked}
          onChange={onChange}
          className={cn(
            'relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors',
            checked
              ? 'bg-amber-500'
              : isDark ? 'bg-slate-600' : 'bg-slate-300'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              checked && 'translate-x-4'
            )}
          />
        </Switch>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <div>
            <span className={cn(
              `${quantico.className} text-[13px] font-medium block`,
              checked ? 'text-amber-400' : (isDark ? 'text-white' : 'text-slate-800'),
              compact && 'text-[11px]'
            )}>
              {label}
            </span>
            {description && (
              <span className={cn(
                'text-[11px] mt-0.5 block leading-relaxed',
                isDark ? 'text-slate-400' : 'text-slate-600'
              )}>
                {description}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/30">
        <div className={cn(
          'w-1.5 h-1.5 rounded-full',
          checked ? 'bg-emerald-400' : 'bg-slate-500'
        )} />
        <span className={cn(
          `${quantico.className} text-[10px]`,
          checked ? 'text-emerald-400' : 'text-slate-500'
        )}>
          {checked ? 'Active' : 'Disabled'}
        </span>
      </div>
    </div>
  )
}

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
  const { updateMultipleConsents } = newsletterData
  
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
  const { isDark, colors } = useTheme()

  const descriptionLines = t
    .raw('description')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean)
  const splitIndex = Math.ceil(descriptionLines.length / 2)
  const descriptionColumns = (
    descriptionLines.length > 4
      ? [descriptionLines.slice(0, splitIndex), descriptionLines.slice(splitIndex)]
      : [descriptionLines]
  ).filter((column) => column.length > 0)

  const renderDescriptionLine = (line: string, key: string) => {
    const parts: string[] = line.split(/\{(lien)\}/)
    return (
      <p key={key} className="text-[0.8rem] sm:text-[0.9rem]">
        {parts.map((part: string, index: number) => {
          if (part === 'lien') {
            return (
              <Link
                key={`${key}-link-${index}`}
                href={`/${currentLocale}/privacy_policy`}
                className="font-semibold text-[inherit] underline decoration-dashed decoration-1 underline-offset-4"
                style={{ color: colors.secondary }}
              >
                {t('privacyPolicyLink')}
              </Link>
            )
          }
          return <span key={`${key}-part-${index}`}>{part}</span>
        })}
      </p>
    )
  }

  const languages = [
    { code: 'fr', name: 'FR' },
    { code: 'en', name: 'EN' },
    { code: 'es', name: 'ES' },
    { code: 'it', name: 'IT' },
    { code: 'de', name: 'DE' },
    { code: 'sv', name: 'SV' },
    { code: 'pt', name: 'PT' },
  ]

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
      // Si on active personalized_support, on active aussi les DMs par défaut
      ...(type === 'personalized_support' && value ? {
        bluesky_dm: true,
        mastodon_dm: true
      } : {}),
      // Si on désactive personalized_support, on désactive aussi les DMs
      ...(type === 'personalized_support' && !value ? {
        bluesky_dm: false,
        mastodon_dm: false
      } : {})
    }))
  }

  const switchLanguage = async (locale: string) => {
    if (locale === currentLocale) return
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`)

    if (userId) {
      try {
        await fetch('/api/users/language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: locale }),
        })
        localStorage.setItem(`user_language_${userId}`, locale)
      } catch (err) {
        console.error('Error saving language preference:', err)
      }
    }

    window.location.href = newPath
  }

  const handleSubmit = async () => {
    if (localConsents.email_newsletter && !isValidEmail(email)) {
      setError(t('newsletter.invalidEmail') ?? 'Invalid email')
      return
    }

    const consentPayload = Object.entries(localConsents).map(([type, value]) => ({
      type: type as keyof typeof localConsents,
      value,
    }))

    await updateMultipleConsents(
      consentPayload,
      localConsents.email_newsletter ? email : undefined
    )
    onSubscribe?.()
    onClose?.()
  }

  return (
    <ModalShell
      isOpen={isOpen ?? false}
      onClose={() => onClose?.()}
      theme={isDark ? 'dark' : 'light'}
      size="xl"
      closeOnOverlayClick={false}
      closeOnEscape={false}
      showCloseButton={false}
      ariaLabel={t('title')}
      className="!max-w-4xl"
    >
      {/* Language selector in header area */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setIsLanguageOpen(!isLanguageOpen)}
          className={`${quantico.className} flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition ${
            isDark
              ? 'border-slate-700/50 bg-slate-800/50 text-white/80 hover:border-slate-600/50 hover:bg-slate-800/70'
              : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{languages.find(lang => lang.code === currentLocale)?.name}</span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isLanguageOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isLanguageOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`absolute right-0 mt-2 w-28 overflow-hidden rounded-lg border shadow-xl z-20 ${
                isDark ? 'border-slate-700/50 bg-slate-900/95 backdrop-blur-sm' : 'border-slate-200 bg-white'
              }`}
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    switchLanguage(lang.code)
                    setIsLanguageOpen(false)
                  }}
                  className={`${quantico.className} w-full px-4 py-2 text-[11px] text-left transition ${
                    isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100'
                  } ${
                    currentLocale === lang.code 
                      ? (isDark ? 'bg-slate-800/70 text-amber-400 font-medium' : 'bg-slate-100 text-amber-600 font-medium')
                      : (isDark ? 'text-white' : 'text-slate-700')
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ModalHeader className="text-center pt-2">
        {/* <Image
          src={isDark ? logoBlanc : logoRose}
          alt="OpenPort Logo"
          width={160}
          height={48}
          className="mx-auto mb-3 h-auto w-32 sm:w-40"
          priority
        /> */}
        <h2 className={`${quantico.className} text-base sm:text-lg font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('title')}
        </h2>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {/* Description */}
        <div
          className={`rounded-lg border px-4 py-3 text-[12px] leading-relaxed ${
            isDark ? 'border-slate-700/30 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100/80 text-slate-700'
          }`}
        >
          <div className={`grid grid-cols-1 gap-3 text-left ${descriptionColumns.length > 1 ? 'sm:grid-cols-2 sm:gap-5' : ''}`}>
            {descriptionColumns.map((columnLines: string[], columnIndex: number) => (
              <div key={`description-column-${columnIndex}`} className="space-y-2">
                {columnLines.map((line: string, lineIndex: number) =>
                  renderDescriptionLine(line, `description-${columnIndex}-${lineIndex}`)
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Consent toggles - Grid 2x2 on desktop, column on mobile */}
        <div className={`rounded-lg border p-4 ${isDark ? 'border-slate-700/30 bg-slate-800/30' : 'border-slate-200 bg-slate-50/50'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Row 1: research (left) + personalized support (right) */}
            <ConsentToggleSimple
              label={t('newsletter.researchConsent')}
              checked={localConsents.research_participation}
              onChange={(value: boolean) => handleLocalConsentChange('research_participation', value)}
              isDark={isDark}
            />


            <ConsentToggleSimple
              label="OEP Newsletter"
              description={
                <span>
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
              onChange={(value: boolean) => handleLocalConsentChange('oep_newsletter', value)}
              isDark={isDark}
            />
{/* Row 2: email newsletter (left) + OEP (right) */}
            <ConsentToggleSimple
              label={t('newsletter.subtitle')}
              checked={localConsents.email_newsletter}
              onChange={(value: boolean) => handleLocalConsentChange('email_newsletter', value)}
              isDark={isDark}
            />
            
             <ConsentToggleSimple
              label={t('newsletter.personalizedSupport')}
              checked={localConsents.personalized_support}
              onChange={(value: boolean) => handleLocalConsentChange('personalized_support', value)}
              isDark={isDark}
            />
          </div>

          {/* Email input - full width below grid */}
          <AnimatePresence>
            {localConsents.email_newsletter && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4"
              >
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-700/30 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
                  <label className={`${quantico.className} text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t('newsletter.emailLabel')} <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder={t('newsletter.emailPlaceholder')}
                    className={`${quantico.className} mt-2 w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 ${
                      isDark
                        ? 'border border-slate-700/50 bg-slate-800/50 text-white placeholder:text-slate-500 focus:ring-amber-500/50'
                        : 'border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-amber-500/50'
                    }`}
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DM options - shown when personalized support is enabled */}
          <AnimatePresence>
            {localConsents.personalized_support && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4"
              >
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-700/30 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
                  <p className={`${quantico.className} text-[10px] font-medium uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Canaux de contact
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <ConsentToggleSimple
                      label={t('newsletter.blueskyDM')}
                      checked={localConsents.bluesky_dm}
                      onChange={(value: boolean) => handleLocalConsentChange('bluesky_dm', value)}
                      isDark={isDark}
                      compact
                      icon={<Image src={blueskyIcon} alt="Bluesky" width={18} height={18} />}
                    />
                    <ConsentToggleSimple
                      label={t('newsletter.mastodonDM')}
                      checked={localConsents.mastodon_dm}
                      onChange={(value: boolean) => handleLocalConsentChange('mastodon_dm', value)}
                      isDark={isDark}
                      compact
                      icon={<Image src={mastodonIcon} alt="Mastodon" width={18} height={18} />}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p className={`${quantico.className} text-[12px] text-rose-500 text-center`}>{error}</p>
        )}
      </ModalBody>

      <ModalFooter className="flex-col items-center gap-3 pt-4">
        <button
          type="button"
          className={`${quantico.className} text-[12px] transition ${
            isDark 
              ? 'text-slate-500 hover:text-slate-300' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => onClose?.()}
        >
          {t('dismiss')}
        </button>
        <button
          className={`${quantico.className} w-full max-w-xs px-6 py-2.5 text-[13px] font-medium rounded-lg transition disabled:opacity-50 ${
            isDark
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-500/20'
              : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-500/20'
          }`}
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {t('newsletter.loading') ?? 'Loading...'}
            </span>
          ) : (
            t('cta')
          )}
        </button>
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

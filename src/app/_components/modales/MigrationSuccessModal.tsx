'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ModalShell } from './ModalShell'
import PartageButton from '../layouts/PartageButton'
import { CheckCircle, AlertTriangle, PartyPopper, ArrowLeft, Send } from 'lucide-react'
import { plex, quantico } from '@/app/fonts/plex'
import { handleShare, type ShareOptions } from '@/lib/utils'
import Image from 'next/image'
import blueskyIcon from '../../../../public/newSVG/BS.svg'

interface FailureDetail {
  platform: 'bluesky' | 'mastodon'
  handle: string
  error: string
}

interface MigrationSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  // Stats
  blueskySucceeded: number
  blueskyTotal: number
  blueskyFailed: number
  mastodonSucceeded: number
  mastodonTotal: number
  mastodonFailed: number
  // Erreurs détaillées
  failures: FailureDetail[]
  // Session pour le partage
  session: {
    user: {
      bluesky_username?: string | null
      mastodon_username?: string | null
    }
  }
  // Mode lasso (discovery) - affiche un texte différent
  isLassoMode?: boolean
}

type ViewType = 'main' | 'bluesky-preview'
type TabType = 'summary' | 'errors'

export function MigrationSuccessModal({
  isOpen,
  onClose,
  blueskySucceeded,
  blueskyTotal,
  blueskyFailed,
  mastodonSucceeded,
  mastodonTotal,
  mastodonFailed,
  failures,
  session,
  isLassoMode = false,
}: MigrationSuccessModalProps) {
  const t = useTranslations('migrationSuccess')
  const tPreview = useTranslations('blueskyPreviewModale')
  const [currentView, setCurrentView] = useState<ViewType>('main')
  const [activeTab, setActiveTab] = useState<TabType>('summary')
  const [charCount, setCharCount] = useState(0)
  const [isPublishing, setIsPublishing] = useState(false)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const MAX_CHARS = 300

  const totalSucceeded = blueskySucceeded + mastodonSucceeded
  const totalToFollow = blueskyTotal + mastodonTotal
  const totalFailed = blueskyFailed + mastodonFailed
  const hasErrors = failures.length > 0

  // Message de partage
  const shareMessage = t('shareMessage', { 
    succeeded: totalSucceeded, 
    total: totalToFollow 
  })

  // Initialize textarea when switching to preview
  useEffect(() => {
    if (currentView === 'bluesky-preview' && messageRef.current) {
      messageRef.current.value = shareMessage
      setCharCount(shareMessage.length)
      messageRef.current.focus()
    }
  }, [currentView, shareMessage])

  // Reset view when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('main')
      setActiveTab('summary')
    }
  }, [isOpen])

  // Image du graphe à partager
  const shareImageOptions: ShareOptions = {
    imageUrl: '/share_image.jpeg',
    imageAlt: 'Visualisation du réseau social - OpenPortability'
  }

  const handleShareClick = (platform: string) => {
    if (platform === 'bluesky') {
      setCurrentView('bluesky-preview')
    } else {
      handleShare(shareMessage, platform, session, undefined, undefined, shareImageOptions)
    }
  }

  const handlePublishBluesky = async () => {
    if (messageRef.current && !isPublishing) {
      setIsPublishing(true)
      try {
        await handleShare(messageRef.current.value, 'bluesky', session, undefined, undefined, shareImageOptions)
        setCurrentView('main')
      } finally {
        setIsPublishing(false)
      }
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharCount(e.target.value.length)
  }

  const providers = {
    bluesky: !!session.user.bluesky_username,
    mastodon: !!session.user.mastodon_username,
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      theme="dark"
      size="lg"
      ariaLabel={currentView === 'main' ? t('title') : tPreview('previewTitle', { platform: 'Bluesky' })}
      closeOnOverlayClick={true}
      closeOnEscape={true}
      showCloseButton={currentView === 'main'}
    >
      {currentView === 'main' ? (
        /* Vue principale - Résumé de la migration */
        <div className="space-y-6">
          {/* Header avec icône */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20">
              <PartyPopper className="w-10 h-10 text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h2 className={`${plex.className} text-2xl font-bold text-white`}>
                {isLassoMode ? t('lassoTitle') : t('title')}
              </h2>
              <p className="text-sm text-white/70 max-w-md">
                {isLassoMode 
                  ? t('lassoSubtitle', { succeeded: totalSucceeded })
                  : t('subtitle', { succeeded: totalSucceeded, total: totalToFollow })}
              </p>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === 'summary'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {t('tabs.summary')}
              </div>
              {activeTab === 'summary' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
              )}
            </button>
            
            {hasErrors && (
              <button
                onClick={() => setActiveTab('errors')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                  activeTab === 'errors'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  {t('tabs.errors', { count: failures.length })}
                </div>
                {activeTab === 'errors' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                )}
              </button>
            )}
          </div>

          {/* Contenu des onglets */}
          <div className="min-h-[180px]">
            {activeTab === 'summary' ? (
              <div className="space-y-4">
                {/* Stats globales */}
                <div className="flex items-center justify-center gap-8 py-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-emerald-400">{totalSucceeded}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">{t('followed')}</p>
                  </div>
                  <div className="w-px h-12 bg-slate-700/50" />
                  {totalFailed > 0 && (
                    <>
                      <div className="w-px h-12 bg-slate-700/50" />
                      <div className="text-center">
                        <p className="text-3xl font-bold text-red-400">{totalFailed}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">{t('failed')}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Onglet Erreurs */
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {failures.map((failure, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30"
                  >
                    <span className="text-sm mt-0.5">
                      {failure.platform === 'bluesky' ? '🦋' : '🐘'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-mono truncate">
                        {failure.handle}
                      </p>
                      <p className="text-xs text-red-400/80 mt-0.5">
                        {failure.error}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Boutons de partage */}
          <div className="pt-4 border-t border-slate-700/50">
            <p className="text-center text-sm text-slate-400 mb-4">
              {t('sharePrompt')}
            </p>
            <PartageButton
              onShare={handleShareClick}
              providers={providers}
            />
          </div>

          {/* Bouton fermer */}
          <div className="flex justify-center pt-2">
            <button
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-4"
            >
              {t('close')}
            </button>
          </div>
        </div>
      ) : (
        /* Vue Bluesky Preview - Éditeur de message intégré */
        <div className="space-y-6">
          {/* Header avec bouton retour et style app */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('main')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-200"
              aria-label="Retour"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-400/20 backdrop-blur-sm">
                <Image
                  src={blueskyIcon}
                  alt="Bluesky"
                  width={28}
                  height={28}
                  className="w-7 h-7"
                />
              </div>
              <div>
                <h2 className={`text-lg font-semibold text-white uppercase tracking-wider ${quantico.className}`}>
                  {tPreview('previewTitle', { platform: 'Bluesky' })}
                </h2>
                <p className="text-xs text-white/60">Personnalisez votre message</p>
              </div>
            </div>
          </div>

          {/* Zone de texte avec style app */}
          <div className="relative rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-400/10 via-sky-400/5 to-transparent p-1 shadow-[0_0_25px_rgba(56,189,248,0.15)]">
            <textarea
              ref={messageRef}
              onChange={handleTextChange}
              className={`w-full p-4 bg-slate-900/50 backdrop-blur-sm border-0 
              rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400/50 
              min-h-[140px] text-white resize-none placeholder:text-white/40 ${quantico.className}`}
              defaultValue={shareMessage}
              placeholder="Votre message sur Bluesky..."
            />
            
            {/* Compteur de caractères */}
            <div className={`absolute bottom-4 right-4 text-xs font-medium px-2 py-1 rounded-full ${
              charCount > MAX_CHARS 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-white/10 text-white/60'
            }`}>
              {charCount}/{MAX_CHARS}
            </div>
          </div>

          {/* Boutons d'action avec style app */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setCurrentView('main')}
              className={`px-6 py-3 rounded-2xl border border-white/20 bg-white/5 text-white/80
              hover:bg-white/10 hover:border-white/30 transition-all duration-200 ${quantico.className} uppercase tracking-wider text-sm`}
            >
              {tPreview('cancel')}
            </button>
            
            <button
              onClick={handlePublishBluesky}
              disabled={charCount > MAX_CHARS || charCount === 0 || isPublishing}
              className={`group px-6 py-3 rounded-2xl flex items-center gap-2 ${quantico.className} uppercase tracking-wider text-sm
              ${charCount > MAX_CHARS || charCount === 0 || isPublishing
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600' 
                : 'bg-sky-400/80 hover:bg-sky-400 text-white border border-sky-300/50 shadow-[0_0_25px_rgba(56,189,248,0.3)] hover:shadow-[0_0_35px_rgba(56,189,248,0.4)]'
              } transition-all duration-300`}
            >
              <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              {isPublishing ? '...' : tPreview('publish')}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

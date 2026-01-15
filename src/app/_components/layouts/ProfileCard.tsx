'use client'

import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { FaBluesky, FaXTwitter, FaMastodon } from 'react-icons/fa6'
import { IoUnlinkOutline } from "react-icons/io5"
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'
import { useCommunityColors } from '@/hooks/useCommunityColors'

type ProfileCardProps = {
  type: 'twitter' | 'bluesky' | 'mastodon'
  showUnlink?: boolean
}

export default function ProfileCard({ type, showUnlink = false }: ProfileCardProps) {
  const { data: session, update: updateSession } = useSession()
  const [isUnlinking, setIsUnlinking] = useState(false)
  const t = useTranslations('profile')
  const { isDark } = useTheme()
  const { colors: communityColors } = useCommunityColors()
  
  // Use community colors for accents
  // For contrast: use light color (index 8-9) on dark theme, dark color (index 0-1) on light theme
  const contrastColor = isDark 
    ? (communityColors[9] || communityColors[8] || '#fad541') // Light color for dark theme
    : (communityColors[0] || communityColors[1] || '#011959') // Dark color for light theme
  const accentColor = communityColors[7] || '#c0b84f'

  if (!session?.user) return null

  const profiles = {
    twitter: {
      username: session.user.twitter_username,
      instance: null,
      image: session.user.twitter_image,
      id: session.user.twitter_id,
      icon: <FaXTwitter className="text-[#0f1419] text-2xl" />,
      connected: !!session.user.twitter_id
    },
    bluesky: {
      username: session.user.bluesky_username,
      instance: null,
      image: session.user.bluesky_image,
      id: session.user.bluesky_id,
      icon: <FaBluesky className="text-[#0085FF] text-2xl" />,
      connected: !!session.user.bluesky_id
    },
    mastodon: {
      username: session.user.mastodon_username,
      instance: session.user.mastodon_instance ? new URL(session.user.mastodon_instance)?.hostname : "",
      // On ignore l’image de profil mastodon pour l’instant
      // à voir si on la remplace par une image générique, 
      // ou si on autorise un accès wildcard 
      image: null, //session.user.mastodon_image,
      id: session.user.mastodon_id,
      icon: <FaMastodon className="text-[#6364FF] text-2xl" />,
      connected: !!session.user.mastodon_id
    }
  }

  const profile = profiles[type]
  if (!profile.connected) return null

  // Compter le nombre de comptes connectés
  const connectedAccounts = [
    session.user.twitter_id,
    session.user.bluesky_id,
    session.user.mastodon_id
  ].filter(Boolean).length

  const isLastAccount = connectedAccounts <= 1

  // Construire l'URL du profil
  const getProfileUrl = () => {
    switch (type) {
      case 'twitter':
        return `https://x.com/${profile.username}`
      case 'bluesky':
        return `https://bsky.app/profile/${profile.username}`
      case 'mastodon':
        return `https://${profile.instance}/@${profile.username}`
      default:
        return null
    }
  }

  const profileUrl = getProfileUrl()

  const handleUnlink = async () => {
    if (!confirm(t('unlinkConfirmation', { provider: t(`providers.${type}`) }))) {
      return
    }

    try {
      setIsUnlinking(true)
      const response = await fetch('/api/auth/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: type })
      })

      const data = await response.json()
      if (!response.ok) {
        const errorMessage = data.code === 'LAST_ACCOUNT'
          ? t('errors.lastAccount')
          : data.code === 'NOT_LINKED'
            ? t('errors.notLinked', { provider: t(`providers.${type}`) })
            : data.error

        throw new Error(errorMessage)
      }

      await updateSession()
      alert(t('unlinkSuccess', { provider: t(`providers.${type}`) }))
    } catch (error) {
      console.error('Error unlinking account:', error)
      alert(error instanceof Error ? error.message : t('unlinkError'))
    } finally {
      setIsUnlinking(false)
    }
  }
  const cardClasses = isDark
    ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-white'
    : 'bg-white/90 hover:bg-white border-slate-200 hover:border-slate-300 text-slate-900 shadow-[0_10px_25px_rgba(15,23,42,0.07)]'

  const iconWrapperClasses = isDark
    ? 'bg-white/10'
    : 'bg-slate-900/5'

  const usernameClasses = isDark
    ? 'text-sm font-medium text-white'
    : 'text-sm font-semibold text-slate-900'

  const instanceClasses = isDark ? 'text-xs text-white/60' : 'text-xs text-slate-500'

  // Platform-specific colors
  const platformColors = {
    twitter: { bg: 'bg-slate-800/80', border: 'border-slate-600/50', accent: '#1DA1F2' },
    bluesky: { bg: 'bg-sky-900/40', border: 'border-sky-500/30', accent: '#0085FF' },
    mastodon: { bg: 'bg-purple-900/40', border: 'border-purple-500/30', accent: '#6364FF' }
  }
  const platformStyle = platformColors[type]

  return (
    <div className="group">
      <div className={`relative overflow-hidden rounded-xl ${platformStyle.bg} ${platformStyle.border} border backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-lg`}>
        {/* Main content row */}
        <div className="flex items-center gap-4 p-4">
          {/* Icon du réseau social - plus grand et visible */}
          <div className="shrink-0 relative flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 shadow-inner">
            {profile.icon}
          </div>

          {/* Infos utilisateur avec lien */}
          <div className="flex-1 min-w-0">
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-semibold text-white hover:text-blue-300 truncate block transition-colors"
              >
                @{profile.username}
              </a>
            ) : (
              <p className="text-[14px] font-semibold text-white truncate">
                @{profile.username}
              </p>
            )}
            {profile.instance && (
              <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                {profile.instance}
              </span>
            )}
          </div>

          {/* Badge connecté */}
          <div className="shrink-0 hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wide">
              {t('connected') ?? 'Connected'}
            </span>
          </div>
        </div>

        {/* Bouton de déliaison - en dessous, séparé */}
        {showUnlink && (
          <div className="px-4 pb-4 pt-0">
            <button
              onClick={handleUnlink}
              disabled={isUnlinking || isLastAccount}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-rose-500/20 border border-slate-600/50 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 text-[11px] font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700/50 disabled:hover:text-slate-400 disabled:hover:border-slate-600/50 group/unlink"
            >
              <IoUnlinkOutline className="text-sm" />
              <span>
                {isLastAccount 
                  ? (
                    <>
                      <span className="group-hover/unlink:hidden">{t('unlinkButton', { provider: t(`providers.${type}`) }) ?? 'Unlink'}</span>
                      <span className="hidden group-hover/unlink:inline">{t('errors.lastAccount') ?? 'Cannot unlink last account'}</span>
                    </>
                  )
                  : (t('unlinkButton', { provider: t(`providers.${type}`) }) ?? 'Unlink')
                }
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

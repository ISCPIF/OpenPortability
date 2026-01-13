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

  return (
    <div className="group">
      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-3 py-3 rounded-lg border transition-all duration-300 ${cardClasses} hover:-translate-y-0.5 hover:scale-[1.005]`}>
        {/* Icon du réseau social */}
        <div className={`shrink-0 relative flex items-center justify-center w-8 h-8 rounded-lg ${iconWrapperClasses}`}>
          {profile.icon}
        </div>

        {/* Infos utilisateur avec lien */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${usernameClasses} truncate transition-colors`}
                style={{ color: isDark ? '#ffffff' : undefined }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.color = contrastColor;
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.color = isDark ? '#ffffff' : '';
                }}
              >
                {profile.username}
              </a>
            ) : (
              <p className={`${usernameClasses} truncate`}>
                {profile.username}
              </p>
            )}
            {profile.instance && (
              <span className={`${instanceClasses} truncate`}>
                @{profile.instance}
              </span>
            )}
          </div>
        </div>

        {/* Bouton de déliaison */}
        <div className="shrink-0 w-full sm:w-auto">
          <button
            onClick={handleUnlink}
            disabled={isUnlinking || isLastAccount}
            className={`${showUnlink ? 'inline-flex' : 'hidden group-hover:inline-flex'} items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{
              backgroundColor: isDark ? `${accentColor}1a` : `${contrastColor}0d`,
              borderColor: isDark ? `${accentColor}4d` : `${contrastColor}33`,
              color: isDark ? contrastColor : contrastColor,
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (!isUnlinking && !isLastAccount) {
                e.currentTarget.style.backgroundColor = isDark ? `${accentColor}33` : `${contrastColor}1a`;
                e.currentTarget.style.borderColor = isDark ? accentColor : contrastColor;
              }
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = isDark ? `${accentColor}1a` : `${contrastColor}0d`;
              e.currentTarget.style.borderColor = isDark ? `${accentColor}4d` : `${contrastColor}33`;
            }}
          >
            <IoUnlinkOutline className="text-base" />
            <span className="whitespace-nowrap">
              {t('unlinkButton', { provider: t(`providers.${type}`) })}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

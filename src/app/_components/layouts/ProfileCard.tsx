'use client'

import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { FaBluesky, FaXTwitter, FaMastodon } from 'react-icons/fa6'
import { IoUnlinkOutline } from "react-icons/io5"
import { useState } from 'react'
import { useTranslations } from 'next-intl'

type ProfileCardProps = {
  type: 'twitter' | 'bluesky' | 'mastodon'
  showUnlink?: boolean
}

export default function ProfileCard({ type, showUnlink = false }: ProfileCardProps) {
  const { data: session, update: updateSession } = useSession()
  const [isUnlinking, setIsUnlinking] = useState(false)
  const t = useTranslations('profile')

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
  return (
    <div className="group">
      <div className="flex items-center gap-3 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-300">
        {/* Icon du réseau social */}
        <div className="shrink-0 relative flex items-center justify-center w-8 h-8 bg-white/10 rounded-lg">
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
                className="text-sm font-medium text-white hover:text-blue-400 truncate transition-colors"
              >
                {profile.username}
              </a>
            ) : (
              <p className="text-sm font-medium text-white truncate">
                {profile.username}
              </p>
            )}
            {profile.instance && (
              <span className="text-xs text-white/50 truncate">
                @{profile.instance}
              </span>
            )}
          </div>
        </div>

        {/* Bouton de déliaison */}
        <button
          onClick={handleUnlink}
          disabled={isUnlinking || isLastAccount}
          className={`shrink-0 flex items-center gap-2 px-3 py-1.5 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/60 ${
            showUnlink ? 'inline-flex' : 'hidden group-hover:inline-flex'
          }`}
          title={isLastAccount ? t('errors.lastAccount') : t('unlinkButton', { provider: t(`providers.${type}`) })}
        >
          <IoUnlinkOutline className="text-lg" />
          <span className="text-sm whitespace-nowrap">
            {t('unlinkButton', { provider: t(`providers.${type}`) })}
          </span>
        </button>
      </div>
    </div>
  )
}

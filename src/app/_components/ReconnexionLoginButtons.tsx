'use client'

import { useTranslations } from 'next-intl'
import { plex } from '@/app/fonts/plex'
import DashboardLoginButtons from './DashboardLoginButtons'
import { useSession } from 'next-auth/react'

interface ReconnexionLoginButtonsProps {
  missingProviders: string[]
  onClose?: () => void
}

export default function ReconnexionLoginButtons({ missingProviders, onClose }: ReconnexionLoginButtonsProps) {
  const t = useTranslations('ReconnexionLoginButtons')
  const { data: session } = useSession()
  
  // Déterminer quel message afficher
  const description = missingProviders.includes('bluesky')
    ? t('description.bluesky')
    : !session?.user?.mastodon_id
      ? t('description.mastodon')
      : ''

  return (
    <div className="flex flex-col space-y-8 w-full max-w-3xl mx-auto bg-[#1A237E] p-8 rounded-lg">
      <div className="text-white text-center">
        <h2 className={`${plex.className} text-2xl font-bold mb-4`}>
          {t('title')}
        </h2>
        <p className="text-lg mb-8">
          {description}
        </p>
      </div>

      <DashboardLoginButtons
        connectedServices={{
          bluesky: !missingProviders.includes('bluesky'),
          mastodon: !!session?.user?.mastodon_id,
          twitter: true,
        }}
        hasUploadedArchive={true}
        onLoadingChange={() => {}}
        mastodonInstances={[]}
      />
    </div>
  )
}
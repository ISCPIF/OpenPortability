'use client'

import { motion } from 'framer-motion'
import { plex } from '../fonts/plex'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

import mastodonIcon from '../../../public/newSVG/masto.svg'
import blueskyIcon from '../../../public/newSVG/BS.svg'
import twitterIcon from '../../../public/newSVG/X.svg'

interface PartageButtonProps {
  onShare: (platform: string) => void;
  onShowBlueSkyPreview?: () => void; // Nouvelle prop pour déclencher la modale
  providers: {
    twitter?: boolean;
    bluesky?: boolean;
    mastodon?: boolean;
  };
}

export default function PartageButton({ onShare, onShowBlueSkyPreview, providers }: PartageButtonProps) {
  const t = useTranslations('partageButton')

  const handleClick = (platform: string) => {
    if (platform === 'bluesky' && onShowBlueSkyPreview) {
      // Si c'est BlueSky et qu'on a fourni la fonction pour afficher la prévisualisation
      onShowBlueSkyPreview()
    } else {
      // Sinon, on utilise le comportement normal
      onShare(platform)
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-4">
      {providers.mastodon && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleClick('mastodon')}
          className={`inline-flex items-center gap-2 px-6 py-3 
                   bg-white hover:bg-gray-50
                   text-[#2a39a9] font-semibold rounded-full transition-all duration-200 ${plex.className}`}
        >
          <Image
            src={mastodonIcon}
            alt="Mastodon"
            width={24}
            height={24}
            className="w-6 h-6"
          />
          {t('shareOn', { platform: 'Mastodon' })}
        </motion.button>
      )}

      {providers.bluesky && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleClick('bluesky')}
          className={`inline-flex items-center gap-2 px-6 py-3 
                   bg-white hover:bg-gray-50
                   text-[#2a39a9] font-semibold rounded-full transition-all duration-200 ${plex.className}`}
        >
          <Image
            src={blueskyIcon}
            alt="Bluesky"
            width={24}
            height={24}
            className="w-6 h-6"
          />
          {t('shareOn', { platform: 'Bluesky' })}
        </motion.button>
      )}

      {providers.twitter && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleClick('twitter')}
          className={`inline-flex items-center gap-2 px-6 py-3 
                   bg-white hover:bg-gray-50
                   text-[#2a39a9] font-semibold rounded-full transition-all duration-200 ${plex.className}`}
        >
          <Image
            src={twitterIcon}
            alt="X"
            width={24}
            height={24}
            className="w-6 h-6"
          />
          {t('shareOn', { platform: 'X' })}
        </motion.button>
      )}
    </div>
  )
}
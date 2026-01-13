'use client'

import { motion } from 'framer-motion'
import { quantico } from '../../fonts/plex'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

import mastodonIcon from '../../../../public/newSVG/masto.svg'
import blueskyIcon from '../../../../public/newSVG/BS.svg'
import twitterIcon from '../../../../public/newSVG/X.svg'

interface PartageButtonProps {
  onShare: (platform: string) => void;
  onShowBlueSkyPreview?: () => void;
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
      onShowBlueSkyPreview()
    } else {
      onShare(platform)
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {providers.mastodon && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleClick('mastodon')}
          className={`group inline-flex items-center gap-3 px-5 py-3 
                   rounded-2xl border border-purple-400/30 bg-purple-400/80
                   text-white font-semibold uppercase tracking-wider text-sm
                   shadow-[0_0_20px_rgba(168,85,247,0.25)] 
                   hover:shadow-[0_0_30px_rgba(168,85,247,0.35)] hover:border-purple-300/50
                   transition-all duration-300 ${quantico.className}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Image
              src={mastodonIcon}
              alt="Mastodon"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <span>{t('shareOn', { platform: 'Mastodon' })}</span>
        </motion.button>
      )}

      {providers.bluesky && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleClick('bluesky')}
          className={`group inline-flex items-center gap-3 px-5 py-3 
                   rounded-2xl border border-sky-400/30 bg-sky-400/80
                   text-white font-semibold uppercase tracking-wider text-sm
                   shadow-[0_0_20px_rgba(56,189,248,0.25)] 
                   hover:shadow-[0_0_30px_rgba(56,189,248,0.35)] hover:border-sky-300/50
                   transition-all duration-300 ${quantico.className}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Image
              src={blueskyIcon}
              alt="Bluesky"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <span>{t('shareOn', { platform: 'Bluesky' })}</span>
        </motion.button>
      )}

      {providers.twitter && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleClick('twitter')}
          className={`group inline-flex items-center gap-3 px-5 py-3 
                   rounded-2xl border border-slate-400/30 bg-slate-700/80
                   text-white font-semibold uppercase tracking-wider text-sm
                   shadow-[0_0_20px_rgba(100,116,139,0.25)] 
                   hover:shadow-[0_0_30px_rgba(100,116,139,0.35)] hover:border-slate-400/50
                   transition-all duration-300 ${quantico.className}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Image
              src={twitterIcon}
              alt="X"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <span>{t('shareOn', { platform: 'X' })}</span>
        </motion.button>
      )}
    </div>
  )
}
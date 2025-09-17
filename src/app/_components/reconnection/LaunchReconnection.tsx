'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { motion } from 'framer-motion';
import { Users, Globe } from 'lucide-react';
import BadgeSuccessOne from '../../../public/v2/badge-success-1.svg';
import BadgeSuccessTwo from '../../../public/v2/badge-success-2.svg';
import BadgeSuccessTwoOff from '../../../public/v2/badge-success-2-OFF.svg';
import { useEffect, useState } from 'react';
import { UserCompleteStats } from '@/lib/types/stats';
import PartageButton from '@/app/_components/layouts/PartageButton';
import { handleShare } from '@/lib/utils';

interface LaunchReconnectionProps {
  session: {
    user: {
      twitter_username: string;
      bluesky_username?: string | null;
      mastodon_username?: string | null;
      mastodon_instance? : string | null;
    };
  };
  totalProcessed?: number;
  totalInDatabase?: number;
  userStats: UserCompleteStats;
}

const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export default function LaunchReconnection({
  session,
  totalProcessed = 0,
  totalInDatabase = 0,
  userStats,
}: LaunchReconnectionProps) {
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [totalHasFollowed, setTotalHasFollowed] = useState<number>(0);
  const [isShared, setIsShared] = useState(false);
  const t = useTranslations('launchReconnection');

  useEffect(() => {
    // Calculate total matches and hasFollowed based on connected accounts
    let total = 0;
    let hasFollowed = 0;
    total += userStats.matches.bluesky.notFollowed;
    hasFollowed += userStats.matches.bluesky.hasFollowed;
    total += userStats.matches.mastodon.notFollowed;
    hasFollowed += userStats.matches.mastodon.hasFollowed;
    setTotalMatches(total);
    setTotalHasFollowed(hasFollowed);

  }, [userStats, session.user.bluesky_username, session.user.mastodon_username]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center w-full mx-auto p-4 sm:p-6 md:p-8 bg-[#2a39a9] rounded-lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] relative w-full gap-x-4 sm:gap-x-8 gap-y-4">
        {/* Séparateur vertical central - visible uniquement sur tablette/desktop */}
        <div className="absolute left-[64px] top-[80px] bottom-[80px] w-[2px] bg-[#ebece7]/30 rounded-full hidden sm:block" />

        {/* Première ligne : Badge 1 et Message de premier objectif */}
        <div className="flex items-center justify-center sm:justify-start">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32">
            <Image
              src={BadgeSuccessOne}
              alt="Success Badge One"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col justify-center text-center sm:text-left">
          <h2 className={`${plex.className} text-xl sm:text-2xl md:text-3xl font-bold text-[#ebece7]`}>
            {t('firstObjective.before')}{' '}
            <span className="text-[#d6356f]">
              @{session.user.twitter_username || session.user.bluesky_username || session.user.mastodon_username}
            </span>
            {t('firstObjective.after')}
          </h2>
        </div>

        {/* Deuxième ligne : texte d'invitation */}
        <div className="col-span-1 sm:col-span-2 sm:pl-40 text-center sm:text-left">
          <p className={`${plex.className} text-base sm:text-lg text-[#ebece7]`}>
            {t('inviteMessage')}
          </p>

          <div className="flex justify-center sm:justify-start mt-4">
            <Link 
              href="/reconnect"
              className={`${plex.className} inline-flex items-center px-6 sm:px-11 py-3 sm:py-4 bg-[#d6356f] text-[#ebece7] font-bold rounded-full hover:bg-[#d6356f]/90 transition-colors duration-300 text-sm sm:text-base`}
            >
              {totalMatches > 0 
                ? t('launchButton', { count: formatNumber(totalMatches) })
                : t('alreadyReconnected', { count: formatNumber(totalHasFollowed) })
              }
            </Link>
          </div>
          
          <div className="p-2 sm:p-4">
            {/* Messages pour les services non connectés avec des matches */}
            {!session.user.bluesky_username && userStats.matches.bluesky.notFollowed > 0 && (
              <p className={`${plex.className} text-base sm:text-lg text-[#ebece7] mb-3 sm:mb-4`}>
                {t('blueskyConnectionMessage.before')}{' '}
                <span className="text-[#d6356f] font-bold">
                  {formatNumber(userStats.matches.bluesky.notFollowed)}
                </span>{' '}
                {t('blueskyConnectionMessage.after')}
              </p>
            )}
            {!session.user.mastodon_username && userStats.matches.mastodon.notFollowed > 0 && (
              <p className={`${plex.className} text-base sm:text-lg text-[#ebece7] mb-3 sm:mb-4`}>
                {t('mastodonConnectionMessage.before')}{' '}
                <span className="text-[#d6356f] font-bold">
                  {formatNumber(userStats.matches.mastodon.notFollowed)}
                </span>{' '}
                {t('mastodonConnectionMessage.after')}
              </p>
            )}

            <PartageButton
              onShare={(platform) => {
                const shareText = t('shareText', {
                  count: totalMatches
                });
                handleShare(shareText, platform, session, () => {}, setIsShared);
              }}
              providers={{
                bluesky: session.user.bluesky_username ? true : false,
                mastodon: session.user.mastodon_username ? true : false,
                twitter: session.user.twitter_username ? true : false,
              }}
            />
          </div>
        </div>

        {/* Troisième ligne : Badge 2 et stats */}
        <div className="flex items-center justify-center sm:justify-start">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32">
            <Image
              src={totalHasFollowed > 0 ? BadgeSuccessTwo : BadgeSuccessTwoOff}
              alt={totalHasFollowed > 0 ? "Success Badge Two" : "Success Badge Two OFF"}
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="bg-black/20 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <div className="bg-pink-500/20 p-2 rounded-full">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
            </div>
            <div>
              <p className={`${plex.className} text-xs sm:text-sm text-white/60`}>{t('stats.twitterAccounts')}</p>
              <p className={`${plex.className} text-xl sm:text-2xl font-bold text-white`}>
                {formatNumber(userStats.connections.followers + userStats.connections.following)}
              </p>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <div className="bg-pink-500/20 p-2 rounded-full">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
            </div>
            <div>
              <p className={`${plex.className} text-xs sm:text-sm text-white/60`}>{t('stats.totalImported')}</p>
              <p className={`${plex.className} text-xl sm:text-2xl font-bold text-white`}>
                {formatNumber(totalInDatabase)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { motion } from 'framer-motion';
import { Users, Globe } from 'lucide-react';
import BadgeSuccessOne from '../../../public/v2/badge-success-1.svg';
import BadgeSuccessTwo from '../../../public/v2/badge-success-2-OFF.svg';
import { useEffect, useState } from 'react';
import { UserCompleteStats } from '@/lib/types/stats';

interface LaunchReconnectionProps {
  session: {
    user: {
      twitter_username: string;
      bluesky_username?: string | null;
      mastodon_username?: string | null;
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
  const t = useTranslations('launchReconnection');

  useEffect(() => {
    // Calculate total matches and hasFollowed based on connected accounts
    let total = 0;
    let hasFollowed = 0;
    if (session.user.bluesky_username) {
      total += userStats.matches.bluesky.notFollowed;
      hasFollowed += userStats.matches.bluesky.hasFollowed;
    }
    if (session.user.mastodon_username) {
      total += userStats.matches.mastodon.notFollowed;
      hasFollowed += userStats.matches.mastodon.hasFollowed;
    }
    setTotalMatches(total);
    setTotalHasFollowed(hasFollowed);

    console.log("TOTALS", total, hasFollowed)
    console.log("USER STATS", userStats)
  }, [userStats, session.user.bluesky_username, session.user.mastodon_username]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center w-full max-w-4xl mx-auto p-8 bg-[#2a39a9] rounded-lg shadow-lg"
    >
      <div className="grid grid-cols-[auto,1fr] relative w-full gap-x-8 gap-y-12">
        {/* Séparateur vertical central */}
        <div className="absolute left-[64px] top-[80px] bottom-[80px] w-[2px] bg-[#ebece7]/30 rounded-full" />

        {/* Première ligne : Badge 1 et Message de premier objectif */}
        <div className="flex items-center">
          <div className="relative w-32 h-32">
            <Image
              src={BadgeSuccessOne}
              alt="Success Badge One"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <h2 className={`${plex.className} text-3xl font-bold mb-4 text-[#ebece7]`}>
            {t('firstObjective.before')}{' '}
            <span className="text-[#d6356f]">
              @{session.user.twitter_username}
            </span>
            {t('firstObjective.after')}
          </h2>
        </div>

        {/* Deuxième ligne : texte d'invitation */}
        <div className="col-span-2 pl-40">
          <p className={`${plex.className} text-lg text-[#ebece7] mb-8`}>
            {t('inviteMessage')}
          </p>

          {/* Messages pour les services non connectés avec des matches */}
          {!session.user.bluesky_username && userStats.matches.bluesky.notFollowed > 0 && (
            <p className={`${plex.className} text-lg text-[#ebece7] mb-4`}>
              {t('blueskyConnectionMessage.before')}{' '}
              <span className="text-[#d6356f] font-bold">
                {formatNumber(userStats.matches.bluesky.notFollowed)}
              </span>{' '}
              {t('blueskyConnectionMessage.after')}
            </p>
          )}
          {!session.user.mastodon_username && userStats.matches.mastodon.notFollowed > 0 && (
            <p className={`${plex.className} text-lg text-[#ebece7] mb-4`}>
              {t('mastodonConnectionMessage.before')}{' '}
              <span className="text-[#d6356f] font-bold">
                {formatNumber(userStats.matches.mastodon.notFollowed)}
              </span>{' '}
              {t('mastodonConnectionMessage.after')}
            </p>
          )}

          {/* Afficher le bouton uniquement s'il y a des comptes à reconnecter */}
          <Link 
            href="/reconnect"
            className={`${plex.className} inline-block p-6 bg-[#d6356f] text-[#ebece7] font-bold rounded-xl hover:bg-[#d6356f]/90 transition-colors duration-300 mb-8`}
          >
            {totalMatches > 0 
              ? t('launchButton', { count: formatNumber(totalMatches) })
              : t('alreadyReconnected', { count: formatNumber(totalHasFollowed) })
            }
          </Link>
        </div>

        {/* Troisième ligne : Badge 2 et stats */}
        <div className="flex items-center">
          <div className="relative w-32 h-32">
            <Image
              src={BadgeSuccessTwo}
              alt="Success Badge Two OFF"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="bg-black/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-pink-500/20 p-2 rounded-full">
              <Users className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <p className={`${plex.className} text-sm text-white/60`}>{t('stats.twitterAccounts')}</p>
              <p className={`${plex.className} text-2xl font-bold text-white`}>
                {formatNumber(userStats.connections.followers + userStats.connections.following)}
              </p>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-pink-500/20 p-2 rounded-full">
              <Globe className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <p className={`${plex.className} text-sm text-white/60`}>{t('stats.totalImported')}</p>
              <p className={`${plex.className} text-2xl font-bold text-white`}>
                {formatNumber(totalInDatabase)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { plex } from '@/app/fonts/plex';
import { motion } from 'framer-motion';
import BadgeSuccessTwo from '../../../public/v2/badge-success-2.svg';
import BadgeSuccessOne from '../../../public/v2/badge-success-1.svg';
import BSLogo from '../../../public/v2/statut=BS-defaut.svg';
import MastoLogo from '../../../public/v2/statut=Masto-Defaut.svg';
import { handleShare } from '@/lib/utils';
import PartageButton from './PartageButton';

interface SuccessAutomaticReconnexionProps {
  session: {
    user: {
      twitter_username: string;
      bluesky_username?: string;
      mastodon_username?: string;
      mastodon_instance?: string;
      has_onboarded?: boolean;
    };
  };
  stats: {
    connections: {
      followers: number;
      following: number;
      totalEffectiveFollowers: number;
    };
    matches: {
      bluesky: {
        total: number;
        hasFollowed: number;
        notFollowed: number;
      };
      mastodon: {
        total: number;
        hasFollowed: number;
        notFollowed: number;
      };
    };
    updated_at: string;
  };
  onSuccess: () => void;
}

export default function SuccessAutomaticReconnexion({
  session,
  stats,
  onSuccess,
}: SuccessAutomaticReconnexionProps) {
  const t = useTranslations('SuccessAutomaticReconnexion');
  const totalReconnected = (session.user.bluesky_username ? stats.matches.bluesky.hasFollowed : 0) + 
                          (session.user.mastodon_username ? stats.matches.mastodon.hasFollowed : 0);

  const onShareClick = (platform: string) => {
    const message = t('shareMessage', {
      // username: session.user.twitter_username,
      count: totalReconnected,
      effectiveFollowers: stats.connections.totalEffectiveFollowers || 0
    });
    console.log("sesionn from onShareCLick", session)
    handleShare(message, platform, session, () => {}, () => {});
  };

  console.log("stats from SuccessAutomaticReconnexion", totalReconnected)
  useEffect(() => {
    // Appeler onSuccess une seule fois au montage du composant
    onSuccess();
  }, []); // Enlever onSuccess des dépendances car on veut l'appeler qu'une fois

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8 bg-[#2a39a9] rounded-lg shadow-lg"
    >
      {/* Disposition mobile: Colonnes empilées verticalement */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-[auto,1fr] relative gap-4 sm:gap-x-8 sm:gap-y-12">
        {/* Séparateur vertical uniquement visible sur desktop */}
        <div className="hidden sm:block absolute left-[72px] top-[80px] bottom-[80px] w-[2px] bg-[#ebece7]/30 rounded-full" />
        
        {/* Séparateur horizontal uniquement visible sur mobile */}
        <div className="sm:hidden w-full h-[2px] bg-[#ebece7]/30 rounded-full my-6" />

        {/* Première ligne : Badge 2 et Message de bravo */}
        <div className="flex justify-center sm:justify-start items-center">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32">
            <Image
              src={BadgeSuccessTwo}
              alt="Success Badge"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col justify-center items-center sm:items-start mt-4 sm:mt-0">
          <h2 className={`${plex.className} text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-[#ebece7] text-center sm:text-left`}>
            {t('congratulations')} <span className="text-[#d6356f]">@{session.user.twitter_username}</span> !{' '}
            {t('secondObjective', { count: totalReconnected })}
          </h2>
        </div>

        {/* Deuxième ligne : Espace vide et Stats */}
        <div className="h-px" /> {/* Espace pour maintenir l'alignement */}

        <div className="flex flex-col w-full">
          <p className="text-base md:text-lg text-[#ebece7] mb-6 sm:mb-8 text-center sm:text-left">
            {t('notification')}
          </p>

          <div className={`${
            session.user.bluesky_username && session.user.mastodon_username
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8'
              : 'flex justify-center'
          }`}>
            {session.user.mastodon_username && (
              <div className="text-center p-4 sm:p-6 rounded-xl bg-[#1f2498]/30 border border-[#ebece7]/20 backdrop-blur-sm hover:border-[#ebece7]/40 transition-all duration-300">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 relative mb-2 sm:mb-3">
                    <Image
                      src={MastoLogo}
                      alt="Mastodon Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-[#ebece7]">{t('stats.mastodonFollowing')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#ebece7]">{stats.matches.mastodon.hasFollowed}</p>
                </div>
              </div>
            )}
            {session.user.bluesky_username && (
              <div className="text-center p-4 sm:p-6 rounded-xl bg-[#1f2498]/30 border border-[#ebece7]/20 backdrop-blur-sm hover:border-[#ebece7]/40 transition-all duration-300">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 relative mb-2 sm:mb-3">
                    <Image
                      src={BSLogo}
                      alt="Bluesky Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-[#ebece7]">{t('stats.blueskyFollowing')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#ebece7]">{stats.matches.bluesky.hasFollowed}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 sm:mt-8 w-full">
            <PartageButton
              onShare={onShareClick}
              providers={{
                bluesky: !!session.user.bluesky_username,
                mastodon: !!session.user.mastodon_username,
                twitter: !!session.user.twitter_username
              }}
            />
          </div>
          <div className="mt-8 sm:mt-12 flex justify-center w-full">
            <button 
              onClick={() => {
                if (session.user.has_onboarded) {
                  window.location.reload();
                } else {
                  window.location.href = '/dashboard';
                }
              }}
              className="inline-block w-fit py-3 px-4 sm:p-4 bg-[#d6356f] text-[#ebece7] text-sm sm:text-base rounded-xl hover:bg-[#c02d61] transition-colors mb-4"
            >
              {t('goToDashboard')}
            </button>
          </div>
        </div>

        {/* Séparateur horizontal uniquement visible sur mobile */}
        <div className="sm:hidden w-full h-[2px] bg-[#ebece7]/30 rounded-full my-6" />

        {/* Troisième ligne : Badge 1 et Message du premier objectif */}
        <div className="flex justify-center sm:justify-start items-center">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32">
            <Image
              src={BadgeSuccessOne}
              alt="First Success Badge"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex items-center justify-center sm:justify-start">
          <p className="text-xl sm:text-2xl md:text-3xl text-[#ebece7] text-center sm:text-left">
            {t('firstObjective')}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
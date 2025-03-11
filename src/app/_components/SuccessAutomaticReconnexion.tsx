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
      {/* Structure en une seule colonne */}
      <div className="w-full flex flex-col items-center gap-6 sm:gap-8">
        {/* Message de félicitations */}
        <div className="flex flex-col justify-center items-center text-center w-full">
          <h2 className={`${plex.className} text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-[#ebece7]`}>
            {t('congratulations')} <span className="text-[#d6356f]">@{session.user.twitter_username}</span> !{' '}
            {t('secondObjective', { count: totalReconnected })}
          </h2>

                  {/* Boutons de partage */}
                <div className="w-full p-4">
                  <PartageButton
                    onShare={onShareClick}
                    providers={{
                      bluesky: !!session.user.bluesky_username,
                      mastodon: !!session.user.mastodon_username,
                      twitter: !!session.user.twitter_username
                    }}
                  />
                </div>
                  
          <p className="text-base md:text-lg text-[#ebece7] mb-6">
            {t('notification')}
          </p>
        </div>

        {/* Statistiques */}
        <div className={`w-full ${
          session.user.bluesky_username && session.user.mastodon_username
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12'
            : 'flex justify-center'
        }`}>
          {session.user.mastodon_username && (
            <div className="flex flex-col items-center justify-center rounded-xl aspect-square bg-[#1f2498]/30 border border-[#ebece7]/20 backdrop-blur-sm hover:border-[#ebece7]/40 transition-all duration-300">
              <div className="w-24 h-24 sm:w-28 sm:h-28 relative mb-2">
                <Image
                  src={MastoLogo}
                  alt="Mastodon Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-[#ebece7]">{stats.matches.mastodon.hasFollowed}</p>
              <p className="text-sm sm:text-base text-[#ebece7]/80">{t('stats.mastodonFollowing')}</p>
            </div>
          )}
          {session.user.bluesky_username && (
            <div className="flex flex-col items-center justify-center rounded-xl aspect-square bg-[#1f2498]/30 border border-[#ebece7]/20 backdrop-blur-sm hover:border-[#ebece7]/40 transition-all duration-300">
              <div className="w-24 h-24 sm:w-28 sm:h-28 relative mb-2">
                <Image
                  src={BSLogo}
                  alt="Bluesky Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-[#ebece7]">{stats.matches.bluesky.hasFollowed}</p>
              <p className="text-sm sm:text-base text-[#ebece7]/80">{t('stats.blueskyFollowing')}</p>
            </div>
          )}
        </div>

        {/* Badge premier objectif et bouton */}
        {/* <div className="mt-6 flex flex-col items-center">
          
          <p className={`${plex.className} text-lg sm:text-xl font-medium text-[#ebece7] text-center mb-6`}>
            {t('firstObjective')}
          </p> */}
          
          <button 
            onClick={() => {
              // Compter le nombre de services connectés
              const connectedServicesCount = [
                !!session.user.twitter_username,
                !!session.user.bluesky_username,
                !!session.user.mastodon_username
              ].filter(Boolean).length;
              
              // Rediriger vers /dashboard si:
              // - L'utilisateur n'a pas fait son onboarding OU
              // - L'utilisateur est connecté à moins de 3 services
              if (!session.user.has_onboarded || connectedServicesCount < 3) {
                window.location.href = '/dashboard';
              } else {
                window.location.reload();
              }
            }}
            className="inline-block w-fit py-3 px-4 sm:p-4 bg-[#d6356f] text-[#ebece7] text-sm sm:text-base rounded-xl hover:bg-[#c02d61] transition-colors"
          >
            {t('goToDashboard')}
          </button>
        {/* </div> */}
      </div>
    </motion.div>
  );
}
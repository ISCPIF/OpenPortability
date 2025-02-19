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

interface SuccessAutomaticReconnexionProps {
  session: {
    user: {
      twitter_username: string;
      bluesky_username?: string;
      mastodon_username?: string;
    };
  };
  stats: {
    connections: {
      followers: number;
      following: number;
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


  console.log("stats from SuccessAutomaticReconnexion", totalReconnected)
  useEffect(() => {
    // Appeler onSuccess une seule fois au montage du composant
    onSuccess();
  }, []); // Enlever onSuccess des dépendances car on veut l'appeler qu'une fois

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center w-full max-w-4xl mx-auto p-8 bg-[#2a39a9] rounded-lg shadow-lg"
    >
      <div className="grid grid-cols-[auto,1fr] relative w-full gap-x-8 gap-y-12">
        {/* Séparateur vertical central */}
        <div className="absolute left-[72px] top-[80px] bottom-[80px] w-[2px] bg-[#ebece7]/30 rounded-full" />

        {/* Première ligne : Badge 2 et Message de bravo */}
        <div className="flex items-center">
          <div className="relative w-32 h-32">
            <Image
              src={BadgeSuccessTwo}
              alt="Success Badge"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <h2 className={`${plex.className} text-3xl font-bold mb-4 text-[#ebece7]`}>
            {t('congratulations')} <span className="text-[#d6356f]">@{session.user.twitter_username}</span> !{' '}
            {t('secondObjective', { count: totalReconnected })}
          </h2>
        </div>

        {/* Deuxième ligne : Espace vide et Stats */}
        <div className="h-px" /> {/* Espace pour maintenir l'alignement */}

        <div className="flex flex-col">
          <p className="text-lg text-[#ebece7] mb-8">
            {t('notification')}
          </p>


          <div className={`${
            session.user.bluesky_username && session.user.mastodon_username
              ? 'grid grid-cols-2 gap-8'
              : 'flex justify-center'
          }`}>
            {session.user.bluesky_username && (
              <div className="text-center p-6 rounded-xl bg-[#1f2498]/30 border border-[#ebece7]/20 backdrop-blur-sm hover:border-[#ebece7]/40 transition-all duration-300">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 relative mb-3">
                    <Image
                      src={BSLogo}
                      alt="Bluesky Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-sm text-[#ebece7]">{t('stats.blueskyFollowing')}</p>
                  <p className="text-2xl font-bold text-[#ebece7]">{stats.matches.bluesky.hasFollowed}</p>
                </div>
              </div>
            )}
            {session.user.mastodon_username && (
              <div className="text-center p-6 rounded-xl bg-[#1f2498]/30 border border-[#ebece7]/20 backdrop-blur-sm hover:border-[#ebece7]/40 transition-all duration-300">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 relative mb-3">
                    <Image
                      src={MastoLogo}
                      alt="Mastodon Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-sm text-[#ebece7]">{t('stats.mastodonFollowing')}</p>
                  <p className="text-2xl font-bold text-[#ebece7]">{stats.matches.mastodon.hasFollowed}</p>
                </div>
              </div>
            )}
          </div>

          {/* {((session.user.bluesky_username ? stats.matches.bluesky.notFollowed : 0) + 
            (session.user.mastodon_username ? stats.matches.mastodon.notFollowed : 0)) > 0 && ( */}
              <div className="mt-12 flex justify-center w-full">
              <button 
                onClick={() => window.location.reload()}
                className="inline-block w-fit px-4 py-2 bg-[#d6356f] text-[#ebece7] rounded-full hover:bg-[#c02d61] transition-colors mb-4"
              >
                {t('goToDashboard')}
              </button>
            </div>
          {/* // )} */}
        </div>

        {/* Troisième ligne : Badge 1 et Message du premier objectif */}
        <div className="flex items-center">
          <div className="relative w-32 h-32">
            <Image
              src={BadgeSuccessOne}
              alt="First Success Badge"
              fill
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex items-center">
          <p className="text-3xl text-[#ebece7]">
            {t('firstObjective')}
          </p>
        </div>

        
      </div>
    </motion.div>
  );
}
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FaCheck, FaUsers } from "react-icons/fa";
import Image from 'next/image';
import { plex, caveat } from '@/app/fonts/plex';
import arrowGrowth from '../../../public/v2/uil_arrow-growth.svg';
import chainon from '../../../public/v2/chainon.svg';
import { useState, useEffect } from 'react';

// Hook personnalisé pour détecter si l'écran est mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Fonction pour vérifier si l'écran est mobile (breakpoint à 640px)
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    // Vérifier au chargement initial
    checkIsMobile();
    
    // Ajouter l'écouteur d'événement pour le redimensionnement
    window.addEventListener('resize', checkIsMobile);
    
    // Nettoyer l'écouteur d'événement au démontage
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  
  return isMobile;
}

interface StatsProps {
  session: {
    user: {
      twitter_username: string;
      bluesky_username?: string;
      mastodon_username?: string;
    };
  };
  stats?: {
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
  } | null;
  simpleView?: boolean;
}

export default function MigrateStats({ stats, session, simpleView = false }: StatsProps) {
  const t = useTranslations('migrateSea');
  const isMobile = useIsMobile();

  if (!stats) return null;

  const totalToFollow = 
    (session.user.bluesky_username ? stats.matches.bluesky.notFollowed : 0) + 
    (session.user.mastodon_username ? stats.matches.mastodon.notFollowed : 0);
    
  const totalFollowed = 
    (session.user.bluesky_username ? stats.matches.bluesky.hasFollowed : 0) + 
    (session.user.mastodon_username ? stats.matches.mastodon.hasFollowed : 0);

  // Classes conditionnelles basées sur la taille de l'écran
  const titleClass = isMobile 
    ? `${caveat.className} text-[2.5rem] leading-tight text-[#d6356f] z-[15] text-center font-bold` 
    : `${caveat.className} text-[5rem] whitespace-nowrap text-[#d6356f] z-[15] text-center font-bold`;
  
  const numberClass = isMobile 
    ? `${plex.className} text-[40px] text-[#66D9E8] font-bold` 
    : `${plex.className} text-[80px] text-[#66D9E8] font-bold`;
  
  const checkedNumberClass = isMobile 
    ? `${plex.className} text-[40px] text-[#6fce97] font-bold` 
    : `${plex.className} text-[80px] text-[#6fce97] font-bold`;
  
  const followersNumberClass = isMobile 
    ? `${plex.className} text-[40px] text-[#d6356f] font-bold` 
    : `${plex.className} text-[80px] text-[#d6356f] font-bold`;
  
  const iconSize = isMobile ? "text-xl" : "text-3xl";
  const chanonSize = isMobile ? 50 : 100;
  const arrowSize = isMobile ? 20 : 30;
  const containerMargin = isMobile ? "mt-[150px]" : "mt-[250px]";
  // Réduire l'espacement en mode mobile
  const containerClass = isMobile ? "flex flex-col gap-4" : "flex items-center justify-center";
  const textClass = isMobile 
    ? `${plex.className} text-white text-center text-xs mt-1 max-w-[250px] whitespace-pre-line`
    : `${plex.className} text-white text-center text-sm mt-2 max-w-[250px] whitespace-pre-line`;

  return (
    <div className={`w-full ${containerMargin}`}>
      <h1 className={titleClass}>
        {isMobile 
          ? t('title').split(' ').map((word, index, array) => (
              <React.Fragment key={index}>
                {word}
                {index < array.length - 1 && <br />}
              </React.Fragment>
            ))
          : t('title')}
      </h1>

      {!simpleView && (
        <div className={containerClass}>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <span className={numberClass}>
                {totalToFollow}
              </span>
              <Image src={arrowGrowth} alt="" width={arrowSize} height={arrowSize} />
            </div>
            <p className={textClass}>
              {t('stats.awaitingConnection')}
            </p>
          </div>

          {!isMobile && <Image src={chainon} alt="" width={chanonSize} height={chanonSize} className="mx-4" />}

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <span className={checkedNumberClass}>
                {totalFollowed}
              </span>
              <FaCheck className={`text-[#6fce97] ${iconSize}`} />
            </div>
            <p className={textClass}>
              {t('stats.alreadyTransferred')}
            </p>
          </div>

          {stats.connections.totalEffectiveFollowers > 0 && (
            <>
              {!isMobile && <Image src={chainon} alt="" width={chanonSize} height={chanonSize} className="mx-4" />}
              
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <span className={followersNumberClass}>
                    {stats.connections.totalEffectiveFollowers}
                  </span>
                  <FaUsers className={`text-[#d6356f] ${iconSize}`} />
                </div>
                <p className={textClass}>
                  {t('stats.effectiveFollowers')}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
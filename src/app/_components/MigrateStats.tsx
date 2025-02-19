'use client';

import { useTranslations } from 'next-intl';
import { FaCheck } from "react-icons/fa";
import Image from 'next/image';
import { plex, caveat } from '@/app/fonts/plex';
import arrowGrowth from '../../../public/v2/uil_arrow-growth.svg';
import chainon from '../../../public/v2/chainon.svg';

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

  console.log("stats from MigrateStats", stats)

  if (!stats) return null;

  const totalToFollow = 
    (session.user.bluesky_username ? stats.matches.bluesky.notFollowed : 0) + 
    (session.user.mastodon_username ? stats.matches.mastodon.notFollowed : 0);
    
  const totalFollowed = 
    (session.user.bluesky_username ? stats.matches.bluesky.hasFollowed : 0) + 
    (session.user.mastodon_username ? stats.matches.mastodon.hasFollowed : 0);

  return (
    <div className="w-full mt-[250px] bg-[#2a39a9]">
      <h1 className={`${caveat.className} text-[5rem] text-[#d6356f] z-[15] text-center font-bold`}>
        {t('title')}
      </h1>

      {!simpleView && (
        <div className="flex items-center justify-center gap-2">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <span className={`${plex.className} text-[80px] text-[#66D9E8] font-bold`}>
                {totalToFollow}
              </span>
              <Image src={arrowGrowth} alt="" width={30} height={30} />
            </div>
            <p className={`${plex.className} text-white text-center text-sm mt-2 max-w-[250px] whitespace-pre-line`}>
              {t('stats.awaitingConnection')}
            </p>
          </div>

          <Image src={chainon} alt="" width={100} height={100} className="mx-4" />

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <span className={`${plex.className} text-[80px] text-[#6fce97] font-bold`}>
                {totalFollowed}
              </span>
              <FaCheck className="text-[#6fce97] text-3xl" />
            </div>
            <p className={`${plex.className} text-white text-center text-sm mt-2 max-w-[250px] whitespace-pre-line`}>
              {t('stats.alreadyTransferred')}
            </p>
          </div>

          {stats.connections.totalEffectiveFollowers > 0 && (
            <>
              <Image src={chainon} alt="" width={100} height={100} className="mx-4" />
              
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <span className={`${plex.className} text-[80px] text-[#ffd700] font-bold`}>
                    {stats.connections.totalEffectiveFollowers}
                  </span>
                  <FaCheck className="text-[#ffd700] text-3xl" />
                </div>
                <p className={`${plex.className} text-white text-center text-sm mt-2 max-w-[250px] whitespace-pre-line`}>
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
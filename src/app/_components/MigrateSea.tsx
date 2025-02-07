'use client';

import Image from 'next/image';
import { plex, caveat } from '@/app/fonts/plex';
import localFont from 'next/font/local';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FaCheck } from "react-icons/fa";

import logo from '../../../public/logo/logo-openport-rose.svg';
import seaBackground from '../../../public/sea.svg';
import arrowGrowth from '../../../public/v2/uil_arrow-growth.svg';
import chainon from '../../../public/v2/chainon.svg';
import Boat from './Boat';

const syneTactile = localFont({
  src: '../fonts/SyneTactile-Regular.ttf',
  display: 'swap',
});

interface SeaProps {
  stats?: {
    total_following: number;
    matched_following: number;
    bluesky_matches: number;
    mastodon_matches: number;
  } | null;
}

interface MigrateStatsProps {
  stats: {
    total_following: number;
    matched_following: number;
    bluesky_matches: number;
    mastodon_matches: number;
  };
}

function MigrateStats({ stats }: MigrateStatsProps) {
  const t = useTranslations('migrateSea');

  return (
    <div className="w-full mt-[250px] bg-[#2a39a9]">
      <h1 className={`${syneTactile.className} text-[5rem] text-[#d6356f] z-[15] text-center font-bold`}>
        {t('title')}
      </h1>

      <div className="flex items-center justify-center gap-2 ">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className={`${plex.className} text-[80px] text-[#66D9E8] font-bold`}>
              {stats.total_following}
            </span>
            <Image src={arrowGrowth} alt="" width={30} height={30} />
          </div>
          <p className={`${plex.className} text-white text-center text-sm mt-2 max-w-[250px]`}>
            {t('stats.awaitingConnection')}
          </p>
        </div>

        <Image src={chainon} alt="" width={100} height={100} className="mx-4" />

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className={`${plex.className} text-[80px] text-[#6fce97] font-bold`}>
              {stats.matched_following}
            </span>
            <FaCheck className="text-[#6fce97] text-3xl" />
          </div>
          <p className={`${plex.className} text-white text-center text-sm mt-2 max-w-[250px]`}>
            {t('stats.alreadyTransferred')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MigrateSea({ stats }: SeaProps) {
  const t = useTranslations('migrateSea');
  const params = useParams();

  const Boats = () => {
    return (
      <>
        <Boat model={3} top={140} left={40} scale={2} zindex={20} />
        <Boat model={2} top={180} left={15} scale={1.2} zindex={20} />
        <Boat model={4} top={170} left={75} scale={1.2} zindex={20} />
      </>
    );
  };

  return (
    <div className="absolute top-0 left-0 w-full bg-[#2a39a9]">
      <div className="relative h-[23rem] bg-[#2a39a9]">
        <Image src={seaBackground} fill alt="" className="object-cover" />
        <div className="relative z-[5] ">
          <Image
            src={logo}
            alt="OpenPortability Logo"
            width={306}
            height={125}
            className="mx-auto"
          />
          <div className="w-full ">
            <Boats />
          </div>
        </div>
        {stats && <MigrateStats stats={stats} />}
      </div>
    </div>
  );
}
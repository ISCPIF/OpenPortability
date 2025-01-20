'use client';

import Image from 'next/image';
import { plex, caveat } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FaCheck } from "react-icons/fa";

import logoHQXFR from '../../../public/logoxHQX/HQX-rose-FR.svg';
import logoHQXEN from '../../../public/logoxHQX/HQX-pink-UK.svg';
import seaBackground from '../../../public/sea.svg';
import arrowGrowth from '../../../public/v2/uil_arrow-growth.svg';
import chainon from '../../../public/v2/chainon.svg';
import Boat from './Boat';

interface SeaProps {
  stats?: {
    total_following: number;
    matched_following: number;
    bluesky_matches: number;
    mastodon_matches: number;
  } | null;
}

export default function MigrateSea({ stats }: SeaProps) {
  const t = useTranslations('migrateSea');
  const params = useParams();
  const locale = params.locale as string;
  const logoHQX = locale === 'fr' ? logoHQXFR : logoHQXEN;

  const Boats = () => {
    return (
      <>
        {/* Bateau principal au centre avec drapeau */}
        <Boat model={3} top={140} left={40} scale={2} zindex={1} />
        
        {/* Petit bateau à gauche avec drapeau */}
        <Boat model={2} top={190} left={15} scale={1.2} zindex={1} />
        
        {/* Petit bateau à droite avec drapeau */}
        <Boat model={4} top={210} left={75} scale={1.2} zindex={1} />
      </>
    );
  };


  return (
    <div className="absolute top-0 left-0 w-full bg-[#2a39a9]">
      <div className="relative h-[23rem] bg-[#2a39a9]">
        <Image src={seaBackground} fill alt="" className="object-cover "></Image>
      
        <div className="relative z-[5] ">
        <Image
            src={logoHQX}
            alt="HelloQuitteX"
            width={306}
            height={125}
            className="mx-auto"
          />
        
        <div className="w-full ">
          <Boats />
          </div>
        </div>
        
        <div className="w-full mt-[250px] bg-[#2a39a9]">
          <h1 className={`${caveat.className} text-[5rem] text-[#d6356f] z-[15] text-center font-bold`}>
            {t('title')}
          </h1>

          {stats && (
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
          )}
        </div>
      </div>
    </div>
  );
}
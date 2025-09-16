'use client';

import Image from 'next/image';
import { plex, caveat } from '@/app/fonts/plex';
import localFont from 'next/font/local';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FaCheck } from "react-icons/fa";
import { useState, useEffect } from 'react';

import logo from '../../../../public/logo/logo-openport-rose.svg';
import seaBackground from '../../../../public/sea.svg';
import arrowGrowth from '../../../../public/v2/uil_arrow-growth.svg';
import chainon from '../../../../public/v2/chainon.svg';
import Boat from './Boat';

const syneTactile = localFont({
  src: '../../fonts/SyneTactile-Regular.ttf',
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
  const isMobile = useIsMobile();

  const Boats = () => {
    return (
      <>
        <Boat model={3} top={100} left={40} scale={2} zindex={20} />
        <Boat model={2} top={110} left={60} scale={1.2} zindex={20} />
        {/* <Boat model={4} top={130} left={77} scale={1.2} zindex={20} /> */}
        <Boat model={1} top={90} left={25} scale={1.2} zindex={20} />
        {/* <Boat model={6} top={140} left={100} scale={1.2} zindex={20} /> */}
        {/* <Boat model={7} top={130} left={10} scale={1.2} zindex={20} /> */}
      </>
    );
  };

  return (
    <div className={`absolute top-0 left-0 w-full ${isMobile ? 'h-[11rem]' : 'h-[23rem]'}`}>
      {/* Container pour l'arrière-plan répété */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        {/* Ajout d'un conteneur pour gérer le motif répété */}
        <div className="w-full h-full">
          {/* Répéter l'image plusieurs fois - style inline pour éliminer tout espace */}
          <div className="sea-bg-repeat h-full flex flex-nowrap" style={{ fontSize: 0 }}>
            <Image src={seaBackground} alt="" height={isMobile ? 176 : 368} width={800} className="block" style={{ margin: 0, padding: 0 }} />
            <Image src={seaBackground} alt="" height={isMobile ? 176 : 368} width={800} className="block" style={{ margin: 0, padding: 0 }} />
            <Image src={seaBackground} alt="" height={isMobile ? 176 : 368} width={800} className="block" style={{ margin: 0, padding: 0 }} />
            {/* <Image src={seaBackground} alt="" height={isMobile ? 176 : 368} width={600} className="block" style={{ margin: 0, padding: 0 }} /> */}
            {/* <Image src={seaBackground} alt="" height={isMobile ? 176 : 368} width={400} className="block" style={{ margin: 0, padding: 0 }} /> */}
          </div>
        </div>
      </div>
      
      {/* Modifier le padding-top en fonction du type d'appareil */}
      <div className={`relative z-[5] ${isMobile ? 'flex items-center justify-center h-full' : 'pt-12'}`}>
        <div className="relative z-[5]">
          <Image
            src={logo}
            alt="OpenPortability Logo"
            width={306}
            height={125}
            className="mx-auto"
          />
          <div className="w-max">
            {/* N'afficher les bateaux que sur les écrans non-mobiles */}
            {!isMobile && <Boats />}
          </div>
        </div>
        {/* {stats && <MigrateStats stats={stats} />} */}
      </div>
    </div>
  );
}
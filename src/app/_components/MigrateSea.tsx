'use client';

import Image from 'next/image';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

import logoHQXFR from '../../../public/logoxHQX/HQX-rose-FR.svg';
import logoHQXEN from '../../../public/logoxHQX/HQX-pink-UK.svg';
import seaBackground from '../../../public/sea.svg';
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
        <Boat model={1} top={45} left={46.5} scale={1.5} zindex={1} />
        
        {/* Petit bateau à gauche avec drapeau */}
        <Boat model={2} top={55} left={15} scale={1.2} zindex={1} />
        
        {/* Petit bateau à droite avec drapeau */}
        <Boat model={4} top={50} left={75} scale={1.2} zindex={1} />
      </>
    );
  };

  console.log("Stats from MigrateSea:", stats);

  return (
    <div className="absolute top-0 left-0 w-full h-[23rem]">
      <Image 
        src={seaBackground} 
        fill 
        alt="" 
        className="object-cover" 
        style={{ transform: 'translateY(-10%)' }}
      />
      <div className="relative z-[5] flex flex-col items-center pt-12">
        <Image
          src={logoHQX}
          alt={t('logo.alt')}
          width={306}
          height={125}
          className="mx-auto relative z-[10]"
        />
        
        <div className="absolute inset-0 w-full" style={{ transform: 'translateY(-10%)' }}>
          <Boats />
        </div>

        <div className="w-full flex flex-col items-center relative z-[10] mt-12">
          <h1 className={`${plex.className} text-3xl text-center mt-4 text-[#FF3366] font-bold`}>
            {t('title')}
          </h1>

          {stats && (
            <div className="mt-4 bg-[#1A237E] bg-opacity-40 rounded-lg p-4 text-white text-center max-w-2xl mx-auto">
              <p className={`${plex.className} mb-2`}>
                {t('matchMessage', { 
                  matchCount: stats.matched_following,
                  total_following: stats.total_following
                })}
              </p>
              <div className="flex justify-center gap-6 mt-2">
                <p className={`${plex.className}`}>
                  {t('matchDetails.bluesky', { count: stats.bluesky_matches })}
                </p>
                <p className={`${plex.className}`}>
                  {t('matchDetails.mastodon', { count: stats.mastodon_matches })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { plex } from '@/app/fonts/plex';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import seaBackground from '../../../public/sea-wave.svg';
import Boat from './Boat';
import logo from '../../../public/logo/logo-openport-blanc.svg';
import { useState, useEffect } from 'react';

interface SeaProps {
  progress: number;
}

export default function LoginSea() {
  const t = useTranslations('signin');
  const params = useParams();
  const pathname = usePathname();
  const { data: session } = useSession();

  const isSigninPage = pathname.includes('/auth/signin');
  const isDashboardPage = pathname.includes('/dashboard');
  const isSettingsPage = pathname.includes('/settings');

  // Determine if mobile based on client-side rendering
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  console.log("Session -->", session)

  return (
    <div className={`relative w-full ${isSettingsPage ? 'h-[350px]' : 'h-[350px] sm:h-[350px] md:h-[400px] lg:h-[450px]'} ${isDashboardPage ? 'mb-0 sm:mb-8 md:mb-12 lg:mb-16' : ''}`}>
      {/* Container pour l'arrière-plan répété */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        {/* Ajout d'un conteneur pour gérer le motif répété */}
        <div className="w-full h-full">
          {/* Répéter l'image plusieurs fois - style inline pour éliminer tout espace */}
          <div className="sea-bg-repeat h-full flex flex-nowrap" style={{ fontSize: 0 }}>
            <Image src={seaBackground} alt="" height={isMobile ? 300 : 450} width={800} className="block" style={{ margin: 0, padding: 0 }} priority />
            <Image src={seaBackground} alt="" height={isMobile ? 300 : 450} width={800} className="block" style={{ margin: 0, padding: 0 }} />
            <Image src={seaBackground} alt="" height={isMobile ? 300 : 450} width={800} className="block" style={{ margin: 0, padding: 0 }} />
            <Image src={seaBackground} alt="" height={isMobile ? 300 : 450} width={800} className="block" style={{ margin: 0, padding: 0 }} />
            <Image src={seaBackground} alt="" height={isMobile ? 300 : 450} width={800} className="block" style={{ margin: 0, padding: 0 }} />
            <Image src={seaBackground} alt="" height={isMobile ? 300 : 450} width={800} className="block" style={{ margin: 0, padding: 0 }} />
          </div>
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center pt-8 px-4 text-center">
        <Image
          src={logo}
          alt={t('logo.alt')}
          width={200}
          height={82}
          className="mx-auto sm:w-[250px] md:w-[306px]"
        />
        {!isSettingsPage && (
          <h1 className={`${plex.className} text-2xl lg:text-3xl mt-4`}>{t('title')}</h1>

        )}
        {/* <h1 className={`${plex.className} text-2xl lg:text-3xl mt-4`}>{t('title')}</h1> */}
        {!session?.user.has_onboarded && !isSettingsPage && (
          <p className={`${plex.className} text-lg lg:text-xl my-4 lg:my-6 max-w-md`}>
            {isSigninPage 
              ? t('subtitle') 
              : session?.user?.twitter_id 
                ? t('embark')
                : t('embarkOrLogin')
            }
          </p>
        )}
        {isDashboardPage && session?.user && !session.user.has_onboarded && !isSettingsPage && (
          <p className={`${plex.className} text-lg lg:text-xl mt-4 max-w-md`}>
            <span className="font-extrabold text-white">{t('welcome')}</span>{' '}
            <span className="font-extrabold text-[#d6356f]">
              @{session.user.twitter_username || session.user.bluesky_username || session.user.mastodon_username}
            </span>
          </p>
        )}
      </div>
      <Boat model={5} top={60} left={30} scale={0.7} />
    </div>
  );
}

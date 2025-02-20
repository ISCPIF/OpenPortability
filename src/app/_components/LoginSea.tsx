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

  console.log("Session -->", session)

  return (
    <div className="absolute top-0 left-0 w-full">
      <Image src={seaBackground} fill alt="" className="object-cover"></Image>
      <Image
        src={logo}
        alt={t('logo.alt')}
        width={306}
        height={125}
        className="mx-auto mt-8 relative"
      />
      <div className="relative z-10">
        <h1 className={`${plex.className} text-2xl lg:text-3xl`}>{t('title')}</h1>
        {!session?.user.has_onboarded && (
          <p className={`${plex.className} text-lg lg:text-xl my-8 lg:my-10 p-4`}>
            {isSigninPage 
              ? t('subtitle') 
              : session?.user?.twitter_id 
                ? t('embark')
                : t('embarkOrLogin')
            }
          </p>
        )}
        {isDashboardPage && session?.user && !session.user.has_onboarded && (
          <p className={`${plex.className} text-lg lg:text-xl mt-4`}>
            <span className="font-extrabold text-white">{t('welcome')}</span>{' '}
            <span className="font-extrabold text-[#d6356f]">
              @{session.user.twitter_username || session.user.bluesky_username || session.user.mastodon_username}
            </span>
          </p>
        )}
      </div>
      <Boat model={5} top={66} left={30} scale={0.7} />
    </div>
  );
}

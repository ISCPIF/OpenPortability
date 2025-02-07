'use client';

import Image from 'next/image';

import { plex } from '@/app/fonts/plex';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import seaBackground from '../../../public/sea-wave.svg';
import Boat from './Boat';
import logo from '../../../public/logo/logo-openport-blanc.svg';
;

interface SeaProps {
  progress: number;
}

export default function LoginSea() {
  const t = useTranslations('signin');
  const params = useParams();
  return (
    <div className="absolute top-0 left-0 w-full h-[35rem]">
      <Image src={seaBackground} fill alt="" className="object-cover"></Image>
      <Image
        src={logo}
        alt={t('logo.alt')}
        width={306}
        height={125}
        className="mx-auto lg:mt-8 relative"
      />
      <Boat model={6} top={66} left={30} scale={0.7} />
    </div>
  );
}

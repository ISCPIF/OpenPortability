'use client';

import Image from 'next/image';

import { plex } from '@/app/fonts/plex';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import seaBackground from '../../../public/sea-wave.svg';
import Boat from './Boat';
import logoHQXFR from '../../../public/logoxHQX/HQX-blanc-FR.svg';
import logoHQXEN from '../../../public/logoxHQX/HQX-white-UK.svg';
import logoCNRS from "../../../public/logo-cnrs-blanc.svg"

interface SeaProps {
  progress: number;
}

export default function LoginSea() {
  const t = useTranslations('signin');
  const params = useParams();
  const locale = params.locale as string;
  const logoHQX = locale === 'fr' ? logoHQXFR : logoHQXEN;
  return (
    <div className="absolute top-0 left-0 w-full h-[35rem]">
      <Image src={seaBackground} fill alt="" className="object-cover"></Image>
      <Image
        src={logoCNRS}
        alt={t('logoCNRS.alt')}
        width={60}
        height={60}
        className="absolute top-4 left-4"
      />
      <Image
        src={logoHQX}
        alt={t('logo.alt')}
        width={306}
        height={125}
        className="mx-auto lg:mt-8 relative"
      />
      <Boat model={1} top={66} left={30} scale={0.7} />
    </div>
  );
}

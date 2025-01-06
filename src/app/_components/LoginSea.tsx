'use client';

import Image from 'next/image';

import { plex } from '@/app/fonts/plex';
import { useParams } from 'next/navigation';
// import logoHQX from '../../../public/logoxHQX/HQX-blanc-FR.svg'
import seaBackground from '../../../public/sea-wave.svg';
import Boat from './Boat';
import logoHQXFR from '../../../public/logoxHQX/HQX-rose-FR.svg';
import logoHQXEN from '../../../public/logoxHQX/HQX-pink-UK.svg';
interface SeaProps {
  progress: number;
}

export default function LoginSea() {
  const params = useParams();
  const locale = params.locale as string;
  const logoHQX = locale === 'fr' ? logoHQXFR : logoHQXEN;
  return (
    <div className="absolute top-0 left-0 w-full h-[35rem]">
      <Image src={seaBackground} fill alt="" className="object-cover"></Image>
      <Image
        src={logoHQX}
        alt=""
        width={306}
        height={125}
        className="mx-auto lg:mt-8 relative"
      />
      <Boat model={1} top={66} left={30} scale={0.7} />
    </div>
  );
}

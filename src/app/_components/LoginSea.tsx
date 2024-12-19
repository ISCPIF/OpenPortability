'use client';

import Image from 'next/image';

import { plex } from '@/app/fonts/plex';

import logoHQX from '../../../public/logo-bg-bleu.svg'
import seaBackground from '../../../public/sea-wave.svg';
import Boat from './Boat';

import progress0 from '../../../public/progress/progress-0.svg';
import progress25 from '../../../public/progress/progress-25.svg';
import progress50 from '../../../public/progress/progress-50.svg';
import progress75 from '../../../public/progress/progress-75.svg';
import progress100 from '../../../public/progress/progress-100.svg';

interface SeaProps {
  progress: number;
}

export default function LoginSea() {

  return (
    <div className="absolute top-0 w-full h-[35rem]">
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

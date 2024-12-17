'use client'

import Image from 'next/image'

import { plex } from '@/app/fonts/plex';

import logoHQX from '../../../public/BannerHQX-rose_FR.svg'
import seaBackground from '../../../public/sea.svg'
import Boat from './Boat';

// import progress0 from '../../../public/progress/progress-0.svg'
import progress25 from '../../../public/progress/progress-25.svg'
import progress50 from '../../../public/progress/progress-50.svg'
import progress75 from '../../../public/progress/progress-75.svg'
import progress100 from '../../../public/progress/progress-100.svg'


interface SeaProps {
  step: number;
}


export default function Sea({
  step
}: SeaProps) {

  const getProgressImage = (step: number) => {
    // if (step <= 0) return progress0;
    if (step <= 25) return progress25;
    if (step <= 50) return progress50;
    if (step <= 75) return progress75;
    if (step <= 100) return progress100;
    return progress25;
  };


  return (
    <div className="absolute top-0 w-full h-[35rem]">
      <Image src={seaBackground} fill alt="" className="object-cover"></Image>
      <Image
        src={logoHQX}
        alt="HelloQuitteX Logo"
        width={306}
        height={125}
        className="mx-auto lg:mt-8 relative"
      />
      <div className="container flex flex-col mx-auto text-center gap-y-4 px-6 lg:gap-y-8 text-[#282729] relative my-8 lg:my-14 max-w-[50rem]">
        <h1 className={`${plex.className} text-2xl lg:text-3xl font-light`}>Bienvenue à bord d’HelloQuitteX !</h1>
      </div>
      <Boat model={1} />
      <Image src={getProgressImage(step)} width={80} height={82} alt="" className="absolute top-[87%] left-[48%]"></Image>
    </div>
  );
}

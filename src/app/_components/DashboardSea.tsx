'use client';

import Image from 'next/image';

import { plex } from '@/app/fonts/plex';

import logoHQX from '../../../public/BannerHQX-rose_FR.svg';
import seaBackground from '../../../public/sea.svg';
import Boat from './Boat';

import progress0 from '../../../public/progress/progress-0.svg';
import progress25 from '../../../public/progress/progress-25.svg';
import progress50 from '../../../public/progress/progress-50.svg';
import progress75 from '../../../public/progress/progress-75.svg';
import progress100 from '../../../public/progress/progress-100.svg';

interface SeaProps {
  progress: number;
}

export default function Sea({ progress }: SeaProps) {
  const ProgressImage = ({ progress }: { progress: number }) => {
    let img;
    let scale = 1;
    let left = 48;
    let top = 87;
    if (progress === 0) {
      img = progress0;
    } else if (progress <= 25) {
      img = progress25;
    } else if (progress <= 50) {
      img = progress50;
    } else if (progress <= 75) {
      img = progress75;
    } else if (progress <= 100) {
      img = progress100;
      scale = 1.5;
      left = 47;
      top = 80;
    }

    return (
      <Image
        src={img}
        width={80 * scale}
        height={82 * scale}
        alt=""
        className="absolute"
        style={{ left: `${left}%`, top: `${top}%`, zIndex: 40 }}
      ></Image>
    );
  };

  const Boats = ({ progress }: { progress: number }) => {
    if (progress === 0)
      return (
        <>
          <Boat model={1} top={65} left={46.5} />
        </>
      );
    if (progress <= 25)
      return (
        <>
          <Boat model={1} top={65} left={46.5} />
          <Boat model={2} top={85} left={6.5} scale={1.2} />
        </>
      );
    if (progress <= 50)
      return (
        <>
          <Boat model={1} top={65} left={46.5} scale={1} />
          <Boat model={2} top={85} left={6.5} scale={1.2} />
          <Boat model={4} top={80} left={66.5} scale={1.5} />
        </>
      );
    if (progress <= 75)
      return (
        <>
          <Boat model={1} top={65} left={46.5} scale={1} />
          <Boat model={2} top={85} left={6.5} scale={1.2} zindex={10} />
          <Boat model={3} top={75} left={26.5} scale={1.2} />
          <Boat model={4} top={80} left={66.5} scale={1.5} />
        </>
      );
    if (progress <= 100)
      return (
        <>
          <Boat model={1} top={61} left={45} scale={1.5} />
          <Boat model={2} top={85} left={6.5} scale={1.2} zindex={10} />
          <Boat model={3} top={75} left={26.5} scale={1.2} />
          <Boat model={4} top={80} left={66.5} scale={1.5} />
          <Boat model={8} top={90} left={86.5} scale={2} />
        </>
      );
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
        <h1 className={`${plex.className} text-2xl lg:text-3xl font-light`}>
          Bienvenue à bord d’HelloQuitteX !
        </h1>
      </div>
      <Boats progress={progress} />
      <ProgressImage progress={progress} />
    </div>
  );
}

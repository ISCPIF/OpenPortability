'use client';

import { useState } from "react"
import Image from 'next/image';
import { motion, AnimatePresence } from "framer-motion"

import { plex } from '@/app/fonts/plex';

import compass from '../../../public/compass/loader-compass.svg';
import needle from '../../../public/compass/needle.svg';

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface LoadingIndicatorProps {
  msg: string;
  textSize?: 'sm' | 'base';
}

export default function LoadingIndicator({ msg, textSize = 'sm' }: LoadingIndicatorProps) {
  const [nextAngle, setNextAngle] = useState(0);
  return (
    <div className="w-60 h-56 p-10 text-center bg-white rounded-[30px] flex flex-col z-10 relative">
      <div className="m-auto">
        <Image
          src={compass}
          alt=""
          width={85}
          height={87}
          className=""
        />
        <motion.div
          className="h-fit w-fit"
          style={{
            originX: 0.49,
            originY: 0.48,
            position: "relative",
            top: "-53px",
            left: "22px"
          }}
          transition={{
            delay: randomRange(0.5, 1),
            visualDuration: randomRange(0.3, 0.5),
            type: "spring",
            bounce: randomRange(0.5, 0.8),
            ease: 'linear',
          }}
          animate={{ rotateZ: nextAngle }}
          exit={{ rotateZ: 0 }}
          onAnimationComplete={() => {
            setNextAngle(Math.random() * 360);
          }}
        >
          <Image
            src={needle}
            alt=""
            width={42}
            height={19}
            style={{}}
            className="relative"
          />
        </motion.div>
      </div>
      <p className={`${plex.className} text-[#2A39A9] font-bold text-${textSize} ${textSize === 'base' ? 'max-w-[200px] mx-auto' : ''}`}>
        {msg}
      </p>
    </div>
  );
}
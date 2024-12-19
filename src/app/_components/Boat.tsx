'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

import boat1 from '../../../public/boats/boat-1.svg';
import boat2 from '../../../public/boats/boat-2.svg';
import boat3 from '../../../public/boats/boat-3.svg';
import boat4 from '../../../public/boats/boat-4.svg';
import boat5 from '../../../public/boats/boat-5.svg';
import boat6 from '../../../public/boats/boat-6.svg';
import boat7 from '../../../public/boats/boat-7.svg';
import boat8 from '../../../public/boats/boat-8.svg';
import boat9 from '../../../public/boats/boat-9.svg';
import boat10 from '../../../public/boats/boat-10.svg';
import boat11 from '../../../public/boats/boat-11.svg';
import boat12 from '../../../public/boats/boat-12.svg';
import boat13 from '../../../public/boats/boat-13.svg';

interface BoatProps {
  model: number;
  top: number;
  left: number;
  scale?: number;
  zindex?: number;
}

//  Power law distribution
function rndm(a: number, b: number, g: number) {
  const r = Math.random();
  const ag = a ** g;
  const bg = b ** g;
  return (ag + (bg - ag) * r) ** (1 / g);
}

export default function Boat({
  model,
  top,
  left,
  scale = 1,
  zindex = 1,
}: BoatProps) {
  const animationLength = 10;
  const startSign = Math.random() < 0.5 ? -1 : 1

  const getBoatImage = (model: number) => {
    switch (model) {
      case 1:
        return boat1;
      case 2:
        return boat2;
      case 3:
        return boat3;
      case 4:
        return boat4;
      case 5:
        return boat5;
      case 6:
        return boat6;
      case 7:
        return boat7;
      case 8:
        return boat8;
      case 9:
        return boat9;
      case 10:
        return boat10;
      case 11:
        return boat11;
      case 12:
        return boat12;
      case 13:
        return boat13;
    }
  };

  const getDurationsValues = (len: number) => {
    const arr = new Array(len).fill(undefined);
    const values = arr.map((_item, idx) => {
      if (idx === 0) return 0;
      if (idx === len - 1) return 1;
      return idx / len + (rndm(0, 2, 1) - 1) / (5 * len);
    });
    console.log(values);
    return values;
  };

  const getRotationValues = (len: number) => {
    const arr = new Array(len).fill(undefined);
    const values = arr.map((_item, idx) => {
      const sign = idx % 2 === 0 ? 1 : -1;
      return `${startSign * sign * rndm(0.5, 5, 0.5)}deg`;
    });
    return values;
  };

  return (
    <motion.div
      className="absolute"
      style={{
        originX: 0.5,
        originY: 1,
        top: `${top}%`,
        left: `${left}%`,
        zIndex: zindex,
      }}
      transition={{
        repeatType: 'reverse',
        repeat: Infinity,
        duration: 2 * animationLength,
        delay: Math.random(),
        times: getDurationsValues(animationLength),
        ease: 'linear',
      }}
      animate={{ rotateZ: getRotationValues(animationLength) }}
      exit={{ rotateZ: 0 }}
    >
      <Image
        src={getBoatImage(model)}
        width={110 * scale}
        height={88 * scale}
        alt=""
        className=""
      ></Image>
    </motion.div>
  );
}

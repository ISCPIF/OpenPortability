'use client'

import Image from 'next/image'
import { motion } from 'framer-motion';

import boat1 from '../../../public/boats/boat-1.svg'

interface BoatProps {
  model: number;
}


export default function Boat({
  model
}: BoatProps) {

  const getBoatImage = (model: number) => {
    return boat1;
  };



  return (
    <motion.div className="absolute top-[65%] left-[46.5%]" style={{ originX: 0.5, originY: 1 }}
      transition={{
        repeatType: 'reverse',
        repeat: Infinity,
        duration: 2,
        ease: "linear"
      }}
      initial={{ rotateZ: "-5deg" }}
      animate={{ rotateZ: "5deg" }}
      exit={{ rotateZ: 0 }}
    >
      <Image src={boat1} width={110} height={88} alt="" className=""></Image>
    </motion.div>

  );
}

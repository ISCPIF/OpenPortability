// 'use client';

// import Image from 'next/image';
// import { usePathname } from 'next/navigation';
// import { plex } from '@/app/fonts/plex';
// import { useParams } from 'next/navigation';
// import { useTranslations } from 'next-intl';
// import { useSession } from 'next-auth/react';
// import logo from '../../../public/logo/logo-openport-blanc.svg';
// import { useState, useEffect, useCallback } from 'react';
// import Particles from "react-tsparticles";
// import { loadSlim } from "tsparticles-slim";
// import type { Container, Engine } from "tsparticles-engine";

// interface Node {
//   id: string;
//   label: string;
//   x: number;
//   y: number;
//   size: number;
//   color: string;
//   community: number;
//   degree: number;
// }

// interface NodesSeaProps {
//   nodes?: Node[];
//   showLogo?: boolean;
//   showTitle?: boolean;
//   height?: string;
// }

// // Données d'exemple avec 100 nodes
// const defaultNodes: Node[] = Array.from({ length: 10000 }, (_, i) => ({
//   id: `node_${i}`,
//   label: `@user_${i}`,
//   x: Math.random() * 15000,
//   y: Math.random() * 8000 - 4000,
//   size: 0.2 + Math.random() * 0.3,
//   color: [
//     "#F7DC6F", "#85C1E9", "#F8C471", "#82E0AA", 
//     "#D7BDE2", "#F1948A", "#AED6F1", "#A9DFBF"
//   ][Math.floor(Math.random() * 8)],
//   community: Math.floor(Math.random() * 10),
//   degree: Math.floor(Math.random() * 500)
// }));

// // Fonction pour créer des positions en forme de lettres
// const createLetterPositions = (letter: string, containerWidth: number = 800, containerHeight: number = 600) => {
//   const positions: { x: number; y: number }[] = [];
//   const centerX = containerWidth / 2;
//   const centerY = containerHeight / 2;
//   const scale = 80; // Échelle pour la taille de la lettre

//   switch (letter.toUpperCase()) {
//     case 'O':
//       // Créer un cercle pour la lettre O
//       for (let i = 0; i < 40; i++) {
//         const angle = (i / 40) * 2 * Math.PI;
//         positions.push({
//           x: centerX + Math.cos(angle) * scale,
//           y: centerY + Math.sin(angle) * scale
//         });
//       }
//       break;
    
//     case 'P':
//       // Ligne verticale gauche
//       for (let i = 0; i < 25; i++) {
//         positions.push({
//           x: centerX - scale,
//           y: centerY - scale + (i * scale * 2 / 25)
//         });
//       }
//       // Ligne horizontale du haut
//       for (let i = 0; i < 12; i++) {
//         positions.push({
//           x: centerX - scale + (i * scale * 0.8 / 12),
//           y: centerY - scale
//         });
//       }
//       // Ligne horizontale du milieu
//       for (let i = 0; i < 10; i++) {
//         positions.push({
//           x: centerX - scale + (i * scale * 0.6 / 10),
//           y: centerY - scale * 0.2
//         });
//       }
//       // Ligne verticale droite (partie haute)
//       for (let i = 0; i < 10; i++) {
//         positions.push({
//           x: centerX - scale * 0.2,
//           y: centerY - scale + (i * scale * 0.8 / 10)
//         });
//       }
//       break;

//     case 'H':
//       // Ligne verticale gauche
//       for (let i = 0; i < 20; i++) {
//         positions.push({
//           x: centerX - scale,
//           y: centerY - scale + (i * scale * 2 / 20)
//         });
//       }
//       // Ligne verticale droite
//       for (let i = 0; i < 20; i++) {
//         positions.push({
//           x: centerX + scale,
//           y: centerY - scale + (i * scale * 2 / 20)
//         });
//       }
//       // Ligne horizontale du milieu
//       for (let i = 0; i < 15; i++) {
//         positions.push({
//           x: centerX - scale + (i * scale * 2 / 15),
//           y: centerY
//         });
//       }
//       break;

//     default:
//       // Position par défaut (grille)
//       for (let i = 0; i < 30; i++) {
//         const angle = (i / 30) * 2 * Math.PI;
//         positions.push({
//           x: centerX + Math.cos(angle) * scale,
//           y: centerY + Math.sin(angle) * scale
//         });
//       }
//   }

//   return positions;
// };

// export default function NodesSea({ 
//   nodes = defaultNodes, 
//   showLogo = true, 
//   showTitle = true,
//   height = 'h-[450px]',
//   letterShape = 'O' // Nouvelle prop pour définir la forme de lettre
// }: NodesSeaProps & { letterShape?: string }) {
//   const t = useTranslations('signin');
//   const params = useParams();
//   const pathname = usePathname();
//   const { data: session } = useSession();

//   const [isMobile, setIsMobile] = useState(false);

//   console.log("coucou")

//   useEffect(() => {
//     const checkIsMobile = () => {
//       setIsMobile(window.innerWidth < 640);
//     };
    
//     checkIsMobile();
//     window.addEventListener('resize', checkIsMobile);
//     return () => window.removeEventListener('resize', checkIsMobile);
//   }, []);

//   const particlesInit = useCallback(async (engine: Engine) => {
//     await loadSlim(engine);
//   }, []);

//   const particlesLoaded = useCallback(async (container: Container | undefined) => {
//     if (container) {
//       const letterPositions = createLetterPositions(
//         letterShape || 'O', 
//         container.canvas.size.width, 
//         container.canvas.size.height
//       );
      
//       // Attendre que les particules soient initialisées
//       setTimeout(() => {
//         const particles = container.particles.array;
        
//         // Positionner chaque particule selon les positions prédéfinies
//         particles.forEach((particle, index) => {
//           if (index < letterPositions.length) {
//             const pos = letterPositions[index];
//             particle.position.x = pos.x;
//             particle.position.y = pos.y;
            
//             // Réduire la vitesse pour qu'elles bougent lentement
//             particle.velocity.x = (Math.random() - 0.5) * 0.2;
//             particle.velocity.y = (Math.random() - 0.5) * 0.2;
//           }
//         });
        
//         // Redessiner le canvas
//         container.refresh();
//       }, 200);
//     }
//   }, [letterShape]);

//   const letterPositions = createLetterPositions(letterShape || 'O');
  
//   const particlesConfig = {
//     background: {
//       color: {
//         value: "transparent",
//       },
//     },
//     fpsLimit: 120,
//     interactivity: {
//       events: {
//         onClick: {
//           enable: true,
//           mode: "push",
//         },
//         onHover: {
//           enable: true,
//           mode: "repulse",
//         },
//         resize: true,
//       },
//       modes: {
//         push: {
//           quantity: 2,
//         },
//         repulse: {
//           distance: 100,
//           duration: 0.4,
//         },
//       },
//     },
//     particles: {
//       color: {
//         value: ["#F7DC6F", "#85C1E9", "#F8C471", "#82E0AA", "#D7BDE2", "#F1948A", "#AED6F1", "#A9DFBF"],
//       },
//       links: {
//         color: "#ffffff",
//         distance: 120,
//         enable: true,
//         opacity: 0.3,
//         width: 1,
//       },
//       move: {
//         direction: "none" as const,
//         enable: true,
//         outModes: {
//           default: "bounce" as const,
//         },
//         random: true,
//         speed: 0.3, // Vitesse réduite pour un mouvement plus doux
//         straight: false,
//       },
//       number: {
//         density: {
//           enable: false, // Désactiver la densité automatique
//         },
//         value: letterPositions.length, // Utiliser le nombre de positions définies
//       },
//       opacity: {
//         value: 0.8,
//         random: {
//           enable: true,
//           minimumValue: 0.4,
//         },
//         animation: {
//           enable: true,
//           speed: 1,
//           minimumValue: 0.4,
//           sync: false,
//         },
//       },
//       shape: {
//         type: "circle",
//       },
//       size: {
//         value: { min: 8, max: 16 },
//         random: {
//           enable: true,
//           minimumValue: 8,
//         },
//         animation: {
//           enable: true,
//           speed: 2,
//           minimumValue: 3,
//           sync: false,
//         },
//       },
//     },
//     detectRetina: true,
//   };

//   return (
//     <div className={`relative w-full h-[90vh] ${height} bg-[#2a39a9] overflow-hidden`}>
//       {/* Couche des particules */}
//       <Particles
//         id="tsparticles"
//         init={particlesInit}
//         loaded={particlesLoaded}
//         options={particlesConfig}
//         className="absolute inset-0 w-full h-full"
//       />

//       {/* Contenu principal par-dessus */}
//       <div className="relative z-10 flex flex-col items-center pt-8 px-4 text-center">
//         {showLogo && (
//           <Image
//             src={logo}
//             alt={t('logo.alt')}
//             width={200}
//             height={82}
//             className="mx-auto sm:w-[250px] md:w-[306px]"
//           />
//         )}
//         {showTitle && (
//           <h1 className={`${plex.className} text-2xl lg:text-3xl mt-4 text-white`}>
//             Réseau de Connexions
//           </h1>
//         )}
//         <p className={`${plex.className} text-lg lg:text-xl my-4 lg:my-6 max-w-md text-white/90`}>
//           Visualisation interactive de {nodes.length} connexions
//         </p>
//       </div>
//     </div>
//   );
// }
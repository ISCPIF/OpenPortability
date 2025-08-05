// 'use client'

// import React from 'react';
// import { useTranslations } from 'next-intl';

// interface GraphHeaderProps {
//   userDisplayName?: string;
//   currentLocale?: string;
//   onLanguageChange?: (locale: string) => void;
// }

// export function GraphHeader({ 
//   userDisplayName, 
//   currentLocale = 'fr',
//   onLanguageChange 
// }: GraphHeaderProps) {
//   const t = useTranslations('graph');

//   const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
//     if (onLanguageChange) {
//       onLanguageChange(e.target.value);
//     }
//   };

//   return (
//     <header className="fixed top-0 left-0 right-0 z-50 bg-blue-900/10 backdrop-blur-[20px] border-b border-white/10 px-4 md:px-8 py-4">
//       <div className="flex justify-between items-center">
//         {/* Logo */}
//         <a 
//           href="/" 
//           className="text-white text-xl md:text-2xl font-bold hover:text-blue-200 transition-colors duration-200 flex items-center gap-2"
//         >
//           <span className="text-2xl">🚢</span>
//           <span>OpenPortability</span>
//         </a>

//         {/* Navigation Controls */}
//         <nav className="flex items-center gap-3 md:gap-4">
//           {/* Language Selector */}
//           <select
//             value={currentLocale}
//             onChange={handleLanguageChange}
//             className="text-white bg-white/10 border border-white/20 px-3 py-2 rounded-full text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-white/30 hover:bg-white/20 transition-all duration-200"
//           >
//             <option value="fr" className="text-gray-800">🇫🇷 FR</option>
//             <option value="en" className="text-gray-800">🇬🇧 EN</option>
//           </select>

//           {/* User Display */}
//           {userDisplayName && (
//             <span className="text-white/80 text-sm md:text-base hidden sm:block">
//               @{userDisplayName}
//             </span>
//           )}

//           {/* Navigation Link */}
//           <a
//             href="/dashboard"
//             className="text-white/80 hover:text-white text-sm md:text-base px-3 py-2 rounded-full hover:bg-white/10 transition-all duration-200"
//           >
//             {'Dashboard'}
//           </a>
//         </nav>
//       </div>
//     </header>
//   );
// }

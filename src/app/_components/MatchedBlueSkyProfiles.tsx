// 'use client'

// import { motion } from 'framer-motion'
// import { SiBluesky } from "react-icons/si"

// type MatchedProfile = {
//   bluesky_handle: string
// }

// export default function MatchedBlueSkyProfiles({ 
//   profiles 
// }: { 
//   profiles: MatchedProfile[] 
// }) {
//   if (!profiles.length) return (
//     <div className="text-center text-white/60 text-sm">
//       Aucune correspondance BlueSky trouvée
//     </div>
//   )

//   return (
//     <div className="space-y-4">

//       <div className="flex items-center justify-between mb-6">
//       </div>

//       <div className="space-y-3">
//         {profiles.map((profile, index) => (
//           <motion.div
//             key={profile.bluesky_handle}
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.3, delay: index * 0.1 }}
//             className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10"
//           >
//             <div className="flex items-center gap-3">
//               <div className="p-1.5 bg-blue-500/10 rounded-lg">
//                 <SiBluesky className="text-[#0085FF] text-lg" />
//               </div>
              
//               <div className="flex-1 min-w-0">
//                 <p className="text-sm font-medium text-white truncate">
//                   {profile.bluesky_handle}
//                 </p>
//               </div>
//             </div>
//           </motion.div>
//         ))}
//       </div>
//     </div>
//   )
// }
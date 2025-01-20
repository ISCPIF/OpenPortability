// 'use client';

// import { useState, useEffect } from 'react';
// import { useSession } from 'next-auth/react';
// import { useRouter, useSearchParams, useParams } from 'next/navigation';
// import { useTranslations } from 'next-intl';
// import Header from '../../../_components/Header';
// import ErrorModal from "../../../_components/ErrorModal";
// import Image from 'next/image';
// import seaBackground from '../../../../public/sea.svg';
// import { plex } from '../../../fonts/plex';
// import { motion, AnimatePresence } from 'framer-motion';
// import boat1 from '../../../../../public/boats/boat-1.svg';
// import { Loader2 } from 'lucide-react';
// import Footer from "@/app/_components/Footer";
// import logoHQXFR from '../../../../../public/logoxHQX/HQX-blanc-FR.svg';
// import logoHQXEN from '../../../../../public/logoxHQX/HQX-white-UK.svg';
// import LoadingIndicator from '@/app/_components/LoadingIndicator';

// interface MigrationStatus {
//   status: 'pending' | 'processing' | 'completed' | 'failed';
//   error?: string;
//   results?: {
//     bluesky: {
//       attempted: number;
//       succeeded: number;
//     };
//     mastodon: {
//       attempted: number;
//       succeeded: number;
//     };
//   };
// }

// export default function ReconnectingPage() {
//   const router = useRouter();
//   const { data: session, status } = useSession();
//   const searchParams = useSearchParams();
//   const params = useParams();
//   const t = useTranslations('Index');
//   const [showError, setShowError] = useState(false);
//   const [errorMessage, setErrorMessage] = useState('');
//   const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
//     status: 'pending'
//   });

//   useEffect(() => {
//     if (status === 'loading') return;
//     if (!session) {
//       router.push('/');
//       return;
//     }

//     const user_id = searchParams.get('user_id');
//     if (!user_id || user_id !== session.user.id) {
//       router.push(`/${params.locale}/migrate`);
//       return;
//     }

//     const startMigration = async () => {
//       try {
//         setMigrationStatus({ status: 'processing' });
      
//         const response = await fetch('/api/migrate/send_follow', {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({ user_id }),
//         });

//         if (!response.ok) {
//           throw new Error('Failed to start migration');
//         }

//         const result = await response.json();
      
//         if (result.success) {
//           setMigrationStatus({
//             status: 'completed',
//             results: result.results
//           });
//         } else {
//           throw new Error(result.error || 'Migration failed');
//         }
//       } catch (error) {
//         console.error('Error during migration:', error);
//         setMigrationStatus({
//           status: 'failed',
//           error: error instanceof Error ? error.message : 'An unexpected error occurred'
//         });
//         setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
//         setShowError(true);
//       }
//     };

//     startMigration();
//   }, [session, status, router, searchParams, params.locale]);

//   const getTotalProgress = () => {
//     if (!migrationStatus.results) return 0;
//     const total = migrationStatus.results.bluesky.attempted + migrationStatus.results.mastodon.attempted;
//     const succeeded = migrationStatus.results.bluesky.succeeded + migrationStatus.results.mastodon.succeeded;
//     return total > 0 ? (succeeded / total) * 100 : 0;
//   };

//   const handleClose = () => {
//     router.push(`/${params.locale}/migrate`);
//   };

//   return (
//     <div className="min-h-screen relative w-full max-w-[90rem] m-auto bg-[#2a39a9]">
//       <Header />
//       <div className="relative min-h-screen flex flex-col items-center justify-center px-4">
//         <Image
//           src={seaBackground}
//           alt="Sea Background"
//           className="absolute inset-0 w-full h-full object-cover"
//           priority
//         />
      
//         <div className="relative z-10 w-full max-w-md mx-auto">
//           <div className="bg-white rounded-lg shadow-lg p-8 text-center">
//             <Image
//               src={params.locale === 'fr' ? logoHQXFR : logoHQXEN}
//               alt="Logo HQX"
//               className="mx-auto mb-8"
//               width={200}
//               height={100}
//               priority
//             />

//             {migrationStatus.status === 'pending' && (
//               <div className="text-gray-600">
//                 <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
//                 <p>{t('initializing')}</p>
//               </div>
//             )}

//             {migrationStatus.status === 'processing' && (
//               <div className="text-gray-600">
//                 <LoadingIndicator progress={getTotalProgress()} />
//                 <p className="mt-4">{t('reconnexionModal.progressMessage')}</p>
//               </div>
//             )}

//             {migrationStatus.status === 'completed' && migrationStatus.results && (
//               <div className="text-gray-600">
//                 <div className="mb-4">
//                   <h3 className="text-xl font-semibold mb-2">
//                     {t('reconnexionModal.title', { count: getTotalProgress() })}
//                   </h3>
//                   <p>{t('reconnexionModal.message')}</p>
//                 </div>
              
//                 <div className="mt-8">
//                   <button
//                     onClick={handleClose}
//                     className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors"
//                   >
//                     {t('reconnexionModal.stayInformed')}
//                   </button>
//                 </div>
//               </div>
//             )}

//             {migrationStatus.status === 'failed' && (
//               <div className="text-red-600">
//                 <p className="mb-4">{t('error')}</p>
//                 <button
//                   onClick={handleClose}
//                   className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors"
//                 >
//                   {t('retry')}
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>

//         <motion.div
//           className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
//           animate={{
//             y: [0, -10, 0],
//           }}
//           transition={{
//             duration: 2,
//             repeat: Infinity,
//             ease: "easeInOut",
//           }}
//         >
//           <Image src={boat1} alt="Boat" priority />
//         </motion.div>
//       </div>

//       <Footer />

//       <ErrorModal
//         isOpen={showError}
//         onClose={() => setShowError(false)}
//         message={errorMessage}
//       />
//     </div>
//   );
// }
// 'use client'

// import { useState, useEffect } from 'react'
// import { motion } from 'framer-motion'
// import { useTranslations } from 'next-intl'
// import { plex } from '@/app/fonts/plex'
// import { Switch } from '@headlessui/react'
// import { ConsentType } from '@/hooks/useNewsLetter'
// import { useSession } from 'next-auth/react'
// import Image from 'next/image'
// import Badge from '../../../public/v2/HQX-badge.svg'
// import Link from 'next/link'
// import { useParams } from 'next/navigation'
// import { Info, AlertTriangle } from 'lucide-react'

// interface NewsLetterConsentsUpdateProps {
//   userId: string
//   newsletterData: any
//   onSubmit?: () => void
// }

// export default function NewsLetterConsentsUpdate({ userId, newsletterData, onSubmit }: NewsLetterConsentsUpdateProps) {
//   const { data: session } = useSession()
//   const t = useTranslations('settings')
//   const { locale } = useParams()
  
//   // États pour les consentements existants (pré-remplis à partir de session.user)
//   const [localConsents, setLocalConsents] = useState({
//     email_newsletter: false,
//     oep_newsletter: false, 
//     research_participation: false,
//     personalized_support: false,
//     bluesky_dm: false,
//     mastodon_dm: false
//   })
  
//   const [isLoading, setIsLoading] = useState(false)
//   const [error, setError] = useState('')
//   const [hasConsents, setHasConsents] = useState(false)
  
//   // Vérifier si l'utilisateur a Bluesky ou Mastodon
//   const hasBlueskyAccount = !!session?.user?.bluesky_username
//   const hasMastodonAccount = !!session?.user?.mastodon_username
//   const hasNoSocialAccounts = !hasBlueskyAccount && !hasMastodonAccount
  
//   // Initialiser les consentements depuis newsletterData au lieu d'un appel API
//   useEffect(() => {
//     if (newsletterData?.data?.consents) {
//       const consents = newsletterData.data.consents;
//       setLocalConsents({
//         email_newsletter: consents.email_newsletter || false,
//         oep_newsletter: consents.oep_newsletter || false,
//         research_participation: consents.research_participation || false,
//         personalized_support: consents.personalized_support || false,
//         bluesky_dm: consents.bluesky_dm || false,
//         mastodon_dm: consents.mastodon_dm || false
//       });
      
//       // Vérifier si l'utilisateur a des consentements
//       const hasAnyConsent = Object.values(consents).some(Boolean);
//       setHasConsents(hasAnyConsent);
//     }
//   }, [newsletterData]);
  
//   // Gérer le changement d'un consentement
//   const handleConsentChange = (type: ConsentType, value: boolean) => {
//     setLocalConsents(prev => ({ ...prev, [type]: value }))
    
//     // Si personalized_support est désactivé, désactiver aussi bluesky_dm et mastodon_dm
//     if (type === 'personalized_support' && !value) {
//       setLocalConsents(prev => ({ 
//         ...prev, 
//         [type]: value,
//         bluesky_dm: false,
//         mastodon_dm: false
//       }))
//     }
//   }
  
//   // Soumettre les consentements
//   const handleSubmit = async () => {
//     setIsLoading(true)
//     setError('')
    
//     try {
//       // Utiliser la méthode updateConsent depuis newsletterData
//       const consentsToUpdate = Object.entries(localConsents).map(([type, value]) => ({
//         type,
//         value
//       }));
      
//       // Mettre à jour chaque consentement via newsletterData
//       for (const consent of consentsToUpdate) {
//         await newsletterData.updateConsent(consent.type, consent.value);
//       }
      
//       // Marquer que l'utilisateur a maintenant des consentements (pour fermer la modale)
//       setHasConsents(true)
      
//       if (onSubmit) {
//         onSubmit()
//       }
      
//     } catch (error) {
//       console.error('Error updating consents:', error)
//       setError('Une erreur est survenue. Veuillez réessayer.')
//     } finally {
//       setIsLoading(false)
//     }
//   }
  
//   // Rendre un interrupteur avec son explication
//   const renderSwitch = (
//     type: ConsentType,
//     title: string,
//     description: string,
//     checked: boolean,
//     onChange: (value: boolean) => void
//   ) => (
//     <div className="flex items-center space-x-3 py-1 sm:py-3 switch-item">
//       <Switch
//         checked={checked}
//         onChange={(value) => onChange(value)}
//         className={`${
//           checked ? 'bg-blue-600' : 'bg-gray-200'
//         } relative inline-flex h-5 w-10 sm:h-[24px] sm:w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
//       >
//         <span
//           className={`${
//             checked ? 'translate-x-5 sm:translate-x-[22px]' : 'translate-x-[2px]'
//           } inline-block h-4 w-4 sm:h-[20px] sm:w-[20px] transform rounded-full bg-white transition-transform`}
//         />
//       </Switch>
//       <div className="flex flex-col space-y-0.5">
//         <span className="text-[9px] sm:text-xs font-medium text-gray-700">{title}</span>
//         <span className="text-xs sm:text-sm  text-gray-500 mt-0.5 sm:mt-1 switch-description">{description}</span>
//       </div>
//     </div>
//   )
  
//   // Si l'utilisateur a déjà des consentements, ne pas afficher le composant
//   if (hasConsents) {
//     return null
//   }
  
//   return (
//     <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
//       <motion.div
//         initial={{ opacity: 0, scale: 0.95 }}
//         animate={{ opacity: 1, scale: 1 }}
//         className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-2 sm:mx-4 flex flex-col max-h-[95vh]"
//       >
//         <style jsx global>{`
//           @media (max-height: 700px) {
//             .consent-modal-content {
//               padding-top: 8px;
//               padding-bottom: 8px;
//             }
//             .consent-heading {
//               margin-bottom: 4px;
//             }
//             .consent-description {
//               margin-bottom: 8px;
//             }
//             .consent-section {
//               margin-top: 8px;
//             }
//             .switch-item {
//               padding-top: 2px;
//               padding-bottom: 2px;
//             }
//             .switch-description {
//               line-height: 1.1;
//             }
//             .warning-box {
//               padding: 6px !important;
//               margin-top: 4px !important;
//               margin-bottom: 4px !important;
//             }
//             .warning-box p {
//               font-size: 10px !important;
//             }
//           }
//         `}</style>
        
//         <div className="p-4 sm:p-6 overflow-y-auto consent-modal-content" style={{ scrollbarWidth: 'thin' }}>
//           <div className="flex items-center mb-2 sm:mb-4 consent-heading">
//             <Image src={Badge} alt="HelloQuitteX" width={24} height={24} className="sm:w-10 sm:h-10" />
//             <h2 className={`${plex.className} text-sm sm:text-xl font-bold ml-2 sm:ml-4 text-gray-800`}>
//               {t('consentUpdate.title')}
//             </h2>
//           </div>
          
//           <p className="text-xs sm:text-base text-gray-600 mb-2 sm:mb-6 consent-description">
//             {t('consentUpdate.description')}
//           </p>
          
//           <div className="space-y-0 sm:space-y-2">
//             {/* Consentements existants */}
//             <h3 className={`${plex.className} text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-3`}>
//               {t('consentUpdate.currentConsents')}
//             </h3>
            
//             {renderSwitch(
//               'email_newsletter',
//               t('notifications.hqxNewsletter.title'),
//               t('notifications.hqxNewsletter.description'),
//               localConsents.email_newsletter,
//               (value) => handleConsentChange('email_newsletter', value)
//             )}
            
//             {renderSwitch(
//               'oep_newsletter',
//               t('notifications.oepNewsletter.title'),
//               t('notifications.oepNewsletter.description'),
//               localConsents.oep_newsletter,
//               (value) => handleConsentChange('oep_newsletter', value)
//             )}
            
//             {renderSwitch(
//               'research_participation',
//               t('notifications.research.title'),
//               t('notifications.research.description'),
//               localConsents.research_participation,
//               (value) => handleConsentChange('research_participation', value)
//             )}
            
//             {/* Nouveaux consentements */}
//             <h3 className={`${plex.className} text-xs sm:text-sm font-medium text-gray-700 mt-2 sm:mt-6 mb-1 sm:mb-3 consent-section`}>
//               {t('consentUpdate.newConsents')}
//             </h3>
            
//             {renderSwitch(
//               'personalized_support',
//               t('notifications.personalizedSupport.title'),
//               t('notifications.personalizedSupport.description'),
//               localConsents.personalized_support,
//               (value) => handleConsentChange('personalized_support', value)
//             )}
            
//             {/* Options de support personnalisé conditionnelles */}
//             {localConsents.personalized_support && (
//               <div className="ml-4 sm:ml-6 space-y-1 sm:space-y-3 border-l-2 border-gray-200 pl-2 sm:pl-4 mt-1 sm:mt-2">
//                 {/* Message d'avertissement si aucun compte social n'est lié */}
//                 {hasNoSocialAccounts ? (
//                   <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 sm:p-4 warning-box">
//                     <div className="flex">
//                       <div className="flex-shrink-0">
//                         <Info className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
//                       </div>
//                       <div className="ml-2 sm:ml-3">
//                         <p className="text-[10px] sm:text-sm text-yellow-700">
//                           {t('consentUpdate.dmLinkWarning')}
//                         </p>
//                         <p className="text-[10px] sm:text-sm text-yellow-700 mt-1 sm:mt-2">
//                           {t('consentUpdate.validateAnyway')}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 ) : (
//                   <>
//                     {/* Afficher les options seulement si l'utilisateur a des comptes liés */}
//                     {hasBlueskyAccount && (
//                       <>
//                         {renderSwitch(
//                           'bluesky_dm',
//                           t('notifications.blueskyDm.title'),
//                           t('notifications.blueskyDm.description'),
//                           localConsents.bluesky_dm,
//                           (value) => handleConsentChange('bluesky_dm', value)
//                         )}
//                         {localConsents.bluesky_dm && (
//                           <div className="ml-4 sm:ml-6 mt-1 mb-2 sm:mb-3 bg-red-50 border-l-4 border-red-400 p-2 sm:p-3 warning-box">
//                             <div className="flex">
//                               <div className="flex-shrink-0">
//                                 <AlertTriangle className="h-3 w-3 sm:h-5 sm:w-5 text-red-400" />
//                               </div>
//                               <div className="ml-2 sm:ml-3">
//                                 <p className="text-[10px] sm:text-sm text-red-700">
//                                   {t('consentUpdate.blueskyDmWarning')}
//                                   {" "}
//                                   <a 
//                                     href="https://bsky.app/profile/openportability.bsky.social" 
//                                     target="_blank" 
//                                     rel="noopener noreferrer"
//                                     className="font-medium underline text-red-700 hover:text-red-800"
//                                   >
//                                     @openportability.bsky.social
//                                   </a>
//                                 </p>
//                               </div>
//                             </div>
//                           </div>
//                         )}
//                       </>
//                     )}
                    
//                     {hasMastodonAccount && (
//                       <>
//                         {renderSwitch(
//                           'mastodon_dm',
//                           t('notifications.mastodonDm.title'),
//                           t('notifications.mastodonDm.description'),
//                           localConsents.mastodon_dm,
//                           (value) => handleConsentChange('mastodon_dm', value)
//                         )}
//                         {localConsents.mastodon_dm && (
//                           <div className="ml-4 sm:ml-6 mt-1 mb-2 sm:mb-3 bg-red-50 border-l-4 border-red-400 p-2 sm:p-3 warning-box">
//                             <div className="flex">
//                               <div className="flex-shrink-0">
//                                 <AlertTriangle className="h-3 w-3 sm:h-5 sm:w-5 text-red-400" />
//                               </div>
//                               <div className="ml-2 sm:ml-3">
//                                 <p className="text-[10px] sm:text-sm text-red-700">
//                                   {t('consentUpdate.mastodonDmWarning')}
//                                   {" "}
//                                   <a 
//                                     href="https://mastodon.social/@openportability" 
//                                     target="_blank" 
//                                     rel="noopener noreferrer"
//                                     className="font-medium underline text-red-700 hover:text-red-800"
//                                   >
//                                     @OpenPortability@mastodon.social
//                                   </a>
//                                 </p>
//                               </div>
//                             </div>
//                           </div>
//                         )}
//                       </>
//                     )}
//                   </>
//                 )}
//               </div>
//             )}
//           </div>
//         </div>
        
//         <div className="p-3 sm:p-6 bg-white border-t border-gray-100">
//           {error && (
//             <p className="text-red-500 text-xs sm:text-sm mb-2 sm:mb-4">{error}</p>
//           )}
          
//           <button
//             onClick={handleSubmit}
//             disabled={isLoading}
//             className="w-full px-3 sm:px-6 py-2 sm:py-3 bg-[#46489B] text-white text-xs sm:text-base rounded-lg font-semibold hover:bg-opacity-90 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {isLoading ? (
//               <span className="flex items-center justify-center gap-2">
//                 <span className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></span>
//                 {t('loading')}
//               </span>
//             ) : (
//               t('consentUpdate.confirmButton')
//             )}
//           </button>
//         </div>
//       </motion.div>
//     </div>
//   )
// }
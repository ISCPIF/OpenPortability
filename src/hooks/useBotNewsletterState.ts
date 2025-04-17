// import { useState, useEffect } from 'react';
// import { useSession } from 'next-auth/react';

// export function useBotNewsletterState() {
//   const { data: session, update } = useSession();
  
//   // États pour contrôler l'affichage de la modale
//   const [showRequestNewsLetterDMModal, setShowRequestNewsLetterDMModal] = useState(false);
//   const [isUpdatingBotNewsletter, setIsUpdatingBotNewsletter] = useState(false);
//   const [isNewsletterFirstSeenOpen, setIsNewsletterFirstSeenOpen] = useState(false);
  
//   // États dérivés de la session utilisateur
//   const hasBlueskyHandle = !!session?.user?.bluesky_handle || !!session?.user?.bluesky_username;
//   const hasSubscribedNewsletter = !!session?.user?.hqx_newsletter;
//   const hasSeenBotNewsletter = !!session?.user?.have_seen_bot_newsletter;
  
//   // Vérifier si les conditions sont remplies pour afficher la modale
//   const shouldShowModal = hasBlueskyHandle && 
//                          hasSubscribedNewsletter && 
//                          !hasSeenBotNewsletter && 
//                          !isNewsletterFirstSeenOpen;
  
//   // Log for debugging
//   console.log('🔍 Bot Newsletter Modal State:', {
//     shouldShowModal,
//     hasBlueskyHandle,
//     hasSubscribedNewsletter,
//     hasSeenBotNewsletter,
//     isNewsletterFirstSeenOpen,
//     showRequestNewsLetterDMModal
//   });
  
//   // Mettre à jour l'état local en fonction des conditions
//   useEffect(() => {
//     if (shouldShowModal && !showRequestNewsLetterDMModal) {
//       setShowRequestNewsLetterDMModal(true);
//     }
//   }, [shouldShowModal, showRequestNewsLetterDMModal]);
  
//   // Marquer comme vu lors de l'affichage de la modale
//   useEffect(() => {
//     const markAsSeen = async () => {
//       if (showRequestNewsLetterDMModal && !hasSeenBotNewsletter && session?.user?.id) {
//         try {
//           setIsUpdatingBotNewsletter(true);
//           const response = await fetch('/api/users/bot-newsletter', {
//             method: 'POST',
//             headers: {
//               'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//               userId: session.user.id,
//               haveSeenBotNewsletter: true,
//             }),
//           });
          
//           if (response.ok) {
//             // Mettre à jour la session pour refléter le changement
//             await update();
//           }
//         } catch (error) {
//           console.error('Error updating bot newsletter status:', error);
//         } finally {
//           setIsUpdatingBotNewsletter(false);
//         }
//       }
//     };
    
//     markAsSeen();
//   }, [showRequestNewsLetterDMModal, hasSeenBotNewsletter, session?.user?.id, update]);
  
//   // Fonction pour réinitialiser l'état have_seen_bot_newsletter
//   const resetBotNewsletterSeen = async () => {
//     if (!session?.user?.id) return;
    
//     try {
//       setIsUpdatingBotNewsletter(true);
//       const response = await fetch('/api/users/bot-newsletter', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           userId: session.user.id,
//           haveSeenBotNewsletter: false,
//         }),
//       });
      
//       if (response.ok) {
//         await update();
//       }
//     } catch (error) {
//       console.error('Error resetting bot newsletter status:', error);
//     } finally {
//       setIsUpdatingBotNewsletter(false);
//     }
//   };
  
//   return {
//     showRequestNewsLetterDMModal,
//     setShowRequestNewsLetterDMModal,
//     isUpdatingBotNewsletter,
//     hasSeenBotNewsletter,
//     hasBlueskyHandle,
//     hasSubscribedNewsletter,
//     isNewsletterFirstSeenOpen,
//     setIsNewsletterFirstSeenOpen,
//     resetBotNewsletterSeen
//   };
// }
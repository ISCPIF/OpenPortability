// import { NextResponse } from 'next/server';
// import { StatsRepository } from '@/lib/repositories/statsRepository';
// import { StatsService } from '@/lib/services/statsServices';
// import { auth } from '@/app/auth';
// import logger from '@/lib/log_utils';
// import { z } from 'zod';
// import { withValidation } from '@/lib/validation/middleware';
// import { resetRateLimit } from '@/lib/validation/rate-limit';

// // Schéma vide pour un endpoint sans données d'entrée
// const EmptySchema = z.object({}).strict();

// /**
//  * Vérifie si une erreur est un timeout PostgreSQL
//  * Code d'erreur 57014 ou message contenant "statement_timeout"
//  */
// function isPostgresTimeoutError(error: any): boolean {
//   if (!error) return false;
  
//   // Vérifier le code d'erreur PostgreSQL pour timeout (57014)
//   if (error.code === '57014') return true;
  
//   // Vérifier si le message d'erreur contient une indication de timeout
//   if (error.message && typeof error.message === 'string') {
//     return error.message.toLowerCase().includes('statement_timeout') ||
//            error.message.toLowerCase().includes('query_canceled') ||
//            error.message.toLowerCase().includes('canceling statement due to statement timeout');
//   }
  
//   return false;
// }

// // Handler pour la mise à jour des statistiques utilisateur
// async function updateUserStatsHandler(
//   request: Request,
//   data: z.infer<typeof EmptySchema>,
//   session: any
// ) {
//   try {
//     // Session est déjà validée par le middleware withValidation
//     const userId = session.user.id;
//     const hasOnboarded = session.user.has_onboarded;
    
//     const statsRepository = new StatsRepository();
//     const statsService = new StatsService(statsRepository);
  
//     await statsService.refreshUserStats(userId, hasOnboarded);
    
//     logger.logInfo('API', 'POST /api/update/user_stats', 'User stats updated successfully', userId);
//     return NextResponse.json({ success: true });
//   } catch (error) {
//     const userId = session?.user?.id || 'unknown';
    
//     // Vérifier si c'est une erreur de timeout PostgreSQL
//     if (isPostgresTimeoutError(error)) {
//       logger.logWarning('API', 'POST /api/update/user_stats', 'PostgreSQL timeout detected - resetting rate limit', userId, {
//         context: 'Updating user stats',
//         errorMessage: error instanceof Error ? error.message : 'Unknown error'
//       });
      
//       // Réinitialiser le rate limit pour permettre une nouvelle tentative
//       resetRateLimit('/api/update/user_stats', userId);
      
//       return NextResponse.json(
//         { 
//           error: 'Stats update timed out. You can try again immediately.',
//           timeout: true
//         },
//         { status: 500 }
//       );
//     }
    
//     // Gestion standard des autres erreurs
//     if (error instanceof Error) {
//       logger.logError('API', 'POST /api/update/user_stats', error, userId, {
//         context: 'Updating user stats',
//         errorMessage: error.message
//       });
//     } else {
//       logger.logError('API', 'POST /api/update/user_stats', 'Unknown error', userId, {
//         context: 'Updating user stats'
//       });
//     }
    
//     return NextResponse.json(
//       { error: 'Failed to update user stats' },
//       { status: 500 }
//     );
//   }
// }

// // Configuration du rate limit spécifique: une fois par 10 minutes par utilisateur
// const userStatsRateLimit = {
//   windowMs: 10 * 60 * 1000, // 10 minutes
//   maxRequests: 2,           // Une seule requête autorisée
//   message: 'Stats can only be updated once every 10 minutes. Please try again later.'
// };

// // Export du handler avec middleware de validation
// export const POST = withValidation(
//   EmptySchema,
//   updateUserStatsHandler,
//   {
//     requireAuth: true,           // Authentification requise
//     applySecurityChecks: false,  // Pas de body à valider
//     validateQueryParams: true,   // Valider les paramètres d'URL
//     customRateLimit: userStatsRateLimit // Rate limit personnalisé
//   }
// );
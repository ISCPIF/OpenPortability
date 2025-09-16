import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { withInternalValidation } from '@/lib/validation/internal-middleware';
import { z } from 'zod';

// Schéma pour valider le payload du webhook PostgreSQL
const UserStatsPayloadSchema = z.object({
  user_id: z.string().uuid('Invalid user_id format'),
  stats: z.record(z.any()).optional(), // Objet JSON avec stats
  updated_at: z.string().optional()    // Timestamp optionnel
});

/**
 * Handler pour rafraîchir le cache Redis des stats utilisateur
 * Appelé par PostgreSQL via pg_net après mise à jour de user_stats_cache
 * Reçoit les stats directement dans le payload pour éviter une requête DB supplémentaire
 */
async function handleRefreshUserStatsCache(
  request: NextRequest,
  validatedData: z.infer<typeof UserStatsPayloadSchema>
): Promise<NextResponse> {
  try {
    const { user_id, stats, updated_at } = validatedData;

    if (!stats || !user_id) {
      logger.logError('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', 'Missing stats in request body', 'system', {
        user_id
      });
      return NextResponse.json({ 
        error: 'Missing stats parameter' 
      }, { status: 400 });
    }

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', 'Starting user stats cache refresh', 'system', {
      context: 'User stats cache refresh triggered by PostgreSQL with stats payload',
      user_id,
      updated_at
    });

    // 1. Supprimer l'ancien cache Redis
    const cacheKey = `user:stats:${user_id}`;
    await redis.del(cacheKey);

    // 2. Mettre à jour Redis avec les stats reçues dans le payload (TTL: 10 minutes)
    await redis.set(cacheKey, JSON.stringify(stats), 600);

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', 'User stats cache updated successfully', 'system', {
      context: 'User stats cached in Redis for 10 minutes from payload',
      user_id,
      statsKeys: Object.keys(stats || {})
    });

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      user_id,
      ttl: 600,
      stats_received: !!stats
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', err, 'system', {
      context: 'Failed to update user stats cache from webhook'
    });

    return NextResponse.json({ 
      error: 'Failed to update user stats cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export du handler POST avec middleware de validation interne
export const POST = withInternalValidation(
  UserStatsPayloadSchema,
  handleRefreshUserStatsCache,
  {
    allowEmptyBody: false,      // Body JSON requis pour ce POST
    disableInDev: false,        // Activé même en développement
    requireSignature: true,     // Signature HMAC requise en production
    logSecurityEvents: true     // Logs de sécurité activés
  }
);

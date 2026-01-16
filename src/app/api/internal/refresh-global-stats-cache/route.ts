import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { withInternalValidation } from '@/lib/validation/internal-middleware';
import { z } from 'zod';
import { publishGlobalStatsUpdate } from '@/lib/sse-publisher';

// Schéma pour valider le payload du webhook PostgreSQL
const GlobalStatsPayloadSchema = z.object({
  stats: z.record(z.any()).optional(), // Objet JSON avec stats globales
  updated_at: z.string().optional()    // Timestamp optionnel
});

/**
 * Handler pour rafraîchir le cache Redis des stats globales
 * Appelé par PostgreSQL via pg_net après mise à jour de global_stats_cache
 * Reçoit les stats directement dans le payload pour éviter une requête DB supplémentaire
 */
async function handleRefreshGlobalStatsCache(
  request: NextRequest,
  validatedData: z.infer<typeof GlobalStatsPayloadSchema>
): Promise<NextResponse> {
  try {
    const { stats, updated_at } = validatedData;

    if (!stats) {
      logger.logError('WEBHOOK', 'POST /api/internal/refresh-global-stats-cache', 'Missing stats in request body', 'system');
      return NextResponse.json({ 
        error: 'Missing stats parameter' 
      }, { status: 400 });
    }

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-global-stats-cache', 'Starting global stats cache refresh', 'system', {
      context: 'Global stats cache refresh triggered by PostgreSQL with stats payload',
      updated_at
    });

    // 1. Supprimer l'ancien cache Redis
    const cacheKey = 'stats:global';
    await redis.del(cacheKey);

    // 2. Mettre à jour Redis avec les stats reçues dans le payload (TTL: 24 heures)
    await redis.set(cacheKey, JSON.stringify(stats), 86400);

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-global-stats-cache', 'Global stats cache updated successfully', 'system', {
      context: 'Global stats cached in Redis for 24 hours from payload',
      statsKeys: Object.keys(stats || {})
    });

    // 3. Publish SSE event to notify all connected clients
    try {
      const sseStats = {
        users: stats.users?.total || 0,
        connections: stats.connections?.withHandle || 0,
        updated_at: updated_at || new Date().toISOString(),
      };
      await publishGlobalStatsUpdate(sseStats);
      logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-global-stats-cache', 'SSE event published for global stats', 'system');
    } catch (sseError) {
      // Don't fail the request if SSE publish fails
      logger.logWarning('WEBHOOK', 'POST /api/internal/refresh-global-stats-cache', 'Failed to publish SSE event', 'system', {
        error: sseError instanceof Error ? sseError.message : String(sseError)
      });
    }

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ttl: 86400,
      stats_received: !!stats
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('WEBHOOK', 'POST /api/internal/refresh-global-stats-cache', err, 'system', {
      context: 'Failed to update global stats cache from webhook'
    });

    return NextResponse.json({ 
      error: 'Failed to update global stats cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export du handler POST avec middleware de validation interne
export const POST = withInternalValidation(
  GlobalStatsPayloadSchema,
  handleRefreshGlobalStatsCache,
  {
    allowEmptyBody: false,      // Body JSON requis pour ce POST
    disableInDev: false,        // Activé même en développement
    requireSignature: true,     // Signature HMAC requise en production
    logSecurityEvents: true     // Logs de sécurité activés
  }
);

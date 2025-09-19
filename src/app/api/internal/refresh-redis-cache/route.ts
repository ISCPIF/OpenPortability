import { NextRequest, NextResponse } from 'next/server';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { withInternalValidation } from '@/lib/validation/internal-middleware';
import { z } from 'zod';

// Schéma vide pour les requêtes GET sans body
const EmptySchema = z.object({});

async function handleRefreshRedisCache(
  request: NextRequest,
  validatedData: z.infer<typeof EmptySchema>
): Promise<NextResponse> {
  try {
    const routeLabel = `${request.method} /api/internal/refresh-redis-cache`;
    logger.logInfo('API', routeLabel, 'Starting Redis cache refresh', 'system', {
      context: 'Redis cache refresh triggered via GET request'
    });

    // Lire les stats depuis global_stats_cache
    const repository = new StatsRepository();
    const stats = await repository.getGlobalStatsFromCache();

    if (!stats) {
      logger.logWarning('API', routeLabel, 'No stats found in global_stats_cache', 'system', {
        context: 'Cache refresh failed - no data'
      });
      return NextResponse.json({ error: 'No stats found in cache' }, { status: 404 });
    }

    // Mettre à jour Redis avec TTL de 65 minutes (sécurité)
    await redis.set('stats:global', JSON.stringify(stats), 86400);

    logger.logInfo('API', routeLabel, 'Redis cache updated successfully', 'system', {
      context: 'Global stats cached in Redis',
      ttl: 86400,
      statsKeys: Object.keys(stats)
    });

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ttl: 86400 
    });

  } catch (error) {
    const routeLabel = `${request.method} /api/internal/refresh-redis-cache`;
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', routeLabel, err, 'system', {
      context: 'Failed to update Redis cache from GET request'
    });

    return NextResponse.json({ 
      error: 'Failed to update Redis cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export du handler GET avec middleware de validation interne
export const GET = withInternalValidation(
  EmptySchema,
  handleRefreshRedisCache,
  {
    allowEmptyBody: true,       // Permet les requêtes GET sans body
    disableInDev: false,        // Activé même en développement
    requireSignature: true,     // Signature HMAC requise en production
    logSecurityEvents: true     // Logs de sécurité activés
  }
);

// Export du handler POST pour supporter les appels internes via POST
export const POST = withInternalValidation(
  EmptySchema,
  handleRefreshRedisCache,
  {
    allowEmptyBody: true,       // Permet un body vide (les appels peuvent envoyer {})
    disableInDev: false,        // Activé même en développement
    requireSignature: true,     // Signature HMAC requise en production
    logSecurityEvents: true     // Logs de sécurité activés
  }
);


import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { withInternalValidation } from '@/lib/validation/internal-middleware';
import { z } from 'zod';
import { pgMastodonInstanceRepository } from '@/lib/repositories/auth/pg-mastodon-instance-repository'

// Schéma vide pour les requêtes GET sans body
const EmptySchema = z.object({});

async function handleRefreshMastodonCache(
  request: NextRequest,
  validatedData: z.infer<typeof EmptySchema>
): Promise<NextResponse> {
  try {
    logger.logInfo('API', 'GET /api/internal/refresh-mastodon-cache', 'Starting Mastodon cache refresh', 'system', {
      context: 'Mastodon cache refresh triggered via GET request'
    });

    // Récupérer les instances depuis la DB (repository)
    const instances = await pgMastodonInstanceRepository.getAllInstances()
    const instancesList = instances.map(row => row.instance)

    // Mettre à jour Redis sans TTL (cache permanent, invalidé uniquement par trigger)
    await redis.set('mastodon:instances', JSON.stringify(instancesList));

    logger.logInfo('API', 'GET /api/internal/refresh-mastodon-cache', 'Mastodon cache updated successfully', 'system', {
      context: 'Mastodon instances cached in Redis (permanent cache)',
      count: instancesList.length
    });

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ttl: 'permanent',
      count: instancesList.length
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.logError('API', 'GET /api/internal/refresh-mastodon-cache', err, 'system', {
      context: 'Failed to update Mastodon cache from GET request'
    });

    return NextResponse.json({ 
      error: 'Failed to update Mastodon cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export du handler GET avec middleware de validation interne
export const GET = withInternalValidation(
  EmptySchema,
  handleRefreshMastodonCache,
  {
    allowEmptyBody: true,       // Permet les requêtes GET sans body
    disableInDev: false,         // Désactivé en développement
    requireSignature: true,     // Signature HMAC requise en production
    logSecurityEvents: true     // Logs de sécurité activés
  }
);

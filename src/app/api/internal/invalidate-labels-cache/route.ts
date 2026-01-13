import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { withInternalValidation } from '@/lib/validation/internal-middleware';

// Redis cache key (same as in names_labels route)
const CACHE_KEY = 'graph:labels:public';

// Schéma de validation pour les requêtes d'invalidation
const InvalidateLabelsRequestSchema = z.object({
  action: z.enum(['invalidate']),
  // Optionnel: informations sur le changement pour le logging
  twitter_id: z.string().optional(),
  consent_level: z.string().optional(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
  metadata: z.object({
    trigger_operation: z.string().optional(),
    timestamp: z.string().optional(),
    source: z.string().optional(),
  }).optional(),
});

type InvalidateLabelsRequest = z.infer<typeof InvalidateLabelsRequestSchema>;

async function handleInvalidateLabelsCache(
  request: NextRequest, 
  validatedData: InvalidateLabelsRequest
): Promise<NextResponse> {
  try {
    const { action, twitter_id, consent_level, operation, metadata } = validatedData;

    if (action === 'invalidate') {
      // Supprimer le cache Redis
      await redis.del(CACHE_KEY);
      
      logger.logInfo(
        'API',
        'POST /api/internal/invalidate-labels-cache',
        `Labels cache invalidated - operation: ${operation || 'unknown'}, twitter_id: ${twitter_id || 'unknown'}, consent_level: ${consent_level || 'unknown'}`
      );

      return NextResponse.json({
        success: true,
        message: 'Labels cache invalidated successfully',
        cache_key: CACHE_KEY,
        invalidated_at: new Date().toISOString(),
        trigger: {
          operation,
          twitter_id,
          consent_level,
          source: metadata?.source,
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError(
      'API',
      'POST /api/internal/invalidate-labels-cache',
      errorString,
      'system',
      { context: 'Error invalidating labels cache' }
    );
    return NextResponse.json(
      { error: 'Internal server error', details: errorString },
      { status: 500 }
    );
  }
}

// Configuration du middleware de validation (internal endpoint)
export const POST = withInternalValidation(
  InvalidateLabelsRequestSchema,
  handleInvalidateLabelsCache,
  {
    disableInDev: true,
    requireSignature: true,
    logSecurityEvents: true,
    allowEmptyBody: false
  }
);

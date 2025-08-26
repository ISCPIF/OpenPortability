import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
import { withInternalValidation } from '@/lib/validation/internal-middleware';

// Schéma de validation pour les requêtes de synchronisation Redis
const SyncRedisRequestSchema = z.object({
  action: z.enum(['upsert', 'delete']),
  platform: z.enum(['bluesky', 'mastodon']),
  twitter_id: z.string().min(1),
  // Champs Bluesky (directement dans le body)
  bluesky_username: z.string().optional(),
  bluesky_id: z.string().optional(),
  // Champs Mastodon (directement dans le body)
  mastodon_id: z.string().optional(),
  mastodon_username: z.string().optional(),
  mastodon_instance: z.string().optional(),
  // Support de l'ancien format avec data imbriqué (rétrocompatibilité)
  data: z.object({
    bluesky_username: z.string().optional(),
    bluesky_id: z.string().optional(),
    mastodon_id: z.string().optional(),
    mastodon_username: z.string().optional(),
    mastodon_instance: z.string().optional(),
  }).optional(),
});

type SyncRedisRequest = z.infer<typeof SyncRedisRequestSchema>;

async function handleSyncRedisMapping(
  request: NextRequest, 
  validatedData: SyncRedisRequest
): Promise<NextResponse> {
  try {
    const { action, platform, twitter_id } = validatedData;

    console.log('Processing sync-redis-mapping request', {
      action,
      platform,
      twitter_id,
      endpoint: '/api/internal/sync-redis-mapping'
    });

    const redisKey = `twitter_to_${platform}:${twitter_id}`;

    if (action === 'delete') {
      // Supprimer la correspondance de Redis
      await redis.del(redisKey);
      
      console.log('API', 'POST /api/internal/sync-redis-mapping', 'Mapping deleted from Redis', 'system', {
        platform,
        twitter_id,
        redisKey
      });

    } else if (action === 'upsert') {
      let redisValue: string;

      if (platform === 'bluesky') {
        // Récupérer les données depuis le body directement ou depuis data (rétrocompatibilité)
        const bluesky_username = validatedData.bluesky_username || validatedData.data?.bluesky_username;
        const bluesky_id = validatedData.bluesky_id || validatedData.data?.bluesky_id;
        
        if (!bluesky_username) {
          return NextResponse.json(
            { error: 'bluesky_username is required for Bluesky platform' },
            { status: 400 }
          );
        }
        // Format: username uniquement (cohérent avec batchSetSocialMappings et redis-init)
        redisValue = bluesky_username;

      } else { // mastodon
        // Récupérer les données depuis le body directement ou depuis data (rétrocompatibilité)
        const mastodon_id = validatedData.mastodon_id || validatedData.data?.mastodon_id;
        const mastodon_username = validatedData.mastodon_username || validatedData.data?.mastodon_username;
        const mastodon_instance = validatedData.mastodon_instance || validatedData.data?.mastodon_instance;
        
        if (!mastodon_id || !mastodon_username || !mastodon_instance) {
          return NextResponse.json(
            { error: 'mastodon_id, mastodon_username and mastodon_instance are required for Mastodon platform' },
            { status: 400 }
          );
        }
        // Format: JSON stringifié (cohérent avec redis-init)
        redisValue = JSON.stringify({
          id: mastodon_id,
          username: mastodon_username,
          instance: mastodon_instance
        });
      }

      // Stocker dans Redis (pas de TTL, cache permanent)
      await redis.set(redisKey, redisValue);

      console.log('API', 'POST /api/internal/sync-redis-mapping', 'Mapping updated in Redis', 'system', {
        platform,
        twitter_id,
        redisKey,
        redisValue
      });
    }

    return NextResponse.json({ 
      success: true,
      action,
      platform,
      twitter_id,
      redisKey
    });

  } catch (error) {
    console.log('API', 'POST /api/internal/sync-redis-mapping', error, 'system', {
      context: 'Failed to sync Redis mapping'
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export du handler sécurisé avec validation interne
export const POST = withInternalValidation(
  SyncRedisRequestSchema,
  handleSyncRedisMapping,
  {
    disableInDev: false,       // Actif par défaut, même en développement
    maxTimestampAge: 300,      // 5 minutes max
    requireSignature: true,    // Signature HMAC requise
    logSecurityEvents: true    // Logs de sécurité activés
  }
);

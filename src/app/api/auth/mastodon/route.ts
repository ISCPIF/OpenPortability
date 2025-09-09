import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/log_utils';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import redis from '@/lib/redis'; // Import redis

// Schema vide pour GET (pas de body)
const EmptySchema = z.object({});

/**
 * GET handler - Récupérer la liste des instances Mastodon disponibles
 * Utilise le nouveau middleware de validation standardisé
 */
export const GET = withValidation(
  EmptySchema,
  async (request: NextRequest, data: {}) => {
    console.log('API', 'GET /api/auth/mastodon', 'anonymous', {
      context: 'Fetching Mastodon instances'
    });
    
    try {
      // 1. Essayer Redis d'abord
      let instancesList: string[] = [];
      
      try {
        const cachedInstances = await redis.get('mastodon:instances');
        if (cachedInstances) {
          instancesList = JSON.parse(cachedInstances);
          
          logger.logInfo('API', 'GET /api/auth/mastodon', 'Mastodon instances served from Redis cache', 'anonymous', {
            context: 'Cache hit - Redis data served',
            count: instancesList.length
          });

          return NextResponse.json({ instances: instancesList });
        }
      } catch (redisError) {
        logger.logWarning('API', 'GET /api/auth/mastodon', 'Redis cache miss or error, falling back to database', 'anonymous', {
          context: 'Redis unavailable, using database fallback',
          error: redisError
        });
      }

      // 2. Fallback vers PostgreSQL si cache miss ou Redis indisponible
      const { data: instances, error } = await supabase
        .from('mastodon_instances')
        .select('instance')
        .order('instance');

      if (error) {
        console.log('API', 'GET /api/auth/mastodon', error, 'anonymous', {
          context: 'Database error while fetching instances'
        });
        
        return NextResponse.json(
          { error: 'Failed to fetch instances' },
          { status: 500 }
        );
      }

      instancesList = instances?.map((row: any) => row.instance) || [];
      
      // 3. Mettre en cache de façon permanente (invalidé uniquement par trigger)
      try {
        await redis.set('mastodon:instances', JSON.stringify(instancesList));
        
        logger.logInfo('API', 'GET /api/auth/mastodon', 'Mastodon instances fetched from DB and cached', 'anonymous', {
          context: 'Database fallback successful, data cached in Redis permanently',
          count: instancesList.length
        });
      } catch (cacheError) {
        logger.logWarning('API', 'GET /api/auth/mastodon', 'Failed to cache instances in Redis', 'anonymous', {
          context: 'Database query successful but Redis caching failed',
          error: cacheError
        });
      }

      console.log('API', 'GET /api/auth/mastodon', 'anonymous', {
        context: 'Successfully fetched Mastodon instances from database',
        count: instancesList.length
      });

      return NextResponse.json({ instances: instancesList });
    } catch (error) {
      console.log('API', 'GET /api/auth/mastodon', error, 'anonymous', {
        context: 'Unexpected error in Mastodon instances handler'
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: false,        // Endpoint public
    applySecurityChecks: false, // Pas nécessaire pour un GET sans params
    skipRateLimit: false       // Appliquer le rate limiting standard
  }
);

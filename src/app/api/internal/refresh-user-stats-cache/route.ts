import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';

/**
 * Webhook pour rafraîchir le cache Redis des stats utilisateur
 * Appelé par PostgreSQL via pg_net après mise à jour de user_stats_cache
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      logger.logError('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', 'Missing user_id in request body', 'system');
      return NextResponse.json({ 
        error: 'Missing user_id parameter' 
      }, { status: 400 });
    }

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', 'Starting user stats cache refresh', 'system', {
      context: 'User stats cache refresh triggered by PostgreSQL',
      user_id
    });

    // 1. Supprimer l'ancien cache Redis
    const cacheKey = `user:stats:${user_id}`;
    await redis.del(cacheKey);

    // 2. Récupérer les nouvelles stats depuis user_stats_cache
    const { data, error } = await supabase
      .from('user_stats_cache')
      .select('stats')
      .eq('user_id', user_id)
      .single();

    if (error || !data) {
      logger.logError('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', 'Failed to fetch user stats from cache table', 'system', {
        context: 'Database query failed',
        user_id,
        error: error?.message
      });
      return NextResponse.json({ 
        error: 'Failed to fetch user stats from database' 
      }, { status: 500 });
    }

    // 3. Mettre à jour Redis avec les nouvelles données (TTL: 10 minutes)
    await redis.set(cacheKey, JSON.stringify(data.stats), 600);

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', 'User stats cache updated successfully', 'system', {
      context: 'User stats cached in Redis for 10 minutes',
      user_id
    });

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      user_id,
      ttl: 600
    });

  } catch (error) {
    logger.logError('WEBHOOK', 'POST /api/internal/refresh-user-stats-cache', error, 'system', {
      context: 'Failed to update user stats cache from webhook'
    });

    return NextResponse.json({ 
      error: 'Failed to update user stats cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

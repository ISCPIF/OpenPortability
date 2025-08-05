import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';

export async function POST(request: NextRequest) {
  try {
    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-mastodon-cache', 'Starting Mastodon cache refresh', 'system', {
      context: 'Mastodon cache refresh triggered by PostgreSQL trigger'
    });

    // Récupérer les instances depuis la DB
    const { data: instances, error } = await supabase
      .from('mastodon_instances')
      .select('instance')
      .order('instance');

    if (error) {
      logger.logError('WEBHOOK', 'POST /api/internal/refresh-mastodon-cache', error, 'system', {
        context: 'Database error while fetching instances for cache refresh'
      });
      return NextResponse.json({ error: 'Failed to fetch instances' }, { status: 500 });
    }

    const instancesList = instances?.map(row => row.instance) || [];

    // Mettre à jour Redis sans TTL (cache permanent, invalidé uniquement par trigger)
    await redis.set('mastodon:instances', JSON.stringify(instancesList));

    logger.logInfo('WEBHOOK', 'POST /api/internal/refresh-mastodon-cache', 'Mastodon cache updated successfully', 'system', {
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
    logger.logError('WEBHOOK', 'POST /api/internal/refresh-mastodon-cache', error, 'system', {
      context: 'Failed to update Mastodon cache from webhook'
    });

    return NextResponse.json({ 
      error: 'Failed to update Mastodon cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

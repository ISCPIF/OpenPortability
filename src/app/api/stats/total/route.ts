import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { StatsService } from '@/lib/services/statsServices';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import logger, { withLogging } from '@/lib/log_utils';

async function globalStatsHandler() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repository = new StatsRepository();
    const statsService = new StatsService(repository);

    const stats = await statsService.getGlobalStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'GET /api/stats/total', error, userId, {
      context: 'Retrieving global stats'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withLogging(globalStatsHandler);
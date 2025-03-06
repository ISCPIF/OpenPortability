import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { StatsService } from '@/lib/services/statsServices';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import logger, { withLogging } from '@/lib/log_utils';

async function userStatsHandler() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session?.user?.has_onboarded) {
      if (!session?.user?.twitter_id) {
        return NextResponse.json({
          connections: {
            followers: 0,
            following: 0
          },
          matches: {
            bluesky: { total: 0, hasFollowed: 0, notFollowed: 0 },
            mastodon: { total: 0, hasFollowed: 0, notFollowed: 0 }
          }
        });
      }
      
    }

    const repository = new StatsRepository();
    const statsService = new StatsService(repository);
    
    const stats = await statsService.getUserStats(session.user.id, session.user.has_onboarded);
    return NextResponse.json(stats);
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'GET /api/stats', error, userId, {
      context: 'Retrieving user stats'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = withLogging(userStatsHandler);
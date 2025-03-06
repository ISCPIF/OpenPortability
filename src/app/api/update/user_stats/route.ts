import { NextResponse } from 'next/server';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import { StatsService } from '@/lib/services/statsServices';
import { auth } from '@/app/auth';
import logger, { withLogging } from '@/lib/log_utils';

async function updateUserStatsHandler() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/update/user_stats', 'Unauthorized request - no user ID found in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    
    const statsRepository = new StatsRepository();
    const statsService = new StatsService(statsRepository);
  
    await statsService.refreshUserStats(session.user.id, session.user.has_onboarded);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UserStats] Error updating user stats:', error);
    if (error instanceof Error) {
      console.error('[UserStats] Error details:', error.message);
    }
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/update/user_stats', error, userId, {
      context: 'Updating user stats'
    });
    return NextResponse.json(
      { error: 'Failed to update user stats' },
      { status: 500 }
    );
  }
}

export const POST = withLogging(updateUserStatsHandler);
import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { MatchingService } from '@/lib/services/matchingService';
import logger, { withLogging } from '@/lib/log_utils';

async function matchingFoundHandler() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'GET /api/migrate/matching_found', 'Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const matchingService = new MatchingService();
    let result;

    if (!session.user?.has_onboarded) {
      if (!session?.user?.twitter_id) {
        logger.logWarning('API', 'GET /api/migrate/matching_found', 'Twitter ID not found in session', session.user.id);
        return NextResponse.json(
          { error: 'Twitter ID not found in session' },
          { status: 400 }
        );
      }
      result = await matchingService.getSourcesFromFollower(session.user.twitter_id);
    } else {
      result = await matchingService.getFollowableTargets(session.user.id);
    }
    return NextResponse.json({ matches: result });

  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'GET /api/migrate/matching_found', error, userId, {
      context: 'Error in matching_found route'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withLogging(matchingFoundHandler);
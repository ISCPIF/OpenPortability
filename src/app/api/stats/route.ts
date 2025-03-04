import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { StatsService } from '@/lib/services/statsServices';
import { StatsRepository } from '@/lib/repositories/statsRepository';

export async function GET() {
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
    console.log('[Stats] Stats retrieved successfully:', stats);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error in stats endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
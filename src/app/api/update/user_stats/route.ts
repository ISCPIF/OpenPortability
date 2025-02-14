import { NextResponse } from 'next/server';
import { StatsRepository } from '@/lib/repositories/statsRepository';
import { StatsService } from '@/lib/services/statsServices';
import { auth } from '@/app/auth';

export async function POST() {
  console.log('[UserStats] Starting user stats update request');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.warn('[UserStats] Unauthorized request - no user ID found in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[UserStats] Processing update for user ID: ${session.user.id}`);
    
    const statsRepository = new StatsRepository();
    const statsService = new StatsService(statsRepository);
    
    console.log('[UserStats] Initiating stats refresh');
    await statsService.refreshUserStats(session.user.id);
    console.log('[UserStats] Stats refresh completed successfully');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UserStats] Error updating user stats:', error);
    if (error instanceof Error) {
      console.error('[UserStats] Error details:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to update user stats' },
      { status: 500 }
    );
  }
}
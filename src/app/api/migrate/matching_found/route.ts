import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { MatchingService } from '@/lib/services/matchingService';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const matchingService = new MatchingService();
    const result = await matchingService.getFollowableTargets(session.user.id);

    return NextResponse.json({ matches: result });

  } catch (error) {
    console.error('Error in matching_found route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
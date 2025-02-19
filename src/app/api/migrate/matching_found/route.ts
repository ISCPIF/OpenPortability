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
    let result;

    if (!session.user?.has_onboarded) {
      if (!session?.user?.twitter_id) {
        return NextResponse.json(
          { error: 'Twitter ID not found in session' },
          { status: 400 }
        );
      }
      result = await matchingService.getSourcesFromFollower(session.user.twitter_id);
    } else {
      result = await matchingService.getFollowableTargets(session.user.id);
    }

    console.log("results from route -->", result)

    return NextResponse.json({ matches: result });

  } catch (error) {
    console.error('Error in matching_found route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
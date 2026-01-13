import { NextResponse } from 'next/server';
import { pgGraphNodesRepository } from '@/lib/repositories/public/pg-graph-nodes-repository';
import { auth } from '@/app/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/graph/consent_labels/user
 * 
 * Returns the current user's graph label consent level
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const consentLevel = await pgGraphNodesRepository.getNameConsent(userId);

    return NextResponse.json({
      success: true,
      consent_level: consentLevel || 'no_consent',
    });
  } catch (error) {
    console.error('Error fetching user consent:', error);
    return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 });
  }
}

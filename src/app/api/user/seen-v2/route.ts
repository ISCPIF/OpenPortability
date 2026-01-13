import { NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { queryNextAuth } from '@/lib/database';

/**
 * POST /api/user/seen-v2
 * Mark the current user as having seen the V2 intro overlay
 */
export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update the user's have_seen_v2 flag
    await queryNextAuth(
      `UPDATE users SET have_seen_v2 = true WHERE id = $1`,
      [session.user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark user as seen V2:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

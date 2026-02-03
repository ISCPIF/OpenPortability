import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withValidation } from '@/lib/validation/middleware';
import { UserService } from '@/lib/services/userServices';
import logger from '@/lib/log_utils';

const userService = new UserService();

// Empty schema for POST requests with no body
const EmptySchema = z.object({}).strict();

async function seenV2Handler(
  request: NextRequest,
  _data: z.infer<typeof EmptySchema>,
  session: any
) {
  try {
    const userId = session.user.id;

    await userService.updateHaveSeenV2(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    const err = error instanceof Error ? error : new Error(String(error));

    logger.logError('API', 'POST /api/users/seen-v2', err, userId, {
      context: 'Updating have_seen_v2 flag'
    });

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const POST = withValidation(
  EmptySchema,
  seenV2Handler,
  {
    requireAuth: true,
    applySecurityChecks: false,
    validateQueryParams: true
  }
);

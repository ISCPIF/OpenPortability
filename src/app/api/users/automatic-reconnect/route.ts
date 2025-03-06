import { NextResponse } from 'next/server';
import { auth } from "@/app/auth";
import { authClient } from '@/lib/supabase'
import logger, { withLogging } from '@/lib/log_utils';

async function automaticReconnectHandler(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/users/automatic-reconnect', 'Unauthorize','anonymous');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { automatic_reconnect } = await request.json();

    if (typeof automatic_reconnect !== 'boolean') {
      logger.logWarning('API', 'POST /api/users/automatic-reconnect', 'Invalid value for automatic_reconnect', session.user.id);
      return NextResponse.json({ error: 'Invalid value for automatic_reconnect' }, { status: 400 });
    }

    // Mettre à jour dans Supabase
    const { error: updateError } = await authClient
      .from('users')
      .update({ automatic_reconnect })
      .eq('id', session.user.id);

    if (updateError) {
      logger.logError('API', 'POST /api/users/automatic-reconnect', updateError, session.user.id, {
        context: 'Updating automatic_reconnect setting'
      });
      return NextResponse.json({ error: 'Failed to update automatic_reconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true, automatic_reconnect });

  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/users/automatic-reconnect', error, userId, {
      context: 'Processing automatic reconnect request'
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const POST = withLogging(automaticReconnectHandler);
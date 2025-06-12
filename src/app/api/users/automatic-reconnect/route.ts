import { NextResponse } from 'next/server';
import { authClient } from '@/lib/supabase';
import logger from '@/lib/log_utils';
import { z } from 'zod';
import { withValidation } from '@/lib/validation/middleware';

// Schéma pour la validation des requêtes POST
const AutomaticReconnectSchema = z.object({
  automatic_reconnect: z.boolean()
}).strict();

// Handler pour mettre à jour le paramètre automatic_reconnect
async function automaticReconnectHandler(
  request: Request,
  data: z.infer<typeof AutomaticReconnectSchema>,
  session: any
) {
  try {
    const userId = session.user.id;
    const { automatic_reconnect } = data;

    // Mettre à jour dans Supabase
    const { error: updateError } = await authClient
      .from('users')
      .update({ automatic_reconnect })
      .eq('id', userId);

    if (updateError) {
      logger.logError('API', 'POST /api/users/automatic-reconnect', updateError, userId, {
        context: 'Updating automatic_reconnect setting'
      });
      return NextResponse.json({ error: 'Failed to update automatic_reconnect' }, { status: 500 });
    }

    logger.logInfo('API', 'POST /api/users/automatic-reconnect', 'Automatic reconnect setting updated', userId, {
      automatic_reconnect
    });
    
    return NextResponse.json({ success: true, automatic_reconnect });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    
    logger.logError('API', 'POST /api/users/automatic-reconnect', error, userId, {
      context: 'Processing automatic reconnect request'
    });
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Export du handler avec middleware de validation
export const POST = withValidation(
  AutomaticReconnectSchema,
  automaticReconnectHandler,
  {
    requireAuth: true,
    applySecurityChecks: true,
    validateQueryParams: true
  }
);
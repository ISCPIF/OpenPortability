import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { UserService } from '@/lib/services/userServices';
import logger, { withLogging } from '@/lib/log_utils';

/**
 * Gestionnaire GET pour récupérer les préférences newsletter et les consentements actifs d'un utilisateur
 */
async function newsletterConsentsHandler(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'GET /api/newsletter/request', 'Unauthorized attempt to get consent data', 'anonymous');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userService = new UserService();
    
    // Récupérer les consentements actifs
    const consents = await userService.getUserActiveConsents(session.user.id);
    
    return NextResponse.json({
      success: true,
      data: consents
    });
    
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'GET /api/newsletter/request', error, userId);
    
    return NextResponse.json(
      { error: 'Failed to retrieve consent data' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(newsletterConsentsHandler);
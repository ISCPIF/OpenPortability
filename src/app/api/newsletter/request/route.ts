import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { UserService } from '@/lib/services/userServices';
import logger, { withLogging } from '@/lib/log_utils';

// Type pour les requêtes de mise à jour
type UpdateRequest = {
  type: string;
  value: boolean;
};

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
    
    // Récupérer à la fois les préférences et les consentements actifs
    const [preferences, consents] = await Promise.all([
      userService.getNewsletterPreferences(session.user.id),
      userService.getUserActiveConsents(session.user.id)
    ]);
    
    // Fusionner les données
    const response = {
      ...preferences,
      consents: {
        email_newsletter: preferences.hqx_newsletter,
        bluesky_dm: consents.bluesky_dm || false,
        mastodon_dm: consents.mastodon_dm || false,
        research_participation: preferences.research_accepted,
        oep_newsletter: preferences.oep_accepted,
        hqx_newsletter: preferences.hqx_newsletter
      }
    };
    
    return NextResponse.json({
      success: true,
      data: response
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

/**
 * Gestionnaire POST pour mettre à jour les consentements d'un utilisateur
 */
async function updateNewsletterConsentsHandler(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/newsletter/request', 'Unauthorized attempt to update consent', 'anonymous');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json() as UpdateRequest;
    
    if (!body.type || typeof body.value !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const userService = new UserService();
    await userService.updateConsent(session.user.id, body.type, body.value);
    
    return NextResponse.json({
      success: true,
      message: 'Consent updated successfully'
    });
    
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/newsletter/request', error, userId);
    
    return NextResponse.json(
      { error: 'Failed to update consent' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(newsletterConsentsHandler);
export const POST = withLogging(updateNewsletterConsentsHandler);
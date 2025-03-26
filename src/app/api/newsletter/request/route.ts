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
  console.log('🚀 GET /api/newsletter/request - Start');
  try {
    const session = await auth();
    console.log('📝 Session:', session?.user?.id ? 'Authenticated' : 'Not authenticated');
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'GET /api/newsletter/request', 'Unauthorized attempt to get consent data', 'anonymous');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userService = new UserService();
    console.log('🔍 Fetching data for user:', session.user.id);
    
    // Récupérer à la fois les préférences et les consentements actifs
    const [preferences, consents] = await Promise.all([
      userService.getNewsletterPreferences(session.user.id),
      userService.getUserActiveConsents(session.user.id)
    ]);
    
    console.log('📊 Raw data:', { preferences, consents });
    
    // Fusionner les données
    const response = {
      ...preferences,
      consents: {
        email_newsletter: preferences.hqx_newsletter,
        personalized_support: consents.bluesky_dm || consents.mastodon_dm || false,
        research_participation: preferences.research_accepted,
        oep_newsletter: preferences.oep_accepted
      }
    };
    
    console.log('✅ GET /api/newsletter/request - Success:', response);
    return NextResponse.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('❌ GET /api/newsletter/request - Error:', error);
    logger.logError('API', 'GET /api/newsletter/request', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Gestionnaire POST pour mettre à jour les consentements
 */
async function updateConsentHandler(request: NextRequest) {
  console.log('🚀 POST /api/newsletter/request - Start');
  try {
    const session = await auth();
    console.log('📝 Session:', session?.user?.id ? 'Authenticated' : 'Not authenticated');
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/newsletter/request', 'Unauthorized attempt to update consent', 'anonymous');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('📦 Request body:', body);
    
    const userService = new UserService();
    
    // Récupérer les métadonnées de la requête
    const metadata = {
      ip_address: request.headers.get('x-forwarded-for') || request.ip || '',
      user_agent: request.headers.get('user-agent') || ''
    };

    // Vérifier si on vient du dashboard
    const referer = request.headers.get('referer') || '';
    const isDashboard = referer.includes('/dashboard');
    
    // Mettre à jour l'email dans next-auth.users si fourni
    if (body.email) {
      await userService.updateEmail(session.user.id, body.email);
    }

    if (isDashboard) {
      await userService.updateHaveSeenNewsletter(session.user.id);
    }
    
    // Gérer plusieurs consentements en une fois
    if (Array.isArray(body.consents)) {
      console.log('🔄 Updating multiple consents:', body.consents);
      await Promise.all(
        body.consents.map(async (consent: { type: string; value: boolean }) => {
          await userService.updateConsent(session.user.id, consent.type, consent.value, metadata);
        })
      );
    } else if (body.type) {
      // Rétrocompatibilité pour un seul consentement
      console.log('🔄 Updating single consent:', body.type, body.value);
      await userService.updateConsent(session.user.id, body.type, body.value, metadata);
    } else {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    console.log('✅ POST /api/newsletter/request - Success');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/newsletter/request - Error:', error);
    logger.logError('API', 'POST /api/newsletter/request', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(newsletterConsentsHandler);
export const POST = withLogging(updateConsentHandler);
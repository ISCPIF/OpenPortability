import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';
import { UserService } from '@/lib/services/userServices';
import logger, { withLogging } from '@/lib/log_utils';
import { 
  safeUrlDecode,
  detectSqlInjectionPatterns,
  validateDataTypes,
  escapeSqlString,
  validateEmail,
  isValidConsentType,
  VALID_CONSENT_TYPES,
  escapeHtml,
  sanitizeHtml,
  detectDangerousContent
} from '@/lib/security-utils';



// Type pour les requêtes de mise à jour
type UpdateRequest = {
  type: string;
  value: boolean;
};

/**
 * Gestionnaire GET pour récupérer les préférences newsletter et les consentements actifs d'un utilisateur
 */
async function newsletterConsentsHandler(request: NextRequest) {
  // console.log('🚀 GET /api/newsletter/request - Start');
  try {
    const session = await auth();
    // console.log('📝 Session:', session?.user?.id ? 'Authenticated' : 'Not authenticated');
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'GET /api/newsletter/request', 'Unauthorized attempt to get consent data', 'anonymous');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userService = new UserService();
    // console.log('🔍 Fetching data for user:', session.user.id);
    
    // Ne récupérer que les consentements actifs et l'email
    const [consents] = await Promise.all([
      // userService.getUser(session.user.id),
      userService.getUserActiveConsents(session.user.id)
    ]);
    
    // console.log('📊 Raw data:', { consents });
    
    // Retourner uniquement les consentements et l'email
    const response = {
      email: session.user?.email,
      ...consents
    };
    
    // console.log('✅ GET /api/newsletter/request - Success:', response);
    return NextResponse.json(response);
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
  // console.log('🚀 POST /api/newsletter/request - Start');
  try {
    const session = await auth();
    // console.log('📝 Session:', session?.user?.id ? 'Authenticated' : 'Not authenticated');
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'POST /api/newsletter/request', 'Unauthorized attempt to update consent', 'anonymous');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    // console.log('📦 Request body:', body);
    
    // Vérifier une tentative de pollution de prototype
    if (body && (
      Object.hasOwnProperty.call(body, '__proto__') || 
      Object.hasOwnProperty.call(body, 'constructor') || 
      Object.hasOwnProperty.call(body, 'prototype')
    )) {
      logger.logWarning('Security', 'Prototype Pollution', 'Blocked prototype pollution attempt', session.user.id, {
        path: '/api/newsletter/request',
        ip: request.headers.get('x-forwarded-for') || request.ip || ''
      });
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
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
      // Validation de sécurité de l'email
      const emailValidation = validateEmail(body.email);
      if (!emailValidation.isValid) {
        logger.logWarning('Security', 'Invalid email', emailValidation.error || 'Email validation failed', session.user.id, {
          context: 'Newsletter subscription',
          userAgent: metadata.user_agent,
          clientIP: metadata.ip_address
        });
        return NextResponse.json(
          { error: emailValidation.error || 'Email validation failed' },
          { status: 400 }
        );
      }
      
      // Double protection: Échapper à la fois les caractères SQL et HTML
      const safeEmail = escapeSqlString(escapeHtml(body.email));
      // console.log('🔄 Updating email:', body.email, session.user.id);
      await userService.updateEmail(session.user.id, safeEmail);
    }

    if (isDashboard) {
      await userService.updateHaveSeenNewsletter(session.user.id);
    }
    
    // Gérer plusieurs consentements en une fois
    if (body.consents && Array.isArray(body.consents)) {
      // Valider le format et les données de chaque consentement
      for (const consent of body.consents) {
        if (typeof consent !== 'object' || 
            typeof consent.type !== 'string' ||
            typeof consent.value !== 'boolean') {
          return NextResponse.json(
            { error: 'Invalid consent format' },
            { status: 400 }
          );
        }
        
        // Vérifier si le type de consentement est autorisé
        if (!isValidConsentType(consent.type)) {
          logger.logWarning('Security', 'Invalid consent type', `Blocked invalid consent type: ${consent.type}`, session.user.id);
          return NextResponse.json(
            { error: 'Invalid consent type' },
            { status: 400 }
          );
        }
        
        // Vérifier les injections SQL dans le type
        if (detectSqlInjectionPatterns(consent.type)) {
          logger.logWarning('Security', 'SQL Injection', 'Blocked SQL injection in consent type', session.user.id);
          return NextResponse.json(
            { error: 'Invalid consent data' },
            { status: 400 }
          );
        }
        
        // Vérifier les patterns XSS sur le type de consentement
        if (detectDangerousContent(consent.type)) {
          logger.logWarning('Security', 'XSS attempt', 'Blocked XSS attempt in consent type', session.user.id);
          return NextResponse.json(
            { error: 'Invalid consent data' },
            { status: 400 }
          );
        }
      }
      
      // console.log('🔄 Updating multiple consents:', body.consents);
      await Promise.all(
        body.consents.map(async (consent: { type: string; value: boolean }) => {
          // Double protection: Échapper à la fois les caractères SQL et HTML
          const safeType = escapeSqlString(escapeHtml(consent.type));
          await userService.updateConsent(session.user.id, safeType, consent.value, metadata);
        })
      );
    } else if (body.type) {
      // Sécuriser le type de consentement
      if (typeof body.type !== 'string' || typeof body.value !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid consent format' },
          { status: 400 }
        );
      }
      
      // Vérifier si le type de consentement est autorisé
      if (!isValidConsentType(body.type)) {
        logger.logWarning('Security', 'Invalid consent type', `Blocked invalid consent type: ${body.type}`, session.user.id);
        return NextResponse.json(
          { error: 'Invalid consent type' },
          { status: 400 }
        );
      }
      
      // Vérifier les injections SQL dans le type
      if (detectSqlInjectionPatterns(body.type)) {
        logger.logWarning('Security', 'SQL Injection', 'Blocked SQL injection in consent type', session.user.id);
        return NextResponse.json(
          { error: 'Invalid consent data' },
          { status: 400 }
        );
      }
      
      // Vérifier les patterns XSS sur le type de consentement
      if (detectDangerousContent(body.type)) {
        logger.logWarning('Security', 'XSS attempt', 'Blocked XSS attempt in consent type', session.user.id);
        return NextResponse.json(
          { error: 'Invalid consent data' },
          { status: 400 }
        );
      }
      
      // Rétrocompatibilité pour un seul consentement
      const safeType = escapeSqlString(escapeHtml(body.type));
      await userService.updateConsent(session.user.id, safeType, body.value, metadata);
    } else {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    // console.log('✅ POST /api/newsletter/request - Success');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ POST /api/newsletter/request - Error:', error);
    logger.logError('API', 'POST /api/newsletter/request', error);
    
    // Retourner l'erreur avec plus de détails
    return NextResponse.json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      }
    }, { status: 500 });
  }
}

export const GET = withLogging(newsletterConsentsHandler);
export const POST = withLogging(updateConsentHandler);
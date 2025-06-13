import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userServices';
import logger from '@/lib/log_utils';
import { validateEmail } from '@/lib/security-utils';
import { withValidation } from '@/lib/validation/middleware';
import { 
  NewsletterRequestSchema, 
  ConsentTypeSchema, 
  type NewsletterRequest 
} from '@/lib/validation/schemas';
import { escapeSqlString, escapeHtml } from '@/lib/security-utils';
import { z } from 'zod';

// Schéma vide pour les requêtes GET qui n'ont pas de body
const EmptySchema = z.object({}).strict();
type EmptyRequest = Record<string, never>;

/**
 * Gestionnaire GET pour récupérer les préférences newsletter et les consentements actifs d'un utilisateur
 */
async function newsletterConsentsHandler(
  request: NextRequest, 
  _data: EmptyRequest, 
  session: any
) {
  try {
    const userService = new UserService();
    
    // Ne récupérer que les consentements actifs
    const [consents] = await Promise.all([
      userService.getUserActiveConsents(session.user.id)
    ]);
    
    // Retourner uniquement les consentements et l'email
    const response = {
      email: session.user?.email,
      ...consents
    };
    
    console.log('API', 'GET /api/newsletter/request', 'Success', session.user.id, {
      hasConsents: Object.keys(consents).length > 0
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.log('API', 'GET /api/newsletter/request', error, session?.user?.id);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Gestionnaire POST pour mettre à jour les consentements
 */
async function updateConsentHandler(
  request: NextRequest, 
  data: NewsletterRequest, 
  session: any
) {
  try {
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
    if (data.email) {
      // Validation de sécurité supplémentaire de l'email
      const emailValidation = validateEmail(data.email);
      if (!emailValidation.isValid) {
        console.log('Security', 'Invalid email format', `Blocked invalid email: ${data.email}`, session.user.id);
        return NextResponse.json(
          { error: emailValidation.error || 'Invalid email format' },
          { status: 400 }
        );
      }
      
      console.log('API', 'POST /api/newsletter/request', 'Updating email', session.user.id, {
        fromDashboard: isDashboard
      });
      
      await userService.updateEmail(session.user.id, data.email);
    }
    
    // Normaliser les consentements en un tableau pour traitement uniforme
    let consentsToUpdate: { type: string, value: boolean }[] = [];
    
    // Format 1: Consentement unique directement dans l'objet racine
    if ('type' in data && 'value' in data) {
      consentsToUpdate = [{ type: data.type, value: data.value }];
      console.log('API', 'POST /api/newsletter/request', 'Updating single consent', session.user.id, {
        consentType: data.type,
        fromDashboard: isDashboard
      });
    } 
    // Format 2: Tableau de consentements
    else if (data.consents && Array.isArray(data.consents)) {
      consentsToUpdate = data.consents;
      console.log('API', 'POST /api/newsletter/request', 'Updating multiple consents', session.user.id, {
        consentCount: data.consents.length,
        fromDashboard: isDashboard
      });
    }
    
    // Mettre à jour tous les consentements
    await Promise.all(
      consentsToUpdate.map(async (consent) => {
        // Double protection: Échapper à la fois les caractères SQL et HTML
        const safeType = escapeSqlString(escapeHtml(consent.type));
        await userService.updateConsent(session.user.id, safeType, consent.value, metadata);
      })
    );
    
    console.log('API', 'POST /api/newsletter/request', 'Success', session.user.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.log('API', 'POST /api/newsletter/request', error, session?.user?.id);
    
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

// Configuration des options de validation
const getOptions = {
  requireAuth: true,
  applySecurityChecks: false, // Pas de body à vérifier pour GET
  skipRateLimit: false
};

const postOptions = {
  requireAuth: true,
  applySecurityChecks: true,
  skipRateLimit: false
};

// Exporter les handlers avec validation
export const GET = withValidation(EmptySchema, newsletterConsentsHandler, getOptions);
export const POST = withValidation(NewsletterRequestSchema, updateConsentHandler, postOptions);
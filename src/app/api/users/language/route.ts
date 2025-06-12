import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/auth";
import { UserService } from '@/lib/services/userServices';
import { z } from 'zod';
import { withValidation } from '@/lib/validation/middleware';
import logger from '@/lib/log_utils';

const userService = new UserService();

// Schéma vide pour les requêtes GET sans body
const EmptySchema = z.object({}).strict();

// Schéma pour la validation des requêtes POST
const LanguageSchema = z.object({
  language: z.string().min(2).max(10)
    .refine(val => /^[a-z]{2}(-[A-Z]{2})?$/.test(val), {
      message: "Language must be in format 'xx' or 'xx-XX'"
    })
}).strict();

// Handler pour récupérer la préférence de langue
async function getLanguageHandler(
  request: NextRequest,
  data: z.infer<typeof EmptySchema>,
  session: any
) {
  try {
    const userId = session.user.id;
    
    const languagePref = await userService.getLanguagePreference(userId);
    
    console.log('API', 'GET /api/users/language', 'Language preference retrieved', userId);
    return NextResponse.json(languagePref);
  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    
    console.log('API', 'GET /api/users/language', error, userId, {
      context: 'Getting language preference'
    });
    
    return NextResponse.json(
      { error: 'Failed to get language preference' },
      { status: 500 }
    );
  }
}

// Handler pour mettre à jour la préférence de langue
async function updateLanguageHandler(
  request: NextRequest,
  data: z.infer<typeof LanguageSchema>,
  session: any
) {
  try {
    const userId = session.user.id;
    const { language } = data;
    
    await userService.updateLanguagePreference(userId, language);
    
    console.log('API', 'POST /api/users/language', 'Language preference updated', userId, {
      language
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    
    console.log('API', 'POST /api/users/language', error, userId, {
      context: 'Updating language preference'
    });
    
    return NextResponse.json(
      { error: 'Failed to update language preference' },
      { status: 500 }
    );
  }
}

// Export des handlers avec middleware de validation
export const GET = withValidation(
  EmptySchema,
  getLanguageHandler,
  {
    requireAuth: true,
    applySecurityChecks: false,  // Pas de body à valider pour GET
    validateQueryParams: true
  }
);

export const POST = withValidation(
  LanguageSchema,
  updateLanguageHandler,
  {
    requireAuth: true,
    applySecurityChecks: true,
    validateQueryParams: true
  }
);
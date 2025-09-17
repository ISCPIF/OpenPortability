import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { BlueskyService } from "@/lib/services/blueskyServices"
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import logger, { withLogging } from '@/lib/log_utils'
import { withValidation } from '@/lib/validation/middleware'
import { z } from 'zod'



/**
 * DELETE handler - Déconnexion Bluesky
 * Nécessite une authentification
 */
const blueskyDeleteHandler = withValidation(
  z.object({}), // Schema vide pour DELETE
  async (request: NextRequest, data: {}, session) => {
    
    try {
      if (!supabaseAdapter.deleteSession) {
        const error = new Error('Required adapter methods are not implemented');
        logger.logError('API', 'DELETE /api/auth/bluesky', error);
        throw error;
      }
      
      // Session déjà vérifiée par le middleware
      const userId = session!.user.id;

      // Get CSRF token from request headers
      const csrfToken = request.headers.get('x-csrf-token');
      if (!csrfToken) {
        logger.logError('API', 'DELETE /api/auth/bluesky', 'Logout attempt without CSRF token', userId);
        return NextResponse.json(
          { error: 'CSRF token missing' },
          { status: 403 }
        );
      }
      // Delete the session from the database
      await supabaseAdapter.deleteSession(userId);

      // Clear cookies via response headers below
      return NextResponse.json(
        { success: true },
        {
          headers: {
            'Set-Cookie': [
              'next-auth.session-token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
              'next-auth.csrf-token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
              'next-auth.callback-url=; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
            ].join(', ')
          }
        }
      );
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('API', 'DELETE /api/auth/bluesky', errorString, session?.user?.id || 'unknown', { 
        message: 'Logout failed' 
      });
      return NextResponse.json(
        { error: 'Logout failed' },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true, // Nécessite une authentification
    applySecurityChecks: false, // Pas de body à vérifier pour DELETE
    skipRateLimit: true // Pas de rate limit pour la déconnexion
  }
);

// Export wrapped handler functions with logging middleware
export const DELETE = withLogging(blueskyDeleteHandler);
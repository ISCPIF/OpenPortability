import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/auth"
import { BlueskyService } from "@/lib/services/blueskyServices"
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import logger, { withLogging } from '@/lib/log_utils'
import { withPublicValidation, withValidation } from '@/lib/validation/middleware'
import { AuthCredentialsSchema, type AuthCredentials } from '@/lib/validation/schemas'
import { cookies } from 'next/headers'
import { z } from 'zod'

const blueskyRepository = new BlueskyRepository()
const blueskyService = new BlueskyService(blueskyRepository)

/**
 * POST handler - Authentification Bluesky
 * Endpoint public qui ne nécessite pas d'authentification préalable
 * Utilise le nouveau middleware de validation
 */
const blueskyPostHandler = withPublicValidation(
  AuthCredentialsSchema,
  async (request: NextRequest, data: AuthCredentials) => {
    console.log('[Bluesky POST] Handler started with validated credentials');
    
    try {    
      const { identifier, password } = data;
      const session = await auth();
      let userId = session?.user?.id ? session?.user?.id : "anonymous";

      // Authentification Bluesky
      console.log('[Bluesky POST] Attempting Bluesky authentication');
      const authResult = await blueskyService.login(identifier, password);
      
      if (!authResult.success || !authResult.data) {
        console.log('API', 'POST /api/auth/bluesky', 'Bluesky authentication failed', userId, { error: authResult.error });
        return NextResponse.json(
          { success: false, error: authResult.error },
          { status: 401 }
        );
      }
      
      console.log('[Bluesky POST] Authentication successful, fetching profile');
      const profile = await blueskyService.getProfile(authResult.data.handle);

      // Vérification si l'utilisateur existe avec cet ID Bluesky
      const existingUser = await blueskyRepository.getUserByBlueskyId(authResult.data.did);
      userId = existingUser ? existingUser.id : userId;
      
      if (existingUser) {
        // Si le compte Bluesky est déjà lié à un autre utilisateur
        if (userId !== "anonymous" && existingUser.id !== userId) {
          console.log('API', 'POST /api/auth/bluesky', 'Bluesky account already linked to another user', undefined, { 
            blueskyId: authResult.data.did, 
            userId, 
            existingUserId: existingUser.id 
          });
          return NextResponse.json(
            { success: false, error: 'This Bluesky account is already linked to another user' },
            { status: 409 }
          );
        }
        
        // L'utilisateur existe, mise à jour du profil
        userId = existingUser.id;
        console.log('[Bluesky POST] Updating existing user profile');
        console.log('API', 'POST /api/auth/bluesky', 'Updating existing Bluesky profile', userId);
        await blueskyRepository.updateBlueskyProfile(userId, profile);
        await blueskyRepository.linkBlueskyAccount(userId, authResult.data);
        
      } else if (userId && userId !== "anonymous") {
        // L'utilisateur est connecté mais pas lié à ce compte Bluesky
        console.log('[Bluesky POST] Linking Bluesky account to existing user');
        console.log('API', 'POST /api/auth/bluesky', 'Linking Bluesky account to existing user', userId);
        await blueskyRepository.updateBlueskyProfile(userId, profile);
        await blueskyRepository.linkBlueskyAccount(userId, authResult.data);
        
      } else {
        // Création d'un nouvel utilisateur
        console.log('[Bluesky POST] Creating new user from Bluesky account');
        console.log('API', 'POST /api/auth/bluesky', 'Creating new user from Bluesky account', undefined, { 
          handle: authResult.data.handle 
        });
        
        const user = await supabaseAdapter.createUser({
          provider: 'bluesky',
          profile: {
            did: authResult.data.did,
            handle: authResult.data.handle,
            displayName: profile.displayName,
            avatar: profile.avatar
          }
        });
        userId = user.id;
        await blueskyRepository.linkBlueskyAccount(userId, authResult.data);
      }
      
      console.log('[Bluesky POST] Process completed successfully');
      return NextResponse.json({
        success: true,
        user: {
          id: userId,
          bluesky_id: authResult.data.did,
          bluesky_username: authResult.data.handle,
          bluesky_image: profile.avatar,
        }
      });
      
    } catch (error: any) {
      console.log('API', 'POST /api/auth/bluesky', error, undefined, { 
        message: 'Error in Bluesky auth route' 
      });
      
      if (error instanceof Error && error.message === 'Token could not be verified') {
        return NextResponse.json({ error: 'InvalidToken' }, { status: 500 });
      }
    
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  {
    applySecurityChecks: true, // Active les vérifications SQL/XSS sur les credentials
    customRateLimit: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 tentatives par fenêtre
      identifier: 'ip'
    }
  }
);

/**
 * DELETE handler - Déconnexion Bluesky
 * Nécessite une authentification
 */
const blueskyDeleteHandler = withValidation(
  z.object({}), // Schema vide pour DELETE
  async (request: NextRequest, data: {}, session) => {
    console.log('[Bluesky DELETE] Logout handler started');
    
    try {
      if (!supabaseAdapter.deleteSession) {
        const error = new Error('Required adapter methods are not implemented');
        console.log('API', 'DELETE /api/auth/bluesky', error);
        throw error;
      }
      
      // Session déjà vérifiée par le middleware
      const userId = session!.user.id;

      // Get CSRF token from request headers
      const csrfToken = request.headers.get('x-csrf-token');
      if (!csrfToken) {
        console.log('API', 'DELETE /api/auth/bluesky', 'Logout attempt without CSRF token', userId);
        return NextResponse.json(
          { error: 'CSRF token missing' },
          { status: 403 }
        );
      }

      console.log('[Bluesky DELETE] Deleting session from database');
      // Delete the session from the database
      await supabaseAdapter.deleteSession(userId);

      const cookieStore = cookies();
      
      // Clear session cookies
      cookieStore.delete('next-auth.session-token');
      cookieStore.delete('next-auth.csrf-token');
      cookieStore.delete('next-auth.callback-url');

      console.log('[Bluesky DELETE] Logout successful');
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
      console.log('API', 'DELETE /api/auth/bluesky', error, session?.user?.id || 'unknown', { 
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
export const POST = withLogging(blueskyPostHandler);
export const DELETE = withLogging(blueskyDeleteHandler);
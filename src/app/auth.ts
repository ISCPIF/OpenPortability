import NextAuth from "next-auth"
import type { Profile } from "next-auth"
import { authConfig } from "./auth.config"
import type { TwitterData, MastodonProfile, BlueskyProfile } from "@/lib/supabase-adapter"
import logger from '@/lib/log_utils'
import { pgMastodonInstanceRepository } from '@/lib/repositories/auth/pg-mastodon-instance-repository'

export type { TwitterData as TwitterProfile } from "@/lib/supabase-adapter"
export type { MastodonProfile }
export type { BlueskyProfile }


type MastodonAppCreds = { instance: string; client_id: string; client_secret: string }

// Error codes for Mastodon app creation
export type MastodonErrorCode = 
  | 'INSTANCE_UNREACHABLE'
  | 'INSTANCE_INVALID'
  | 'OAUTH_CREATION_FAILED'
  | 'UNKNOWN_ERROR'

export class MastodonAppError extends Error {
  code: MastodonErrorCode
  instance: string
  
  constructor(code: MastodonErrorCode, instance: string, message: string) {
    super(message)
    this.name = 'MastodonAppError'
    this.code = code
    this.instance = instance
  }
}


async function createMastodonApp(instance: string): Promise<MastodonAppCreds>{
  logger.logInfo('Auth', 'createMastodonApp', `Vérification de l'instance ${instance}`, undefined, { instance });
  
  const lcInstance = instance.toLowerCase()
  const existing = await pgMastodonInstanceRepository.getInstance(lcInstance)
  let cachedAppData: MastodonAppCreds | null = existing 
    ? { instance: existing.instance, client_id: existing.client_id, client_secret: existing.client_secret }
    : null
  
  if (!cachedAppData) {
    logger.logInfo('Auth', 'createMastodonApp', `Nouvelle instance Mastodon détectée: ${lcInstance}`, undefined, { 
      instance: lcInstance 
    });
    
    const url = `https://${lcInstance}/api/v1/apps`;
    const formData = {
      "client_name": "OpenPortability",
      "redirect_uris": `${process.env.NEXTAUTH_URL}/api/auth/callback/mastodon`,
      // TODO: limiter au strict nécessaire
      // https://docs.joinmastodon.org/api/oauth-scopes/#granular
      "scopes": "read write:follows",
      "website": "https://app.beta.v2.helloquitx.com/"
    };
    
    logger.logInfo('Auth', 'createMastodonApp', `Création d'une app OAuth pour ${lcInstance}`, undefined, { 
      instance: lcInstance, 
      redirectUri: formData.redirect_uris 
    });
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: {"Content-Type": "application/json"},
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      logger.logError('Auth', 'createMastodonApp', 
        `Instance ${lcInstance} injoignable: ${errorMessage}`, 
        undefined, 
        { instance: lcInstance, error: errorMessage }
      );
      throw new MastodonAppError(
        'INSTANCE_UNREACHABLE',
        lcInstance,
        `L'instance ${lcInstance} est injoignable. Vérifiez l'URL.`
      );
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.logError('Auth', 'createMastodonApp', 
        `Erreur lors de la création de l'app OAuth Mastodon (${response.status})`, 
        undefined, 
        { 
          instance: lcInstance, 
          status: response.status, 
          statusText: response.statusText,
          errorText
        }
      );
      
      // 404 = instance doesn't exist or doesn't support Mastodon API
      if (response.status === 404) {
        throw new MastodonAppError(
          'INSTANCE_INVALID',
          lcInstance,
          `L'instance ${lcInstance} n'existe pas ou n'est pas une instance Mastodon valide.`
        );
      }
      
      throw new MastodonAppError(
        'OAUTH_CREATION_FAILED',
        lcInstance,
        `Erreur lors de la création de l'app OAuth (${response.status}): ${errorText}`
      );
    }
    
    const json = await response.json();
    cachedAppData = {
      instance: lcInstance,
      client_id: json.client_id,
      client_secret: json.client_secret
    };
    
    logger.logInfo('Auth', 'createMastodonApp', `App OAuth créée avec succès pour ${lcInstance}`, undefined, { 
      instance: lcInstance, 
      clientId: json.client_id 
    });
    
    // Save to database (non-blocking, errors logged but not thrown)
    try {
      await pgMastodonInstanceRepository.createInstance({
        instance: lcInstance,
        client_id: json.client_id,
        client_secret: json.client_secret,
      })
      logger.logInfo('Auth', 'createMastodonApp', 
        `Instance ${lcInstance} enregistrée avec succès`, 
        undefined, 
        { instance: lcInstance }
      );
    } catch (dbError: unknown) {
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      logger.logError('Auth', 'createMastodonApp', 
        `Erreur lors de l'enregistrement des informations d'OAuth`,
        undefined, 
        { instance: lcInstance, error: errorMessage }
      );
    }
  } else {
    logger.logDebug('Auth', 'createMastodonApp', `Instance ${lcInstance} déjà enregistrée`, undefined, { 
      instance: lcInstance 
    });
  }
  
  return cachedAppData!
}

// https://authjs.dev/reference/nextjs#lazy-initialization
export const { auth, signIn, signOut, handlers } = NextAuth(async req => { 
  if (req?.url.includes("api/auth/signin/mastodon")) {
    const { searchParams } = new URL(req.url);
    const instance = searchParams.get('instance') || "mastodon.social";
    
    logger.logInfo('Auth', 'mastodonSignIn', 
      `Demande de connexion à Mastodon (instance: ${instance})`,
      undefined, 
      { instance }
    );
    
    let res: MastodonAppCreds | null = null;
    let mastodonError: MastodonAppError | null = null;
    
    try {
      res = await createMastodonApp(instance);
    } catch (error) {
      if (error instanceof MastodonAppError) {
        mastodonError = error;
        logger.logError('Auth', 'mastodonSignIn', 
          `Erreur Mastodon: ${error.code} - ${error.message}`,
          undefined, 
          { instance, errorCode: error.code }
        );
      } else {
        mastodonError = new MastodonAppError(
          'UNKNOWN_ERROR',
          instance,
          error instanceof Error ? error.message : 'Erreur inconnue'
        );
        logger.logError('Auth', 'mastodonSignIn', 
          `Erreur inattendue lors de la création de l'app Mastodon`,
          undefined, 
          { instance, error: error instanceof Error ? error.message : 'Unknown' }
        );
      }
    }
    
    const mastodonProvider = authConfig.providers.find(prov => prov.id === "mastodon");
    
    if (mastodonProvider && res) {     
      const issuer = `https://${instance}`;
      // Narrow to an OAuth-like provider before mutation to satisfy TypeScript
      const oauthProv = (mastodonProvider as unknown) as {
        id: string;
        type?: string;
        issuer?: string;
        clientId?: string;
        clientSecret?: string;
        authorization?: string | { url: string; params?: Record<string, any> };
        token?: string | { url: string };
        userinfo?: string | { url: string };
      };
      oauthProv.issuer = issuer;
      oauthProv.clientId = res.client_id;
      oauthProv.clientSecret = res.client_secret;
      const authParams = new URLSearchParams({
        scope: "read write:follows",
        force_login: "true",
      });
      oauthProv.authorization = `${issuer}/oauth/authorize?${authParams.toString()}`;
      oauthProv.token = `${issuer}/oauth/token`;
      oauthProv.userinfo = `${issuer}/api/v1/accounts/verify_credentials`;
      
      logger.logInfo('Auth', 'mastodonSignIn', 
        `Configuration du provider Mastodon pour l'instance ${instance}`,
        undefined, 
        { 
          instance,
          authorization: oauthProv.authorization
        }
      );
    } else if (mastodonError) {
      // Fallback error handling - client should have caught this via /api/auth/mastodon/verify
      // Log the error but let OAuth fail naturally (will show generic error)
      logger.logError('Auth', 'mastodonSignIn', 
        `Erreur Mastodon non interceptée côté client: ${mastodonError.code}`,
        undefined, 
        { errorCode: mastodonError.code, instance: mastodonError.instance }
      );
    } else {
      logger.logError('Auth', 'mastodonSignIn', 
        'Provider Mastodon non trouvé dans la configuration',
        undefined, 
        { instance }
      );
    }
  }
  return authConfig;
});

// Type guards
export function isTwitterProfile(profile: any): profile is TwitterData {
    return profile && 'data' in profile;
}

export function isMastodonProfile(profile: Profile): profile is MastodonProfile {
    return profile && 'url' in profile;
}

export function isBlueskyProfile(profile: Profile): profile is BlueskyProfile {
    return profile && 'handle' in profile;
}

// export function isFacebookProfile(profile: Profile): profile is FacebookProfile {
//   return profile && 'id' in profile && 'name' in profile;
// }
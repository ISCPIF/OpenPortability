import NextAuth from "next-auth"
import type { Profile } from "next-auth"
import { authConfig } from "./auth.config"
import type { TwitterData, MastodonProfile, BlueskyProfile } from "@/lib/supabase-adapter"
import { supabase } from "@/lib/supabase"
import logger from '@/lib/log_utils'

export type { TwitterData as TwitterProfile } from "@/lib/supabase-adapter"
export type { MastodonProfile }
export type { BlueskyProfile }


async function createMastodonApp(instance: string){
  logger.logInfo('Auth', 'createMastodonApp', `Vérification de l'instance ${instance}`, undefined, { instance });
  
  const { data: instances } = await supabase.from("mastodon_instances").select();
  const lcInstance = instance.toLowerCase()
  let cachedAppData = instances?.find(r => r.instance.toLowerCase() == lcInstance);
  
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
    
    try {
      logger.logInfo('Auth', 'createMastodonApp', `Création d'une app OAuth pour ${lcInstance}`, undefined, { 
        instance: lcInstance, 
        redirectUri: formData.redirect_uris 
      });
      
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: {"Content-Type": "application/json"}
      });
      
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
        throw new Error(`Error while creating the Mastodon OAuth app: ${response.status} - ${errorText}`);
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
      
      await supabase.from("mastodon_instances").insert(cachedAppData)
        .then(({ error }) => {
          if (error) {
            logger.logError('Auth', 'createMastodonApp', 
              `Erreur lors de l'enregistrement des informations d'OAuth dans Supabase`,
              undefined, 
              { instance: lcInstance, error: error.message, code: error.code }
            );
          } else {
            logger.logInfo('Auth', 'createMastodonApp', 
              `Instance ${lcInstance} enregistrée avec succès dans Supabase`, 
              undefined, 
              { instance: lcInstance }
            );
          }
        });
    } catch (error) {
      logger.logError('Auth', 'createMastodonApp', 
        error instanceof Error ? error : new Error('Unknown error during Mastodon OAuth creation'), 
        undefined, 
        { instance: lcInstance }
      );
    }
  } else {
    logger.logDebug('Auth', 'createMastodonApp', `Instance ${lcInstance} déjà enregistrée`, undefined, { 
      instance: lcInstance 
    });
  }
  
  return cachedAppData
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
    
    const res = await createMastodonApp(instance);
    const mastodonProvider = authConfig.providers.find(prov => prov.id === "mastodon");
    
    if (mastodonProvider) {     
      const issuer = `https://${instance}`;
      mastodonProvider.issuer = issuer;
      mastodonProvider.clientId = res.client_id;
      mastodonProvider.clientSecret = res.client_secret;
      const authParams = new URLSearchParams({
        scope: "read write:follows",
        force_login: "true",
      });
      mastodonProvider.authorization = `${issuer}/oauth/authorize?${authParams.toString()}`;
      mastodonProvider.token = `${issuer}/oauth/token`;
      mastodonProvider.userinfo = `${issuer}/api/v1/accounts/verify_credentials`;
      
      logger.logInfo('Auth', 'mastodonSignIn', 
        `Configuration du provider Mastodon pour l'instance ${instance}`,
        undefined, 
        { 
          instance,
          authorization: mastodonProvider.authorization
        }
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
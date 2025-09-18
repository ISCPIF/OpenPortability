import { cookies } from "next/headers";
import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import logger from "../log_utils";

// Types are not strictly required at runtime; using minimal any typing to avoid coupling
// If available, you can import NodeSavedState / NodeSavedSession from the package types.

function resolveBaseUrl() {
  const url = process.env.NEXTAUTH_URL || "";
  if (!url) return "";
  try {
    const u = new URL(url);
    // Reject IP hosts and require https
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname) || u.hostname === 'localhost';
    const isHttps = u.protocol === 'https:';
    if (isIp || !isHttps) return "";
    return u.origin;
  } catch {
    return "";
  }
}

function getClientMetadata(baseUrl: string) {
  const redirect_uris: [string, ...string[]] = [
    `${baseUrl}/api/auth/bluesky/callback`
  ];
  const response_types: ["code"] = ["code"];
  const grant_types: ["authorization_code", "refresh_token"] = [
    "authorization_code",
    "refresh_token"
  ];

  const metadata = {
    client_id: `${baseUrl}/client-metadata.json`,
    application_type: 'web' as 'web',
    client_name: "OpenPortability",
    redirect_uris,
    grant_types,
    response_types,
    scope: "atproto transition:generic",
    dpop_bound_access_tokens: true,
    token_endpoint_auth_method: 'private_key_jwt' as 'private_key_jwt',
    jwks_uri: `${baseUrl}/jwks.json`,
    token_endpoint_auth_signing_alg: "ES256",
  };
  return metadata;
}

async function getKeyset() {
  const jwkStr = process.env.BLUESKY_PRIVATE_JWK;
  if (!jwkStr) throw new Error("BLUESKY_PRIVATE_JWK is not set");
  const jwk = JSON.parse(jwkStr);
  // Provide raw private JWK; the client accepts importable JWK objects
  const key = await JoseKey.fromImportable(jwk);
  return [key];
}

export async function createBlueskyOAuthClient() {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("Invalid NEXTAUTH_URL. It must be an https hostname (not an IP or localhost).");
  }
  const client = new NodeOAuthClient({
    clientMetadata: getClientMetadata(baseUrl),
    // The library will import keys internally. Provide importable JWK(s).
    keyset: await getKeyset() as any,
    stateStore: {
      async set(key: string, internalState: any): Promise<void> {
        const name = `oauth_state_${key}`;
        const store = await cookies();
        console.log(`[BlueskyOAuth] Setting state for key: ${key}, name: ${name}`);
        try {
          const serialized = JSON.stringify(internalState);
          
          // Try multiple cookie configurations for maximum Brave compatibility
          const cookieConfigs = [
            {
              httpOnly: true,
              sameSite: "none" as const,
              secure: true,
              maxAge: 60 * 30,
              path: "/",
            },
            // Fallback configuration for development or if secure fails
            {
              httpOnly: true,
              sameSite: "lax" as const,
              secure: process.env.NODE_ENV === "production",
              maxAge: 60 * 30,
              path: "/",
            }
          ];
          
          let success = false;
          for (const config of cookieConfigs) {
            try {
              store.set(name, serialized, config);
              success = true;
              console.log(`[BlueskyOAuth] State set successfully for key: ${key} with config:`, config.sameSite);
              break;
            } catch (configError: any) {
              console.warn(`[BlueskyOAuth] Failed to set cookie with ${config.sameSite} config:`, configError.message);
            }
          }
          
          if (!success) {
            throw new Error("Failed to set cookie with any configuration");
          }
          
          // Also store in Redis as backup for Brave compatibility
          try {
            const { getRedis } = await import('../services/redisClient');
            const redis = getRedis();
            const redisKey = `oauth_state:${key}`;
            await redis.set(redisKey, serialized, 'EX', 60 * 30); // 30 minutes
            console.log(`[BlueskyOAuth] State also stored in Redis as backup for key: ${key}`);
          } catch (redisError: any) {
            console.warn(`[BlueskyOAuth] Failed to store state in Redis backup:`, redisError.message);
          }
          
        } catch (error: any) {
          console.error(`[BlueskyOAuth] Failed to set state for key: ${key}`, error.message);
          throw error;
        }
      },
      async get(key: string): Promise<any | undefined> {
        const name = `oauth_state_${key}`;
        const store = await cookies();
        console.log(`[BlueskyOAuth] Getting state for key: ${key}, name: ${name}`);
        try {
          // First try to get from cookies
          const state = store.get(name);
          if (state) {
            console.log(`[BlueskyOAuth] State found in cookies for key: ${key}, value length: ${state.value?.length || 0}`);
            const parsed = JSON.parse(state.value);
            console.log(`[BlueskyOAuth] State parsed successfully from cookies for key: ${key}`);
            return parsed;
          }
          
          // If not found in cookies, try Redis backup (for Brave compatibility)
          console.log(`[BlueskyOAuth] No state found in cookies for key: ${key}, trying Redis backup`);
          try {
            const { getRedis } = await import('../services/redisClient');
            const redis = getRedis();
            const redisKey = `oauth_state:${key}`;
            const redisState = await redis.get(redisKey);
            if (redisState) {
              console.log(`[BlueskyOAuth] State found in Redis backup for key: ${key}`);
              const parsed = JSON.parse(redisState);
              console.log(`[BlueskyOAuth] State parsed successfully from Redis for key: ${key}`);
              return parsed;
            }
          } catch (redisError: any) {
            console.warn(`[BlueskyOAuth] Failed to get state from Redis backup:`, redisError.message);
          }
          
          console.log(`[BlueskyOAuth] No state found anywhere for key: ${key}`);
          return undefined;
        } catch (error: any) {
          console.error(`[BlueskyOAuth] Failed to get/parse state for key: ${key}`, error.message);
          return undefined;
        }
      },
      async del(key: string): Promise<void> {
        const name = `oauth_state_${key}`;
        const store = await cookies();
        console.log(`[BlueskyOAuth] Deleting state for key: ${key}, name: ${name}`);
        try {
          // Delete from cookies
          store.delete(name);
          console.log(`[BlueskyOAuth] State deleted successfully from cookies for key: ${key}`);
          
          // Also delete from Redis backup
          try {
            const { getRedis } = await import('../services/redisClient');
            const redis = getRedis();
            const redisKey = `oauth_state:${key}`;
            await redis.del(redisKey);
            console.log(`[BlueskyOAuth] State deleted successfully from Redis backup for key: ${key}`);
          } catch (redisError: any) {
            console.warn(`[BlueskyOAuth] Failed to delete state from Redis backup:`, redisError.message);
          }
        } catch (error: any) {
          console.error(`[BlueskyOAuth] Failed to delete state for key: ${key}`, error.message);
        }
      },
    },
    // Persistent sessionStore to allow token rehydration (enables sessionGetter and dpopFetch)
    sessionStore: {
      async set(sub: string, session: any): Promise<void> {
        try {
          const { getRedis } = await import('../services/redisClient');
          const redis = getRedis();
          const key = `bsky:session:${sub}`;
          await redis.set(key, JSON.stringify(session), 'EX', 60 * 60 * 24 * 30); // 30 days
        } catch (e: any) {
          console.warn('[BlueskyOAuthClient] sessionStore.set() failed; proceeding without persistence', { message: e?.message });
        }
      },
      async get(sub: string): Promise<any | undefined> {
        try {
          const { getRedis } = await import('../services/redisClient');
          const redis = getRedis();
          const key = `bsky:session:${sub}`;
          const raw = await redis.get(key);
          if (!raw) return undefined;
          try {
            const parsed = JSON.parse(raw);
            return parsed;
          } catch (e: any) {
            logger.logWarning('[BlueskyOAuthClient] sessionStore.get() parse failed', { message: e?.message });
            return undefined;
          }
        } catch (e: any) {
          console.warn('[BlueskyOAuthClient] sessionStore.get() failed; proceeding without persistence', { message: e?.message });
          return undefined;
        }
      },
      async del(sub: string): Promise<void> {
        try {
          const { getRedis } = await import('../services/redisClient');
          const redis = getRedis();
          const key = `bsky:session:${sub}`;
          await redis.del(key);
        } catch (e: any) {
          const errorString = e instanceof Error ? e.message : String(e);
          logger.logError('[BlueskyOAuthClient] sessionStore.del() failed', errorString, "system");
        }
      },
    },
  });
  return client;
}

import { cookies } from "next/headers";
import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";

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
  const metadata = {
    client_id: `${baseUrl}/client-metadata.json`,
    application_type: "web",
    client_name: "OpenPortability",
    redirect_uris: [
      `${baseUrl}/api/auth/bluesky/callback`
    ],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "atproto transition:generic",
    dpop_bound_access_tokens: true,
    token_endpoint_auth_method: "private_key_jwt",
    jwks_uri: `${baseUrl}/jwks.json`,
    token_endpoint_auth_signing_alg: "ES256",
  } as const;
  // Log metadata summary (safe)
  console.log('[BlueskyOAuthClient] Client metadata prepared', {
    client_id: metadata.client_id,
    redirect_uris: metadata.redirect_uris,
    jwks_uri: metadata.jwks_uri,
    token_endpoint_auth_method: metadata.token_endpoint_auth_method,
    token_endpoint_auth_signing_alg: metadata.token_endpoint_auth_signing_alg,
    scope: metadata.scope
  });
  return metadata;
}

async function getKeyset() {
  const jwkStr = process.env.BLUESKY_PRIVATE_JWK;
  if (!jwkStr) throw new Error("BLUESKY_PRIVATE_JWK is not set");
  const jwk = JSON.parse(jwkStr);
  // Provide raw private JWK; the client accepts importable JWK objects
  const hasPrivate = typeof jwk.d === 'string' && jwk.d.length > 0;
  console.log('[BlueskyOAuthClient] Loaded private JWK from env', {
    hasPrivate,
    alg: jwk.alg,
    kty: jwk.kty,
    crv: jwk.crv,
    kid: jwk.kid,
    hasX: typeof jwk.x === 'string',
    hasY: typeof jwk.y === 'string'
  });
  // Build JoseKey (ensures ES256 signing key with kid is available)
  const key = await JoseKey.fromImportable(jwk);
  return [key];
}

export async function createBlueskyOAuthClient() {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("Invalid NEXTAUTH_URL. It must be an https hostname (not an IP or localhost).");
  }
  console.log('[BlueskyOAuthClient] Using base URL', { baseUrl });
  const client = new NodeOAuthClient({
    clientMetadata: getClientMetadata(baseUrl),
    // The library will import keys internally. Provide importable JWK(s).
    keyset: await getKeyset(),
    stateStore: {
      async set(key: string, internalState: any): Promise<void> {
        const name = `oauth_state_${key}`;
        const store = await cookies();
        store.set(name, JSON.stringify(internalState), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 10, // 10 minutes
          path: "/",
        });
        console.log('[BlueskyOAuthClient] stateStore.set()', { name, hasState: !!internalState });
      },
      async get(key: string): Promise<any | undefined> {
        const name = `oauth_state_${key}`;
        const store = await cookies();
        const state = store.get(name);
        const exists = !!state;
        console.log('[BlueskyOAuthClient] stateStore.get()', { name, exists });
        return state ? JSON.parse(state.value) : undefined;
      },
      async del(key: string): Promise<void> {
        const name = `oauth_state_${key}`;
        const store = await cookies();
        store.delete(name);
        console.log('[BlueskyOAuthClient] stateStore.del()', { name });
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
          console.log('[BlueskyOAuthClient] sessionStore.set()', { key, hasSession: !!session });
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
          const exists = !!raw;
          console.log('[BlueskyOAuthClient] sessionStore.get()', { key, exists });
          return raw ? JSON.parse(raw) : undefined;
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
          console.log('[BlueskyOAuthClient] sessionStore.del()', { key });
        } catch (e: any) {
          console.warn('[BlueskyOAuthClient] sessionStore.del() failed', { message: e?.message });
        }
      },
    },
  });

  return client;
}

import { NextRequest, NextResponse } from "next/server"
import { auth, signIn } from "@/app/auth"
import { createBlueskyOAuthClient } from "@/lib/services/blueskyOAuthClient"
import { pgBlueskyRepository } from "@/lib/repositories/public/pg-bluesky-repository"
import { pgUserRepository } from "@/lib/repositories/auth/pg-user-repository"
import { pgAccountRepository } from "@/lib/repositories/auth/pg-account-repository"
import { BlueskyService } from "@/lib/services/blueskyServices"
import { withPublicValidation } from "@/lib/validation/middleware"
import { z } from "zod"

export const runtime = 'nodejs'

const blueskyService = new BlueskyService(pgBlueskyRepository)

// Conservative schema for known OAuth callback params (all optional, length-limited)
const CallbackQuerySchema = z.object({
  code: z.string().max(2048).optional(),
  state: z.string().max(512).optional(),
  iss: z.string().max(256).optional(),
  client_id: z.string().max(512).optional(),
  request_uri: z.string().max(512).optional(),
}).passthrough();

// Local helper to detect Next.js redirect errors (NEXT_REDIRECT)
function isNextRedirect(err: unknown): boolean {
  try {
    const digest = (err as any)?.digest;
    return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT');
  } catch {
    return false;
  }
}

async function callbackHandler(request: NextRequest) {
  // Make userPayload available outside the try/catch for the final signIn call
  let userPayload: any | undefined;
  try {
    const client = await createBlueskyOAuthClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Log callback parameters for debugging
    console.log('[Bluesky OAuth Callback] Received parameters:', {
      code: searchParams.get('code')?.substring(0, 20) + '...',
      state: searchParams.get('state'),
      iss: searchParams.get('iss'),
      timestamp: new Date().toISOString()
    });

    // Complete OAuth flow and get session
    const { session, state } = await client.callback(searchParams);
    
    const did = (session as any)?.sub;
    if (!did) {
      console.error('[Bluesky OAuth Callback] Missing DID in session');
      return NextResponse.json({ error: "Invalid Bluesky session from callback" }, { status: 400 });
    }
    // Extract tokens from Redis directly since we can see the structure
    let accessToken: string | undefined;
    let refreshToken: string | undefined;
    let tokenType: string | undefined;
    let scope: string | undefined;
    let handle: string | undefined;

    try {
      const { getRedis } = await import('@/lib/services/redisClient');
      const redis = getRedis();
      const redisKey = `bsky:session:${did}`;
      const redisData = await redis.get(redisKey);
      
      if (redisData) {
        const sessionData = JSON.parse(redisData);
        
        // Extract tokens from the correct location
        const tokenSet = sessionData.tokenSet;
        if (tokenSet) {
          accessToken = tokenSet.access_token;
          refreshToken = tokenSet.refresh_token;
          tokenType = tokenSet.token_type;
          scope = tokenSet.scope;
        }
      } else {
        console.warn('[Token Extraction] No session data in Redis for:', redisKey);
      }
    } catch (redisError: any) {
      console.error('[Token Extraction] Redis access failed:', redisError.message);
    }

    // Now fetch profile using dpopFetch (which handles DPoP automatically)
    let profile: any = {
      did,
      handle: did, // fallback to DID
      displayName: undefined,
      avatar: undefined,
    };

    const dpopFetch = (session as any)?.dpopFetch;
    let profileFetched = false;

    if (typeof dpopFetch === 'function') {
      try {
        const origin = 'https://bsky.social';
        const url = new URL('/xrpc/app.bsky.actor.getProfile', origin);
        url.searchParams.set('actor', did);
        const resp = await dpopFetch(url.toString());
                
        if (resp.ok) {
          const profileData = await resp.json();          
          profile = {
            did: profileData.did || did,
            handle: profileData.handle,
            displayName: profileData.displayName,
            avatar: profileData.avatar,
          };
          profileFetched = true;
          handle = profileData.handle; // Update handle for token storage
        } else {
          const errorText = await resp.text();
          console.error('[dpopFetch] Failed:', {
            status: resp.status,
            statusText: resp.statusText,
            body: errorText
          });
        }
      } catch (error: any) {
        console.error('[dpopFetch] Error:', error.message);
      }
    }

    // Fallback to public profile fetch if dpopFetch failed
    if (!profileFetched) {
      try {
        const publicResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`);
        
        if (publicResponse.ok) {
          const profileData = await publicResponse.json();
          profile = {
            did: profileData.did || did,
            handle: profileData.handle,
            displayName: profileData.displayName,
            avatar: profileData.avatar,
          };
          handle = profileData.handle;
        }
      } catch (fallbackError: any) {
        console.warn('[Profile Fallback] Failed:', fallbackError.message);
      }
    }
    // Continue with user account linking
    const currentSession = await auth()
    let userId = currentSession?.user?.id || undefined
    const existingUser = await pgBlueskyRepository.getUserByBlueskyId(did)

    if (existingUser) {
      userId = existingUser.id
      await pgBlueskyRepository.updateBlueskyProfile(userId, profile)

      if (accessToken && refreshToken) {
        await pgAccountRepository.upsertAccount({
          user_id: userId,
          type: 'oauth',
          provider: 'bluesky',
          provider_account_id: did,
          access_token: accessToken,
          refresh_token: refreshToken,
          scope,
          token_type: tokenType,
        })
      } else {
        console.warn('[Account Link] No tokens available for existing user')
      }
    } else if (userId) {
      await pgBlueskyRepository.updateBlueskyProfile(userId, profile)

      if (accessToken && refreshToken) {
        await pgAccountRepository.upsertAccount({
          user_id: userId,
          type: 'oauth',
          provider: 'bluesky',
          provider_account_id: did,
          access_token: accessToken,
          refresh_token: refreshToken,
          scope,
          token_type: tokenType,
        })
      } else {
        console.warn('[Account Link] No tokens available for current user')
      }
    } else {
      const newUser = await pgUserRepository.createUser({
        name: profile.displayName || profile.handle,
        email: 'none',
        bluesky_id: profile.did,
        bluesky_username: profile.handle,
        bluesky_image: profile.avatar,
      })
      userId = newUser.id

      if (accessToken && refreshToken) {
        await pgAccountRepository.upsertAccount({
          user_id: userId,
          type: 'oauth',
          provider: 'bluesky',
          provider_account_id: did,
          access_token: accessToken,
          refresh_token: refreshToken,
          scope,
          token_type: tokenType,
        })
      } else {
        console.warn('[Account Link] No tokens available for new user')
      }
    }

    // Prepare user payload
    userPayload = {
      id: userId!,
      provider: 'bluesky',
      profile: {
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatar,
      },
      bluesky_id: profile.did,
      bluesky_username: profile.handle,
      bluesky_image: profile.avatar,
      has_onboarded: false,
      hqx_newsletter: false,
      oep_accepted: false,
      research_accepted: false,
      have_seen_newsletter: false,
      automatic_reconnect: false,
      name: profile.displayName || profile.handle,
      email: 'none',
      emailVerified: null,
    };

  } catch (err: any) {
    // Let framework-level redirects (e.g., NextAuth signIn) bubble up
    if (isNextRedirect(err)) {
      throw err;
    }
    // Pre-signIn error handling only. Let framework redirects bubble up elsewhere.
    console.error('[Bluesky OAuth] Error:', err.message);
    return NextResponse.json({ 
      error: err?.message || "Failed to complete Bluesky OAuth" 
    }, { status: 500 });
  }

  // Perform NextAuth sign-in outside the try/catch so NEXT_REDIRECT can bubble to the framework
  if (!userPayload) {
    return NextResponse.json({ error: 'Missing user payload after OAuth callback' }, { status: 500 });
  }
  return await signIn("bluesky", {
    ...userPayload,
    redirectTo: request.nextUrl.origin,
  });
}

// Wrap the handler with validation middleware with minimal impact
export const GET = withPublicValidation(
  z.object({}).passthrough(),
  async (request: NextRequest) => callbackHandler(request),
  {
    validateQueryParams: true,
    queryParamsSchema: CallbackQuerySchema,
    applySecurityChecks: true,
    excludeQueryParamsFromSecurity: ['state'],
    customRateLimit: { identifier: 'ip', windowMs: 60_000, maxRequests: 120 },
  }
);
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
    
    // Parse state to extract userId for account linking
    let stateUserId: string | undefined;
    let redirectPath: string | undefined;
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        stateUserId = stateData.userId;
        redirectPath = stateData.redirect;
        console.log('[Bluesky OAuth Callback] Parsed state:', { stateUserId, redirectPath });
      } catch (e) {
        // Legacy state format (just the path)
        redirectPath = state;
        console.log('[Bluesky OAuth Callback] Legacy state format:', { redirectPath });
      }
    }
    
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
      // Retry logic for DPoP nonce issues (server may return 401 on first request)
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries && !profileFetched; attempt++) {
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
            console.log('[dpopFetch] Success on attempt', attempt + 1);
          } else {
            const errorText = await resp.text();
            console.warn(`[dpopFetch] Attempt ${attempt + 1}/${maxRetries} failed:`, {
              status: resp.status,
              statusText: resp.statusText,
              body: errorText.substring(0, 200)
            });
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
            }
          }
        } catch (error: any) {
          console.warn(`[dpopFetch] Attempt ${attempt + 1}/${maxRetries} error:`, error.message);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
          }
        }
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
    // Priority: 1) userId from state (passed from frontend), 2) current session, 3) undefined
    const currentSession = await auth()
    let userId = stateUserId || currentSession?.user?.id || undefined
    
    console.log('[Bluesky OAuth Callback] User ID resolution:', {
      stateUserId,
      sessionUserId: currentSession?.user?.id,
      resolvedUserId: userId
    });
    
    const existingUser = await pgBlueskyRepository.getUserByBlueskyId(did)

    // Check if this Bluesky account is already linked to ANOTHER user
    if (existingUser && userId && existingUser.id !== userId) {
      console.error('[Bluesky OAuth Callback] Account already linked to another user:', {
        existingUserId: existingUser.id,
        currentUserId: userId,
        blueskyDid: did
      });
      // Redirect to error page - use NEXTAUTH_URL for correct domain
      const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
      const errorUrl = new URL('/auth/error', baseUrl);
      errorUrl.searchParams.set('error', 'BlueskyAccountAlreadyLinked');
      return NextResponse.redirect(errorUrl);
    }

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
        email: null,
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
      email: null,
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
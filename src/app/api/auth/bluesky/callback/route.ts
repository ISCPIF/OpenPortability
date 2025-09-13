import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/app/auth";
import { createBlueskyOAuthClient } from "@/lib/services/blueskyOAuthClient";
import { BlueskyRepository } from "@/lib/repositories/blueskyRepository";
import { BlueskyService } from "@/lib/services/blueskyServices";
import { supabaseAdapter } from "@/lib/supabase-adapter";

export const runtime = 'nodejs';

const blueskyRepository = new BlueskyRepository();
const blueskyService = new BlueskyService(blueskyRepository);

export async function GET(request: NextRequest) {
  try {
    const client = await createBlueskyOAuthClient();
    const searchParams = request.nextUrl.searchParams;

    // Complete OAuth flow and get session
    const { session, state } = await client.callback(searchParams);
    
    const did = (session as any)?.sub;
    if (!did) {
      console.error('[Bluesky OAuth Callback] Missing DID in session');
      return NextResponse.json({ error: "Invalid Bluesky session from callback" }, { status: 400 });
    }

    console.log('[Bluesky OAuth Callback] DID extracted:', did);

    // Extract tokens from Redis directly since we can see the structure
    let accessJwt: string | undefined;
    let refreshJwt: string | undefined;
    let handle: string | undefined;

    try {
      const { getRedis } = await import('@/lib/services/redisClient');
      const redis = getRedis();
      const redisKey = `bsky:session:${did}`;
      const redisData = await redis.get(redisKey);
      
      if (redisData) {
        const sessionData = JSON.parse(redisData);
        console.log('[Token Extraction] Session data structure:', {
          hasAuthMethod: !!sessionData.authMethod,
          hasTokenSet: !!sessionData.tokenSet,
          hasDpopJwk: !!sessionData.dpopJwk,
          tokenType: sessionData.tokenSet?.token_type
        });
        
        // Extract tokens from the correct location
        const tokenSet = sessionData.tokenSet;
        if (tokenSet) {
          accessJwt = tokenSet.access_token;  // Note: it's access_token, not accessJwt
          refreshJwt = tokenSet.refresh_token; // Note: it's refresh_token, not refreshJwt
          
          console.log('[Token Extraction] Tokens extracted from Redis:', {
            hasAccessToken: !!accessJwt,
            hasRefreshToken: !!refreshJwt,
            tokenType: tokenSet.token_type,
            accessTokenPreview: accessJwt ? `${accessJwt.substring(0, 30)}...` : 'none'
          });
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
        
        console.log('[dpopFetch] Fetching profile with DPoP authentication');
        const resp = await dpopFetch(url.toString());
        
        console.log('[dpopFetch] Response status:', resp.status, resp.statusText);
        
        if (resp.ok) {
          const profileData = await resp.json();
          console.log('[dpopFetch] Profile fetched successfully:', {
            handle: profileData.handle,
            displayName: profileData.displayName,
            hasAvatar: !!profileData.avatar
          });
          
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
        console.log('[Profile Fallback] Trying public API');
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
          console.log('[Profile Fallback] Public profile fetched:', profile.handle);
        }
      } catch (fallbackError: any) {
        console.warn('[Profile Fallback] Failed:', fallbackError.message);
      }
    }

    console.log('[Bluesky OAuth] Final profile data:', profile);

    // Store tokens in your format (accessJwt/refreshJwt instead of access_token/refresh_token)
    const tokensForStorage = {
      accessJwt: accessJwt,     // Convert to your expected format
      refreshJwt: refreshJwt,   // Convert to your expected format
    };

    // Continue with user account linking
    const currentSession = await auth();
    let userId = currentSession?.user?.id || undefined;
    const existingUser = await blueskyRepository.getUserByBlueskyId(did);

    if (existingUser) {
      userId = existingUser.id;
      await blueskyRepository.updateBlueskyProfile(userId, profile);
      
      if (accessJwt && refreshJwt) {
        await blueskyRepository.linkBlueskyAccount(userId, { 
          did, 
          handle: profile.handle, 
          accessJwt, 
          refreshJwt 
        });
        console.log('[Account Link] Updated existing user with tokens');
      } else {
        console.warn('[Account Link] No tokens available for existing user');
      }
    } else if (userId) {
      await blueskyRepository.updateBlueskyProfile(userId, profile);
      
      if (accessJwt && refreshJwt) {
        await blueskyRepository.linkBlueskyAccount(userId, { 
          did, 
          handle: profile.handle, 
          accessJwt, 
          refreshJwt 
        });
        console.log('[Account Link] Linked to current user with tokens');
      } else {
        console.warn('[Account Link] No tokens available for current user');
      }
    } else {
      const user = await supabaseAdapter.createUser({
        provider: 'bluesky',
        profile: {
          did: profile.did,
          handle: profile.handle,
          displayName: profile.displayName,
          avatar: profile.avatar,
        }
      });
      userId = user.id;
      
      if (accessJwt && refreshJwt) {
        await blueskyRepository.linkBlueskyAccount(userId, { 
          did, 
          handle: profile.handle, 
          accessJwt, 
          refreshJwt 
        });
        console.log('[Account Link] Created new user with tokens');
      } else {
        console.warn('[Account Link] No tokens available for new user');
      }
    }

    // Prepare user payload
    const userPayload = {
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

    console.log('[Bluesky OAuth] Signing in user');
    return await signIn("bluesky", {
      ...userPayload,
      redirectTo: request.nextUrl.origin,
    });

  } catch (err: any) {
    console.error('[Bluesky OAuth] Error:', err.message);
    return NextResponse.json({ 
      error: err?.message || "Failed to complete Bluesky OAuth" 
    }, { status: 500 });
  }
}
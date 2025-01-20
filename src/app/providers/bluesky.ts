// providers/bluesky.ts
import type { OAuthConfig } from "next-auth/providers";
import { createDpopProof, generateDPoPKeyPair } from "@/lib/dpop";

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export default function BlueskyProvider(): OAuthConfig<BlueskyProfile> {
  return {
    id: "bluesky",
    name: "Bluesky",
    type: "oauth",
    clientId: "https://app.beta.v2.helloquitx.com/oauth/client-metadata.json",
    authorization: {
      url: "https://bsky.social/oauth/authorize",
      params: {
        scope: "atproto",
        response_type: "code",
        code_challenge_method: "S256"
      }
    },
    token: {
      url: "https://bsky.social/oauth/token",
      async request({ params, provider, client, cookies }) {
        // Generate DPoP key pair and proof
        const dpopKeyPair = await generateDPoPKeyPair();
        const dpopProof = await createDpopProof(
          'POST',
          provider.token?.url || '',
          dpopKeyPair
        );

        // Get the code verifier from cookies
        const codeVerifier = cookies?.get('next-auth.pkce.code_verifier')?.value;
        
        if (!codeVerifier) {
          throw new Error('Missing PKCE code verifier');
        }

        const response = await fetch(provider.token?.url || '', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'DPoP': dpopProof
          },
          body: new URLSearchParams({
            ...params,
            client_id: client.client_id,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
          })
        });

        const tokens = await response.json();

        if (!response.ok) {
          console.error('Token endpoint error:', tokens);
          throw new Error(tokens.error || 'Failed to get access token');
        }

        return {
          ...tokens,
          dpopKeyPair: JSON.stringify(dpopKeyPair)
        };
      }
    },
    userinfo: {
      url: "https://bsky.social/xrpc/com.atproto.identity.resolveHandle",
      async request({ tokens, provider }) {
        // Generate new DPoP proof for userinfo request
        const dpopKeyPair = JSON.parse(tokens.dpopKeyPair);
        const dpopProof = await createDpopProof(
          'GET',
          `${provider.userinfo?.url}?handle=${tokens.handle}`,
          dpopKeyPair
        );

        const response = await fetch(`${provider.userinfo?.url}?handle=${tokens.handle}`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'DPoP': dpopProof
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user info');
        }

        const profile = await response.json();
        return {
          did: profile.did,
          handle: tokens.handle,
        };
      }
    },
    profile(profile) {
      return {
        id: profile.did,
        did: profile.did,
        handle: profile.handle,
        displayName: profile.handle,
      };
    },
    style: {
      logo: "/bluesky.svg",
      logoDark: "/bluesky-dark.svg",
      bg: "#fff",
      text: "#000",
      bgDark: "#000",
      textDark: "#fff",
    },
  };
}
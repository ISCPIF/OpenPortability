import NextAuth, { NextAuthConfig } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import MastodonProvider from "next-auth/providers/mastodon"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import type { TwitterData, MastodonProfile, BlueskyProfile } from "@/lib/supabase-adapter"
import type { User, Account, Profile } from "next-auth"
import type { AdapterUser } from "next-auth/adapters"
import { isTwitterProfile, isMastodonProfile, isBlueskyProfile } from "./auth"
import type { AdapterAccountType } from "next-auth/adapters"
import type { CustomAdapterUser } from '@/lib/supabase-adapter'
import { BskyAgent } from '@atproto/api'

import { auth } from "./auth"

export const authConfig = {
  adapter: supabaseAdapter,
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 900
      }
    }
  },
  callbacks: {
    async signIn({ user, account, profile, error }) {
      console.log("SignIn callback - Profile:", profile);
      console.log("SignIn callback - Error:", error);
      console.log("SignIn callback - Account:", account);
      console.log("SignIn callback - user:", user);

      if (!account) return false;

      try {
        // Vérifier si un utilisateur est déjà connecté
        const session = await auth();
        
        // Si on essaie de lier un compte Bluesky
        if (session?.user?.id && account.provider === 'bluesky') {
          await supabaseAdapter.linkAccount({
            userId: session.user.id,
            type: account.type as AdapterAccountType,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state
          });
        }

        // Autoriser la connexion dans tous les cas
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
async jwt({ token, user, account, profile }) {
      // S'assurer que token.id existe et que user.id est une string
      if (!token.id && user?.id && typeof user.id === 'string') {
        token.id = user.id
        token.has_onboarded = !!user.has_onboarded // Conversion explicite en boolean
        token.hqx_newsletter = !!user.hqx_newsletter
        token.oep_accepted = !!user.oep_accepted
      }

      if (account && profile) {
        try {
          if (account?.provider === 'bluesky') {
            // The user object should already be properly formatted from the credentials provider
            return token;
          }
          if (account.provider === 'twitter' && profile && isTwitterProfile(profile)) {
            await supabaseAdapter.updateUser(token.id || '', {
              provider: 'twitter',
              profile: profile
            })
            token.twitter_id = profile.data.id
            token.twitter_username = profile.data.username
            token.twitter_image = profile.data.profile_image_url
            token.name = profile.data.name
          }
          else if ((account.provider === 'mastodon' || account.provider === 'piaille') && profile && isMastodonProfile(profile)) {
            await supabaseAdapter.updateUser(token.id || '', {
              provider: 'mastodon',
              profile: profile
            })
            token.mastodon_id = profile.id
            token.mastodon_username = profile.username
            token.mastodon_image = profile.avatar
            token.mastodon_instance = profile.url ? new URL(profile.url).origin : undefined
            token.name = profile.display_name
          }
          // else if (account.provider === 'bluesky' && profile && isBlueskyProfile(profile)) {
          //   await supabaseAdapter.updateUser(token.id || '', {
          //     provider: 'bluesky',
          //     profile: profile
          //   })
          //   // Utiliser des valeurs par défaut pour les champs optionnels
          //   const blueskyId = profile.did || profile.id || token.id || ''
          //   const blueskyUsername = profile.handle || profile.username || profile.identifier || 'unknown'
          //   const blueskyName = profile.displayName || profile.name || blueskyUsername

          //   token.bluesky_id = blueskyId
          //   token.bluesky_username = blueskyUsername
          //   token.bluesky_image = profile.avatar || undefined
          //   token.name = blueskyName
          // }
        } catch (error) {
          console.error(`Error updating user profile for ${account.provider}:`, error)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (!supabaseAdapter.getUser) {
        throw new Error('Required adapter methods are not implemented');
      }
      if (session.user && token.id) {
        try {
          const user = await supabaseAdapter.getUser(token.id)
          
          if (user) {
            session.user = {
              ...session.user,
              id: token.id,
              has_onboarded: !!user.has_onboarded,
              hqx_newsletter: !!user.hqx_newsletter,
              oep_accepted: !!user.oep_accepted,
              name: token.name || user.name,
              
              // For Twitter and Bluesky, use token values first
              twitter_id: token.twitter_id || user.twitter_id || undefined,
              twitter_username: token.twitter_username || user.twitter_username || undefined,
              twitter_image: token.twitter_image || user.twitter_image || undefined,
              
              // For Mastodon/Piaille, ALWAYS use database values
              mastodon_id: user.mastodon_id || undefined,
              mastodon_username: user.mastodon_username || undefined,
              mastodon_image: user.mastodon_image || undefined,
              mastodon_instance: user.mastodon_instance || undefined,
              
              bluesky_id: token.bluesky_id || user.bluesky_id || undefined,
              bluesky_username: token.bluesky_username || user.bluesky_username || undefined,
              bluesky_image: token.bluesky_image || user.bluesky_image || undefined,
            }
          }
        } catch (error) {
          console.error("Error fetching user data for session:", error)
        }
      }

      return session
    },
    async redirect({ url, baseUrl }) {
      // Always allow the full URL if it starts with the base URL
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // For relative URLs, just append them to the base URL
      return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
    }

  },
  providers: [
    {
      id: "bluesky",
      name: "Bluesky",
      type: "oauth",
      clientId: process.env.BLUESKY_CLIENT_ID,
      // clientSecret: process.env.TWITTER_CLIENT_SECRET,
      authorization: "https://bsky.social", // URL factice mais nécessaire
      token: {
                url: "https://bsky.social/xrpc/com.atproto.server.createSession",

        async request({ params, provider }) {
          const { identifier, password } = params;
          const agent = new BskyAgent({ service: 'https://bsky.social' });
          const session = await agent.login({ identifier, password });
          
          return {
            tokens: {
              access_token: session.data.accessJwt,
              refresh_token: session.data.refreshJwt,
              expires_at: null,
              // On stocke aussi le did et le handle
              did: session.data.did,
              handle: session.data.handle
            }
          };
        }
      },
      userinfo: {
        async request({ tokens }) {
          const agent = new BskyAgent({ service: 'https://bsky.social' });
          await agent.resumeSession({
            accessJwt: tokens.access_token,
            refreshJwt: tokens.refresh_token,
            did: tokens.did,
            handle: tokens.handle,
            active: true // On ajoute le champ active requis
          });
          const profile = await agent.getProfile({ actor: agent.session?.did || '' });
          return profile.data;
        }
      },
      profile(profile) {
        return {
          id: profile.did,
          name: profile.handle,
          email: null,
          image: profile.avatar,
          has_onboarded: false,
          hqx_newsletter: false,
          oep_accepted: false
        }
      }
    },
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      // version: "2.0",
      // checks: ["none"], // Désactiver la vérification du state pour Twitter
      async profile(profile, tokens) {
        console.log("Twitter profile response:", profile);

        if (profile.status === 429 || profile.detail =="Too Many Requests") {
          console.log("Twitter rate limit detected in profile");
          throw new Error("RATE_LIMIT");
        }

        // Si le profil est invalide
        if (!profile || !profile.data) {
          console.log("Invalid Twitter profile:", profile);
          throw new Error("INVALID_PROFILE");
        }
        return {
          id: profile.data.id,
          name: profile.data.name,
          email:null,
          provider: 'twitter',
          profile: profile,
          has_onboarded: false,
          hqx_newsletter: false,
          oep_accepted: false
        }
      },
      // userinfo: {
      //   url: "https://api.twitter.com/2/users/me",
      //   params: { "user.fields": "profile_image_url,description" }
      // }
    }),
    MastodonProvider({
      id: "mastodon",
      // This will be rewrited on the fly later on
      issuer: "https://mastodon.space",
      profile(profile: MastodonProfile) {
        return {
          id: profile.id,
          name: profile.display_name,
          provider: 'mastodon',
          profile: profile,
          has_onboarded: false,
          hqx_newsletter: false,
          oep_accepted: false, 
        }
    }})
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
} satisfies NextAuthConfig;

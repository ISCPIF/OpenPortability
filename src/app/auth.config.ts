import NextAuth, { NextAuthConfig } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import MastodonProvider from "next-auth/providers/mastodon"
import { pgAdapter } from "@/lib/pg-adapter"
import type { TwitterData, MastodonProfile, BlueskyProfile } from "@/lib/pg-adapter"
import type { User, Account, Profile } from "next-auth"
import type { AdapterUser } from "next-auth/adapters"
import { isTwitterProfile, isMastodonProfile, isBlueskyProfile } from "./auth"
import type { AdapterAccountType } from "next-auth/adapters"
import type { CustomAdapterUser } from '@/lib/pg-adapter'
import logger from '@/lib/log_utils'
import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"

import { auth } from "./auth"

export const authConfig = {
  adapter: pgAdapter,
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
    async signIn({ user, account, profile }: { user: User | AdapterUser; account?: Account | null; profile?: Profile }){
    if (!account) {
        logger.logError('Auth', 'signIn', 'No account provided during sign in', user?.id);
        return false;
      }

      try {
        // Vérifier si un utilisateur est déjà connecté
        const session = await auth();

        if (session?.user?.id && account.provider === 'mastodon') {
          const mastodonProfile = profile as MastodonProfile;
          const instance = new URL(mastodonProfile.url).origin;

          // Vérifier si un autre utilisateur a déjà ce compte Mastodon
          const { pgUserRepository } = await import('@/lib/repositories/pg-user-repository');
          const existingUser = await pgUserRepository.getUserByProviderId('mastodon', mastodonProfile.id);

            if (existingUser && existingUser.mastodon_instance === instance && existingUser.id !== session.user.id) {
              logger.logError('Auth', 'signIn', 'This Mastodon account is already linked to another user', session.user.id, {
                existingUserId: existingUser.id,
                mastodonId: mastodonProfile.id,
                instance
              });
              return '/auth/error?error=MastodonAccountAlreadyLinked';
            }
        }
        
        // Si on essaie de lier un compte Bluesky
        if (session?.user?.id && account.provider === 'bluesky') {
          // With our setup, Bluesky uses a credentials provider to finalize sign-in.
          // The actual account linking is already handled in our API route/callbacks.
          // To avoid creating a wrong "credentials" account entry with providerAccountId = userId,
          // we only link when it's a real OAuth account AND the providerAccountId looks like a DID.
          const isDid = typeof account.providerAccountId === 'string' && account.providerAccountId.startsWith('did:')

          if (isDid) {
            await pgAdapter.linkAccount({
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
            logger.logInfo('Auth', 'signIn', 'Successfully linked Bluesky account', session.user.id);
          } else {
            logger.logError('Auth', 'signIn', 'Skip linking Bluesky account (not credentials but invalid providerAccountId)', session.user.id, {
              providerAccountId: account.providerAccountId,
              accountType: account.type
            });
          }
        }
        return true;
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        logger.logError('Auth', 'signIn', err, user?.id, { provider: account?.provider });
        return false;
      }
    },
    async jwt({ token, user, account, profile }: { token: JWT; user?: User | AdapterUser; account?: Account | null; profile?: Profile }) {

      // Helper pour convertir proprement des valeurs potentiellement en string
      // provenant du provider Credentials (e.g. "true"/"false")
      const coerceBoolean = (v: unknown): boolean => {
        return v === true || v === 'true' || v === 1 || v === '1'
      }
      // S'assurer que token.id existe et que user.id est une string
      if (!token.id && user?.id && typeof user.id === 'string') {
        token.id = user.id
        // Coercition stricte des booléens pour éviter !!"false" => true
        token.has_onboarded = coerceBoolean((user as any).has_onboarded)
        token.hqx_newsletter = coerceBoolean((user as any).hqx_newsletter)
        token.oep_accepted = coerceBoolean((user as any).oep_accepted)
        token.research_accepted = coerceBoolean((user as any).research_accepted)
        token.have_seen_newsletter = coerceBoolean((user as any).have_seen_newsletter)
        token.automatic_reconnect = coerceBoolean((user as any).automatic_reconnect)
      }

      if (account && profile) {
        try {
          if (account?.provider === 'bluesky') {
            // The user object should already be properly formatted from the credentials provider
            return token;
          }
          if (account.provider === 'twitter' && profile && isTwitterProfile(profile)) {
            await pgAdapter.updateUser(token.id || '', {
              provider: 'twitter',
              profile: profile
            })
            token.twitter_id = profile.data.id
            token.twitter_username = profile.data.username
            token.twitter_image = profile.data.profile_image_url
            token.name = profile.data.name
          }
          else if ((account.provider === 'mastodon') && profile && isMastodonProfile(profile)) {
            const instance = profile.url ? new URL(profile.url).origin : undefined;
            
            await pgAdapter.updateUser(token.id || '', {
              provider: 'mastodon',
              profile: profile
            })
            
            token.mastodon_id = profile.id
            token.mastodon_username = profile.username
            token.mastodon_image = profile.avatar
            token.mastodon_instance = profile.url ? new URL(profile.url).origin : undefined
            token.name = profile.display_name
          }
        } catch (error) {
          const err = error instanceof Error ? error.message : String(error);
          logger.logError('Auth', 'jwt', err, token.id || '', { provider: account.provider });
        }
      }

      return token
    },
    async session({ session, token }: { session: Session, token: any }) {
      if (!pgAdapter.getUser) {
        logger.logError('Auth', 'session', new Error('Required adapter methods are not implemented'), token.id);
        throw new Error('Required adapter methods are not implemented');
      }
      if (session.user && token.id) {
        try {
          const user = await pgAdapter.getUser(token.id)
          
          if (user) {
            session.user = {
              ...session.user,
              id: token.id,
              has_onboarded: !!user.has_onboarded,
              hqx_newsletter: !!user.hqx_newsletter,
              oep_accepted: !!user.oep_accepted,
              research_accepted: !!user.research_accepted,
              have_seen_newsletter: !!user.have_seen_newsletter,
              automatic_reconnect: !!user.automatic_reconnect,
              name: token.name || user.name,
              
              // For Twitter and Bluesky, use token values first
              // CORRIGÉ: Toujours utiliser la valeur DB pour twitter_id (plus fiable)
              twitter_id: user.twitter_id || undefined,
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
          const err = error instanceof Error ? error.message : String(error);
          logger.logError('Auth', 'session', err, token.id);
        }
      }
      return session
    },
    async redirect({ url, baseUrl }: { url: string, baseUrl: string }) {
      
      logger.logInfo('Auth', 'redirect', 'Handling redirect after sign in', undefined, { url, baseUrl });
      
      return url.startsWith(baseUrl) 
        ? url
        : (url.startsWith('/') ? `${baseUrl}${url}` : baseUrl)
    }
  },
  providers: [
    {
      id: "bluesky",
      name: "Bluesky",
      type: "credentials",
      credentials: {},
      async authorize(credentials: any): Promise<CustomAdapterUser | null> {
        if (!credentials) {
          logger.logError('Auth', 'bluesky.authorize', 'Missing credentials');
          return null;
        }
        
        try {
          // The user object should already be properly formatted from the API
          return credentials as unknown as CustomAdapterUser;
        } catch (error) {
          const err = error instanceof Error ? error.message : String(error);
          logger.logError('Auth', 'bluesky.authorize', err);
          return null;
        }
      }
    },
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      // version: "2.0",
      // checks: ["none"], // Désactiver la vérification du state pour Twitter
      async profile(profile: any, tokens: any) {

        if (profile.status === 429 || profile.detail =="Too Many Requests") {
          logger.logError("Auth", "twitter.profile", "Twitter rate limit detected in profile");
          throw new Error("RATE_LIMIT");
        }

        // Si le profil est invalide
        if (!profile || !profile.data) {
          logger.logError("Auth", "twitter.profile", "Invalid Twitter profile:", profile);
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
          oep_accepted: false,
          have_seen_newsletter: false,
          research_accepted: false,
          automatic_reconnect: false
        }
      },
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
          have_seen_newsletter: false,
          research_accepted: false,
          automatic_reconnect: false
        }
    }})
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
} satisfies NextAuthConfig;

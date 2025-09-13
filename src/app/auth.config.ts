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
import { authClient } from '@/lib/supabase'
import logger from '@/lib/log_utils'

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
      console.log('Auth', 'signIn', 'SignIn callback initiated', user?.id, { 
        provider: account?.provider,
        errorExists: !!error,
        profileExists: !!profile
      });

      
      if (error) {
        console.log('Auth', 'signIn', error, user?.id, { provider: account?.provider });
      }

      if (!account) {
        console.log('Auth', 'signIn', 'No account provided during sign in', user?.id);
        return false;
      }

      try {
        // Vérifier si un utilisateur est déjà connecté
        const session = await auth();

        if (session?.user?.id && account.provider === 'mastodon') {
          const mastodonProfile = profile as MastodonProfile;
          const instance = new URL(mastodonProfile.url).origin;
          
          console.log('Auth', 'signIn', 'Mastodon account verification', session.user.id, {
            mastodonId: mastodonProfile.id,
            instance
          });

          // Vérifier si un autre utilisateur a déjà ce compte Mastodon
          const { data: existingUser } = await authClient
            .from('users')
            .select('id')
            .eq('mastodon_id', mastodonProfile.id)
            .eq('mastodon_instance', instance)
            .single();

            if (existingUser && existingUser.id !== session.user.id) {
              console.log('Auth', 'signIn', 'This Mastodon account is already linked to another user', session.user.id, {
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
          const isCredentials = account.type === 'credentials'
          const isDid = typeof account.providerAccountId === 'string' && account.providerAccountId.startsWith('did:')

          if (isCredentials) {
            console.log('Auth', 'signIn', 'Skip linking Bluesky account for credentials provider', session.user.id, {
              providerAccountId: account.providerAccountId
            });
          } else if (isDid) {
            console.log('Auth', 'signIn', 'Linking Bluesky account', session.user.id, {
              providerAccountId: account.providerAccountId
            });
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
            console.log('Auth', 'signIn', 'Successfully linked Bluesky account', session.user.id);
          } else {
            console.log('Auth', 'signIn', 'Skip linking Bluesky account (not credentials but invalid providerAccountId)', session.user.id, {
              providerAccountId: account.providerAccountId,
              accountType: account.type
            });
          }
        }

        // Autoriser la connexion dans tous les cas
        console.log('Auth', 'signIn', 'Authentication successful', user?.id, { provider: account.provider });
        return true;
      } catch (error) {
        console.log('Auth', 'signIn', error, user?.id, { provider: account?.provider });
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
        token.research_accepted = !!user.research_accepted
        token.have_seen_newsletter = !!user.have_seen_newsletter
        token.automatic_reconnect = !!user.automatic_reconnect
        token.have_seen_bot_newsletter = !!user.have_seen_bot_newsletter
        
        console.log('Auth', 'jwt', 'User token initialization', user.id, {
          hasOnboarded: !!user.has_onboarded,
          hqxNewsletter: !!user.hqx_newsletter
        });
      }

      if (account && profile) {
        try {
          if (account?.provider === 'bluesky') {
            console.log('Auth', 'jwt', 'Bluesky token processing', token.id || '', {
              provider: 'bluesky'
            });
            // The user object should already be properly formatted from the credentials provider
            return token;
          }
          if (account.provider === 'twitter' && profile && isTwitterProfile(profile)) {
            console.log('Auth', 'jwt', 'Twitter profile update', token.id || '', {
              twitterId: profile.data.id,
              twitterUsername: profile.data.username
            });
            
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
            const instance = profile.url ? new URL(profile.url).origin : undefined;
            
            console.log('Auth', 'jwt', 'Mastodon profile update', token.id || '', {
              mastodonId: profile.id,
              mastodonUsername: profile.username,
              instance
            });
            
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
        } catch (error) {
          console.log('Auth', 'jwt', error, token.id || '', { provider: account.provider });
        }
      }

      return token
    },
    async session({ session, token }) {
      if (!supabaseAdapter.getUser) {
        console.log('Auth', 'session', new Error('Required adapter methods are not implemented'), token.id);
        throw new Error('Required adapter methods are not implemented');
      }
      if (session.user && token.id) {
        try {
          const user = await supabaseAdapter.getUser(token.id)
          
          if (user) {
            // console.log("🔍 [DEBUG] User from DB:", {
            //   id: user.id,
            //   twitter_id: user.twitter_id,
            //   twitter_id_type: typeof user.twitter_id,
            //   twitter_username: user.twitter_username
            // });
            // logger.logDebug('Auth', 'session', 'User session refresh', token.id);
            
            session.user = {
              ...session.user,
              id: token.id,
              has_onboarded: !!user.has_onboarded,
              hqx_newsletter: !!user.hqx_newsletter,
              oep_accepted: !!user.oep_accepted,
              research_accepted: !!user.research_accepted,
              have_seen_newsletter: !!user.have_seen_newsletter,
              have_seen_bot_newsletter: !!user.have_seen_bot_newsletter,
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
          console.log('Auth', 'session', error, token.id);
        }
      }

      // console.log("SESSION FROM CALLBACK IS ---->", session)
      // console.log("type of twitter id ->", typeof session.user.twitter_id)
      return session
    },
    async redirect({ url, baseUrl }) {
      // Handles redirect after sign in
      // console.log('REDIRECT', { url, baseUrl })
      
      logger.logDebug('Auth', 'redirect', 'Handling redirect after sign in', undefined, { url, baseUrl });
      
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
      async authorize(credentials): Promise<CustomAdapterUser | null> {
        if (!credentials) {
          console.error('Missing credentials');
          return null;
        }
        
        try {
          // The user object should already be properly formatted from the API
          return credentials as unknown as CustomAdapterUser;
        } catch (error) {
          console.error('Bluesky auth error:', error);
          return null;
        }
      }
    },
    // {
    //   id: "bluesky",
    //   name: "Bluesky",
    //   type: "oauth",
    //   clientId: process.env.BLUESKY_CLIENT_ID,
    //   issuer: "https://bsky.social",
    //   authorization: {
    //     url: "https://app.beta.v2.helloquitx.com/api/auth/bluesky",
    //     params: { 
    //       response_type: "code",
    //       scope: "openid profile email"
    //     }
    //   },
    //   token: {
    //     url: "https://app.beta.v2.helloquitx.com/api/auth/bluesky",
    //     async request({ params }) {
    //       const response = await fetch("/api/auth/bluesky", {
    //         method: "POST",
    //         headers: { "Content-Type": "application/json" },
    //         body: JSON.stringify({
    //           identifier: params.username,
    //           password: params.password
    //         })
    //       });
          
    //       const data = await response.json();
    //       if (!response.ok) {
    //         throw new Error(data.error || "Authentication failed");
    //       }
          
    //       return {
    //         tokens: {
    //           access_token: data.accessJwt,
    //           refresh_token: data.refreshJwt,
    //           did: data.did,
    //           handle: data.handle
    //         }
    //       };
    //     }
    //   },
    //   userinfo: {
    //     url: "https://app.beta.v2.helloquitx.com/api/auth/bluesky/userinfo",
    //     async request({ tokens }) {
    //       const agent = new BskyAgent({ service: 'https://bsky.social' });
    //       await agent.resumeSession({
    //         accessJwt: tokens.access_token,
    //         refreshJwt: tokens.refresh_token,
    //         did: tokens.did,
    //         handle: tokens.handle,
    //         active: true
    //       });
          
    //       const profile = await agent.getProfile({ actor: tokens.did });
    //       return profile.data;
    //     }
    //   },
    //   profile(profile) {
    //     return {
    //       id: profile.did,
    //       name: profile.displayName || profile.handle,
    //       email: null,
    //       image: profile.avatar,
    //       has_onboarded: false,
    //       hqx_newsletter: false,
    //       oep_accepted: false
    //     }
    //   }
    // },
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      // version: "2.0",
      // checks: ["none"], // Désactiver la vérification du state pour Twitter
      async profile(profile, tokens) {
        console.log('Auth', 'twitter.profile', 'Processing Twitter profile', undefined, {
          twitterId: profile.data.id,
          twitterUsername: profile.data.username
        });
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
          oep_accepted: false,
          have_seen_newsletter: false,
          have_seen_bot_newsletter : false,
          research_accepted: false,
          automatic_reconnect: false
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
        console.log('Auth', 'mastodon.profile', 'Processing Mastodon profile', undefined, {
          mastodonId: profile.id,
          mastodonUsername: profile.username,
          url: profile.url
        });
        
        return {
          id: profile.id,
          name: profile.display_name,
          provider: 'mastodon',
          profile: profile,
          has_onboarded: false,
          hqx_newsletter: false,
          oep_accepted: false,
          have_seen_newsletter: false,
          have_seen_bot_newsletter : false,
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

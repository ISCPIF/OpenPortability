import NextAuth, { NextAuthConfig } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import MastodonProvider from "next-auth/providers/mastodon"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import type { TwitterData, MastodonProfile, BlueskyProfile } from "@/lib/supabase-adapter"
import type { User, Account, Profile } from "next-auth"
import type { AdapterUser } from "next-auth/adapters"
import { isTwitterProfile, isMastodonProfile, isBlueskyProfile } from "./auth"
import type { AdapterAccountType } from "next-auth/adapters"
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
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: 60 * 60 // 1 hour
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

      if (!supabaseAdapter.getUser || !supabaseAdapter.getUserByAccount) {
        throw new Error('Required adapter methods are not implemented');
      }

      try {
        // Vérifier si un utilisateur est déjà connecté
        const session = await auth()
        console.log("Current session:", session)

        if (session?.user?.id) {
          // Un utilisateur est déjà connecté, on récupère ses informations
          const existingUser = await supabaseAdapter.getUser(session.user.id)
          console.log("Found existing user:", existingUser)

          if (existingUser && account && profile) {
            // Vérifier si le compte social n'est pas déjà lié à un autre utilisateur
            const existingAccount = await supabaseAdapter.getUserByAccount({
              providerAccountId: account.providerAccountId,
              provider: account.provider
            })

            if (existingAccount && existingAccount.id !== existingUser.id) {
              console.error("This social account is already linked to another user")
              return false
            }

            // Lier le nouveau compte au compte existant
            await supabaseAdapter.linkAccount({
              userId: existingUser.id,
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
            })

            // Mettre à jour l'utilisateur avec les nouvelles informations
            if (account?.provider === 'mastodon' || account?.provider === 'piaille') {
              await supabaseAdapter.updateUser(existingUser.id, {
                provider: 'mastodon',
                profile: profile as MastodonProfile
              })
            } else if (account?.provider === 'twitter' && 'data' in profile) {
              await supabaseAdapter.updateUser(existingUser.id, {
                provider: 'twitter',
                profile: profile as TwitterData
              })
            }

            return true
          }
        }

        // Si on arrive ici, pas d'utilisateur connecté
        // Vérifier si le compte social n'est pas déjà utilisé
        if (!account?.provider || !account?.providerAccountId) {
          console.error("Invalid account information", account)
          return false
        }
        const existingAccount = await supabaseAdapter.getUserByAccount({
          providerAccountId: account.providerAccountId,
          provider: account.provider
        })

        if (existingAccount) {
          console.error("This social account is already linked to another user")
          return false
        }

        // Création d'un nouvel utilisateur
        let provider: 'mastodon' | 'twitter' | 'bluesky'
        if (account.provider === 'piaille' || account.provider === 'mastodon') {
          provider = 'mastodon'
        } else if (account.provider === 'twitter') {
          provider = 'twitter'
        } else if (account.provider === 'bluesky') {
          provider = 'bluesky'
        } else {
          console.error("Unknown provider:", account.provider)
          return false
        }

        const newUser = await supabaseAdapter.createUser({
          id: user.id,
          name: user.name,
          provider,
          profile: profile as MastodonProfile | TwitterData
        })

        console.log("Created new user:", newUser)
        return true
      } catch (error) {
        console.error("Error in signIn callback:", error)
        return false
      }
    },
async jwt({ token, user, account, profile }) {
      // S'assurer que token.id existe et que user.id est une string
      if (!token.id && user?.id && typeof user.id === 'string') {
        token.id = user.id
        token.has_onboarded = !!user.has_onboarded // Conversion explicite en boolean
      }

      if (account && profile) {
        try {
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
          else if (account.provider === 'bluesky' && profile && isBlueskyProfile(profile)) {
            await supabaseAdapter.updateUser(token.id || '', {
              provider: 'bluesky',
              profile: profile
            })
            // Utiliser des valeurs par défaut pour les champs optionnels
            const blueskyId = profile.did || profile.id || token.id || ''
            const blueskyUsername = profile.handle || profile.username || profile.identifier || 'unknown'
            const blueskyName = profile.displayName || profile.name || blueskyUsername

            token.bluesky_id = blueskyId
            token.bluesky_username = blueskyUsername
            token.bluesky_image = profile.avatar || undefined
            token.name = blueskyName
          }
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
              has_onboarded: !!user.has_onboarded, // Conversion explicite en boolean
              name: token.name || user.name,
              
              twitter_id: token.twitter_id || user.twitter_id || undefined,
              twitter_username: token.twitter_username || user.twitter_username || undefined,
              twitter_image: token.twitter_image || user.twitter_image || undefined,
              
              mastodon_id: token.mastodon_id || user.mastodon_id || undefined,
              mastodon_username: token.mastodon_username || user.mastodon_username || undefined,
              mastodon_image: token.mastodon_image || user.mastodon_image || undefined,
              mastodon_instance: token.mastodon_instance || user.mastodon_instance || undefined,
              
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
      // Détecter le locale depuis l'URL de la requête
      const locale = url.match(/\/([a-z]{2})\//) ? url.match(/\/([a-z]{2})\//)?.[1] : 'fr';

      if (url.includes('/auth/callback')) {
        // Rediriger vers le dashboard avec le locale
        return `${baseUrl}/${locale}/dashboard`
      }

      // Pour les autres redirections, conserver le locale s'il existe
      if (url.startsWith(baseUrl)) {
        return url;
      }

      // Pour les redirections vers la base URL, ajouter le locale par défaut
      return `${baseUrl}/${locale}`;
    }


  },
providers: [
  {
    id: "bluesky",
    name: "Bluesky",
    type: "credentials",
    credentials: {},
    async authorize(credentials: Partial<Record<string, unknown>>): Promise<User | null> {
      if (!credentials) {
        return null;
      }

      try {
        // On utilise toutes les informations passées lors du signIn
        return {
          id: credentials.id as string,
          name: credentials.name as string,
          has_onboarded: true,
          bluesky_id: credentials.bluesky_id as string,
          bluesky_username: credentials.bluesky_username as string,
          bluesky_image: credentials.bluesky_image as string || null,
        };
      } catch (error) {
        console.error('Bluesky auth error:', error);
        return null;
      }
    }
  },
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
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
          has_onboarded: false
        }
      },
      // userinfo: {
      //   url: "https://api.twitter.com/2/users/me",
      //   params: { "user.fields": "profile_image_url,description" }
      // }
    }),

    MastodonProvider({
      clientId: process.env.AUTH_MASTODON_ID!,
      clientSecret: process.env.AUTH_MASTODON_SECRET!,
      issuer: process.env.AUTH_MASTODON_ISSUER!,
      profile(profile: MastodonProfile) {
        return {
          id: profile.id,
          name: profile.display_name,
          provider: 'mastodon',
          profile: profile,
          has_onboarded: false
        }
      }
    }),
    MastodonProvider({
      id: "piaille",
      name: "Piaille",
      clientId: process.env.AUTH_PIALLE_MASTONDON_ID!,
      clientSecret: process.env.AUTH_PIAILLE_MASTODON_SECRET!,
      issuer: process.env.AUTH_PIAILLE_MASTODON_ISSUER!,
      profile(profile: MastodonProfile) {
        return {
          id: profile.id,
          name: profile.display_name,
          provider: 'mastodon',
          profile: profile,
          has_onboarded: false
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
} satisfies NextAuthConfig;
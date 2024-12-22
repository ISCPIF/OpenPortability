import NextAuth, { NextAuthConfig } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import MastodonProvider from "next-auth/providers/mastodon"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import type { MastodonProfile } from "./auth"
import type { TwitterData } from "@/lib/supabase-adapter"
import type { User, Account, Profile } from "next-auth"
import type { AdapterUser } from "next-auth/adapters"

export const authConfig = {
  adapter: supabaseAdapter,
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  callbacks: {
    async signIn({ user, account, profile, error }: {
      user: User | AdapterUser
      account: Account | null
      profile?: Profile
      error?: string
    }) {
      console.log("SignIn callback - Profile:", profile);
      console.log("SignIn callback - Error:", error);
      console.log("SignIn callback - Account:", account);

      // Si c'est une erreur liée à Twitter
      if (account?.provider === 'twitter' && error) {
        return `/auth/error?error=${encodeURIComponent("Twitter est temporairement indisponible. Veuillez réessayer dans quelques minutes.")}&provider=twitter`;
      }
      
      // Si c'est une erreur de rate limit
      if (profile && 'error' in profile) {
        console.log("Rate limit error detected in signIn");
        const errorMessage = `Twitter - ${profile.error.title} (${profile.error.status}): ${profile.error.detail || 'Veuillez réessayer dans quelques minutes.'}`;
        return `/auth/error?error=${encodeURIComponent(errorMessage)}&provider=twitter`;
      }

      // Si pas d'utilisateur à cause du rate limit
      if (!user && profile?.status === 429) {
        return `/auth/error?error=${encodeURIComponent("Twitter est temporairement indisponible en raison d'un trop grand nombre de requêtes. Veuillez réessayer dans quelques minutes.")}&provider=twitter`;
      }

      if (!user?.id) {
        console.error("No user ID provided in signIn callback")
        return false
      }

      try {
        if (account?.provider === 'twitter' && profile && 'data' in profile) {
          await supabaseAdapter.updateUser(user.id, {
            provider: 'twitter',
            profile: profile as TwitterData
          })
        }
        else if (account?.provider === 'mastodon' && profile && 'url' in profile) {
          await supabaseAdapter.updateUser(user.id, {
            provider: 'mastodon',
            profile: profile as MastodonProfile
          })
        }
        return true
      } catch (error) {
        console.error("Error in signIn callback:", error)
        return false
      }
    }
  },
  providers: [
    {
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      credentials: {},
      async authorize(credentials) {
        if (!credentials) return null;
        
        return {
          id: credentials.id,
          bluesky_id: credentials.bluesky_id,
          bluesky_username: credentials.bluesky_username,
          bluesky_image: credentials.bluesky_image,
          name: credentials.name
        };
      }
    },
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      // checks: ["none"], // Désactiver la vérification du state pour Twitter
      async profile(profile, tokens) {
        console.log("Twitter profile response:", profile);

        // Check for rate limit error
        if (profile.status === 429 || (profile.title === "Too Many Requests")) {
          console.log("Twitter rate limit detected");
          return null
        }

        return {
          id: profile.data.id,
          name: profile.data.name,
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
    })
  ],

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  },
} satisfies NextAuthConfig
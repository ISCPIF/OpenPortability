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
    async signIn({ user, account, profile }: {
      user: User | AdapterUser
      account: Account | null
      profile?: Profile
    }) {
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
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      profile(profile) {
        return {
          id: profile.data.id,
          name: profile.data.name,
          provider: 'twitter',
          profile: profile,
          has_onboarded: false
        }
      }
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
  },
} satisfies NextAuthConfig
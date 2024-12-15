import NextAuth, { NextAuthConfig } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import CredentialsProvider from "next-auth/providers/credentials"
import MastodonProvider from "next-auth/providers/mastodon"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import type { TwitterProfile } from "next-auth/providers/twitter"
import {auth} from "./auth"

export const authConfig = {
  adapter: supabaseAdapter,
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'twitter' && profile) {
        await supabaseAdapter.updateUser(user.id, {
          provider: 'twitter',
          profile: profile
        })
      }
      else if (account?.provider === 'mastodon' && profile) {
        await supabaseAdapter.updateUser(user.id, {
          provider: 'mastodon',
          profile: profile
        })
      }
      return true
    }
  },
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      profile(profile) {
        return {
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
      profile(profile) {
        return {
          name: profile.display_name,
          provider: 'mastodon',
          profile: profile,
          has_onboarded: false
        }
      }
    }),

    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {},
      async authorize(credentials) {
        if (!credentials?.id) return null;
        
        const user = await supabaseAdapter.getUser(credentials.id as string);
        return user;
      }
    })
  ],
 

  pages: {
    signIn: '/auth/signin',
  },
} satisfies NextAuthConfig
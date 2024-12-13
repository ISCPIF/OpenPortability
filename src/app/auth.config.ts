import NextAuth, { NextAuthConfig } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"
import CredentialsProvider from "next-auth/providers/credentials"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import type { TwitterProfile } from "next-auth/providers/twitter"

export const authConfig = {
  adapter: supabaseAdapter,
  providers: [
    // Mock provider pour le développement
    process.env.NODE_ENV === "development"
      ? CredentialsProvider({
          id: "mock-twitter",
          name: "Mock Twitter",
          credentials: {},
          async authorize() {
            return {
              id: "mock-user-id",
              name: "Mock User",
              email: "mock@example.com",
              emailVerified: null,
              image: "https://pbs.twimg.com/profile_images/1590713963528032256/XSpysA3J_normal.jpg",
              twitter_id: "mock-twitter-id"
            }
          },
        })
      : null,
    
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      profile(profile: TwitterProfile) {
        console.log(" Twitter Profile Raw Data:", profile)
        return {
          id: profile.data.id.toString(),
          name: profile.data.name,
          twitter_id: profile.data.id.toString(),
          twitter_username: profile.data.username,
          twitter_image: profile.data.profile_image_url,
          has_onboarded: false,
          // Champs BlueSky initialisés à null
          bluesky_id: null,
          bluesky_username: null,
          bluesky_image: null
        }
      }
    }),
  ].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider)),

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.has_onboarded = user.has_onboarded
        token.twitter_id = user.twitter_id
        token.twitter_username = user.twitter_username
        token.twitter_image = user.twitter_image
        token.bluesky_id = user.bluesky_id
        token.bluesky_username = user.bluesky_username
        token.bluesky_image = user.bluesky_image
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.has_onboarded = token.has_onboarded as boolean
        session.user.twitter_id = token.twitter_id as string
        session.user.twitter_username = token.twitter_username as string
        session.user.twitter_image = token.twitter_image as string
        session.user.bluesky_id = token.bluesky_id as string | null
        session.user.bluesky_username = token.bluesky_username as string | null
        session.user.bluesky_image = token.bluesky_image as string | null
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      console.log(" Redirect Callback:", { url, baseUrl })

      // Si on est sur un callback d'authentification
      if (url.includes('/auth/callback')) {
        console.log(" Auth callback detected, redirecting to /upload")
        return `${baseUrl}/upload`
      }

      // // Si on est sur /auth/bluesky
      // if (url.endsWith('/auth/bluesky')) {
      //   console.log(" On bluesky page, redirecting to /upload")
      //   return `${baseUrl}/upload`
      // }

      // Si on est sur la page de signin et qu'on est déjà connecté
      if (url.endsWith('/auth/signin')) {
        console.log(" Already logged in, redirecting to /upload")
        return `${baseUrl}/upload`
      }

      // Par défaut, on retourne l'URL demandée si elle commence par baseUrl
      console.log(" Default redirect to:", url)
      return url.startsWith(baseUrl) ? url : baseUrl
    }
  },

  pages: {
    signIn: '/auth/signin',
  },
} satisfies NextAuthConfig
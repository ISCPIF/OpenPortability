import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import { Session } from "next-auth"

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  adapter: supabaseAdapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      console.log("\n=== JWT Callback ===")
      console.log("Token:", token)
      console.log("User:", user)
      console.log("Account:", account)
      console.log("Profile:", profile)

      if (user) {
        // Initial sign in - copy user info to token
        token.id = user.id
        token.has_onboarded = user.has_onboarded
      }

      if (account && profile) {
        // Update token with latest provider info
        if (account.provider === 'twitter' && 'data' in profile) {
          await supabaseAdapter.updateUser(token.id as string, {
            provider: 'twitter',
            profile: profile
          })
          token.twitter_id = profile.data.id
          token.twitter_username = profile.data.username
          token.twitter_image = profile.data.profile_image_url
          token.name = profile.data.name
        }
        else if (account.provider === 'mastodon') {
          await supabaseAdapter.updateUser(token.id as string, {
            provider: 'mastodon',
            profile: profile
          })
          token.mastodon_id = profile.id
          token.mastodon_username = profile.username
          token.mastodon_image = profile.avatar
          token.mastodon_instance = profile.url ? new URL(profile.url).origin : null
          token.name = profile.display_name
        }
        else if (account.provider === 'bluesky') {
          await supabaseAdapter.updateUser(token.id as string, {
            provider: 'bluesky',
            profile: profile
          })
          token.bluesky_id = profile.did || profile.id
          token.bluesky_username = profile.identifier || profile.username
          token.bluesky_image = profile.avatar
          token.name = profile.name || profile.identifier
        }
      }

      return token
    },

    async session({ session, token }) {
      console.log("\n=== Session Callback ===")
      console.log("Token content:", token)
      console.log("Session content:", session)
      
      if (session.user && token) {
        // Get the latest user data from the database
        const user = await supabaseAdapter.getUser(token.id as string)
        
        if (user) {
          // Update session with both token and database info
          session.user = {
            ...session.user,
            id: token.id as string,
            has_onboarded: token.has_onboarded as boolean,
            name: token.name,
            
            // Twitter info from token (most recent)
            twitter_id: token.twitter_id as string || user.twitter_id || null,
            twitter_username: token.twitter_username as string || user.twitter_username || null,
            twitter_image: token.twitter_image as string || user.twitter_image || null,
            
            // Mastodon info from token (most recent)
            mastodon_id: token.mastodon_id as string || user.mastodon_id || null,
            mastodon_username: token.mastodon_username as string || user.mastodon_username || null,
            mastodon_image: token.mastodon_image as string || user.mastodon_image || null,
            mastodon_instance: token.mastodon_instance as string || user.mastodon_instance || null,
            
            // Bluesky info from token (most recent)
            bluesky_id: token.bluesky_id as string || user.bluesky_id || null,
            bluesky_username: token.bluesky_username as string || user.bluesky_username || null,
            bluesky_image: token.bluesky_image as string || user.bluesky_image || null,
          }
        }
      }

      console.log("Session provider called !")
      console.log("session:", session)
      return session
    },

    async redirect({ url, baseUrl }) {
      console.log(" Redirect Callback:", { url, baseUrl })

      // Si on est sur un callback d'authentification
      if (url.includes('/auth/callback')) {
        console.log(" Auth callback detected, redirecting to /dashboard")
        return `${baseUrl}/dashboard`
      }

      // Par défaut, on retourne l'URL demandée si elle commence par baseUrl
      console.log(" Default redirect to:", url)
      return url.startsWith(baseUrl) ? url : baseUrl
    }
  }
})
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
    async session({ session, token }) {
      console.log("=== Session Callback ===")
      console.log("Token content:", token)
      console.log("Session content:", session)
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.has_onboarded = token.has_onboarded as boolean
        session.user.twitter_id = token.twitter_id as string
        session.user.twitter_username = token.twitter_username as string
        session.user.twitter_image = token.twitter_image as string
        session.user.bluesky_id = token.bluesky_id as string | null
        session.user.bluesky_username = token.bluesky_username as string | null
        session.user.bluesky_image = token.bluesky_image as string | null
        
        // Get tokens from the database using the user ID
        const adapter = supabaseAdapter
        const accounts = await adapter.getAccountsByUserId(token.id as string)

        if (accounts && accounts.length > 0) {
          // Store all provider tokens in the session
          session.providers = accounts.reduce((acc, account) => {
            if (account.provider) {
              acc[account.provider] = {
                accessToken: account.access_token || null,
                refreshToken: account.refresh_token || null,
                ...(account.expires_at && { expiresAt: account.expires_at }),
              };
            }
            return acc;
          }, {} as NonNullable<Session['providers']>);
          
          // For backward compatibility
          const twitterAccount = accounts.find(a => a.provider === 'twitter')
          const mastodonAccount = accounts.find(a => a.provider === 'mastodon')
          
          if (twitterAccount) {
            session.twitterAccessToken = twitterAccount.access_token
          }
          if (mastodonAccount) {
            session.mastodonAccessToken = mastodonAccount.access_token
            session.mastodonServer = process.env.MASTODON_SERVER
          }
        }
      }
      return session
    },
    async jwt({ token, user, account }) {
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

      // Si on vient de la route d'upload, on force un rafraîchissement des données
      if (token.id) {
        const userData = await supabaseAdapter.getUser(token.id)
        if (userData) {
          token.has_onboarded = userData.has_onboarded
          token.twitter_id = userData.twitter_id
          token.twitter_username = userData.twitter_username
          token.twitter_image = userData.twitter_image
          token.bluesky_id = userData.bluesky_id
          token.bluesky_username = userData.bluesky_username
          token.bluesky_image = userData.bluesky_image
        }
      }

      if (account) {
        token.twitterAccessToken = account.access_token
      }

      return token
    }
  }
})
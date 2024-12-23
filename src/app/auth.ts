import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { supabaseAdapter } from "@/lib/supabase-adapter"
import type { Profile } from "next-auth"
import type { TwitterData, MastodonProfile as AdapterMastodonProfile, BlueskyProfile as AdapterBlueskyProfile } from "@/lib/supabase-adapter"

export type { TwitterData as TwitterProfile } from "@/lib/supabase-adapter"
export type { AdapterMastodonProfile as MastodonProfile }
export type { AdapterBlueskyProfile as BlueskyProfile }

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
      // console.log(" Redirect Callback:", { url, baseUrl })

      if (url.includes('/auth/callback')) {
        // console.log(" Auth callback detected, redirecting to /dashboard")
        return `${baseUrl}/dashboard`
      }

      // console.log(" Default redirect to:", url)
      return url.startsWith(baseUrl) ? url : baseUrl
    }
  }
})

// Type guards
function isTwitterProfile(profile: any): profile is TwitterData {
  return profile && 
    typeof profile === 'object' && 
    'data' in profile && 
    typeof profile.data === 'object' && 
    profile.data !== null &&
    'id' in profile.data && 
    'username' in profile.data && 
    'profile_image_url' in profile.data &&
    'name' in profile.data
}

function isMastodonProfile(profile: Profile): profile is AdapterMastodonProfile {
  return 'url' in profile && 
    'id' in profile && 
    'username' in profile && 
    'display_name' in profile && 
    'avatar' in profile
}

function isBlueskyProfile(profile: Profile): profile is AdapterBlueskyProfile {
  return ('did' in profile || 'id' in profile) && 
    ('handle' in profile || 'username' in profile || 'identifier' in profile)
}
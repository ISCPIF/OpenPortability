import "next-auth"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    supabaseAccessToken?: string
    twitterAccessToken?: string
    mastodonAccessToken?: string
    mastodonServer?: string
    blueskyAccessToken?: string
    blueskyServer?: string
    providers?: {
      [provider: string]: {
        accessToken?: string | null;
        refreshToken?: string | null;
        server?: string | null;
      };
    };
    user: {
      id: string
      name?: string | null
      twitter_username?: string | null
      twitter_image?: string | null
      twitter_id?: string | null
      bluesky_id?: string | null
      bluesky_username?: string | null
      bluesky_image?: string | null
      has_onboarded: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    name?: string | null
    twitter_username?: string | null
    twitter_image?: string | null
    twitter_id?: string | null
    bluesky_id?: string | null
    bluesky_username?: string | null
    bluesky_image?: string | null
    has_onboarded: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string
    userId?: string
    twitterAccessToken?: string
    supabaseAccessToken?: string
    mastodonAccessToken?: string
    mastodonServer?: string
    blueskyAccessToken?: string
    blueskyServer?: string
    id?: string
    has_onboarded?: boolean
    twitter_id?: string
    twitter_username?: string
    twitter_image?: string
    bluesky_id?: string | null
    bluesky_username?: string | null
    bluesky_image?: string | null
  }
}
import NextAuth, { DefaultSession } from "next-auth"

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
      has_onboarded: boolean
      twitter_id: string
      twitter_username: string
      twitter_image: string
      bluesky_id: string | null
      bluesky_username: string | null
      bluesky_image: string | null
      mastodon_id: string | null
      mastodon_username: string | null
      mastodon_image: string | null
      mastodon_instance: string | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    has_onboarded: boolean
    twitter_id: string
    twitter_username: string
    twitter_image: string
    bluesky_id: string | null
    bluesky_username: string | null
    bluesky_image: string | null
    mastodon_id: string | null
    mastodon_username: string | null
    mastodon_image: string | null
    mastodon_instance: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    has_onboarded: boolean
    twitter_id: string
    twitter_username: string
    twitter_image: string
    bluesky_id: string | null
    bluesky_username: string | null
    bluesky_image: string | null
    mastodon_id: string | null
    mastodon_username: string | null
    mastodon_image: string | null
    mastodon_instance: string | null
  }
}
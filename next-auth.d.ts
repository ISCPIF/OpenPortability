import "next-auth"
import { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      has_onboarded: boolean
      hqx_newsletter: boolean
      oep_accepted: boolean
      twitter_id?: string | null
      twitter_username?: string | null
      twitter_image?: string | null
      mastodon_id?: string | null
      mastodon_username?: string | null
      mastodon_image?: string | null
      mastodon_instance?: string | null
      bluesky_id?: string | null
      bluesky_username?: string | null
      bluesky_image?: string | null
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string
    has_onboarded: boolean
    hqx_newsletter: boolean
    oep_accepted: boolean
    twitter_id?: string | null
    twitter_username?: string | null
    twitter_image?: string | null
    mastodon_id?: string | null
    mastodon_username?: string | null
    mastodon_image?: string | null
    mastodon_instance?: string | null
    bluesky_id?: string | null
    bluesky_username?: string | null
    bluesky_image?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    has_onboarded: boolean
    hqx_newsletter: boolean
    oep_accepted: boolean
    twitter_id?: string
    twitter_username?: string
    twitter_image?: string
    mastodon_id?: string
    mastodon_username?: string
    mastodon_image?: string
    mastodon_instance?: string | null
    bluesky_id?: string
    bluesky_username?: string
    bluesky_image?: string
  }
}
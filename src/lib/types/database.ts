/**
 * Types pour les entités de la base de données
 */

export interface DBUser {
  id: string
  name: string | null
  email: string | null
  email_verified: Date | null
  image: string | null
  has_onboarded: boolean
  hqx_newsletter: boolean
  oep_accepted: boolean
  have_seen_newsletter: boolean
  research_accepted: boolean
  automatic_reconnect: boolean
  twitter_id: string | null
  twitter_username: string | null
  twitter_image: string | null
  bluesky_id: string | null
  bluesky_username: string | null
  bluesky_image: string | null
  mastodon_id: string | null
  mastodon_username: string | null
  mastodon_image: string | null
  mastodon_instance: string | null
  created_at: Date
  updated_at: Date
}

export interface DBAccount {
  id: string
  user_id: string
  type: string
  provider: string
  provider_account_id: string
  refresh_token: string | null
  access_token: string | null
  expires_at: number | null
  token_type: string | null
  scope: string | null
  id_token: string | null
  session_state: string | null
  created_at: Date
  updated_at: Date
}

export interface DBSession {
  id: string
  sessionToken: string
  userId: string
  expires: Date
  created_at: Date
  updated_at: Date
}

export interface DBVerificationToken {
  identifier: string
  token: string
  expires: Date
  created_at: Date
}

export interface DBShareEvent {
  id: string
  source_id: string
  target_id: string | null
  event_type: string
  created_at: Date
}

export interface DBNewsletterConsent {
  id: string
  user_id: string
  consent_type: string
  consent_value: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface DBMastodonInstance {
  id: number
  instance: string
  client_id: string
  client_secret: string
  created_at: Date
}

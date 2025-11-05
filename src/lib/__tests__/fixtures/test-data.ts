import { DBUser, DBAccount, DBSession } from '../../types/database'
import { CustomAdapterUser } from '../../supabase-adapter'

/**
 * Données de test pour les tests unitaires
 */

export const mockUser: DBUser = {
  id: 'test-user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: null,
  image: null,
  has_onboarded: false,
  hqx_newsletter: false,
  oep_accepted: false,
  have_seen_newsletter: false,
  research_accepted: false,
  automatic_reconnect: false,
  twitter_id: null,
  twitter_username: null,
  twitter_image: null,
  bluesky_id: null,
  bluesky_username: null,
  bluesky_image: null,
  mastodon_id: null,
  mastodon_username: null,
  mastodon_image: null,
  mastodon_instance: null,
  facebook_id: null,
  facebook_image: null,
  created_at: new Date(),
  updated_at: new Date(),
}

export const mockTwitterUser: DBUser = {
  ...mockUser,
  id: 'twitter-user-1',
  twitter_id: '123456789',
  twitter_username: 'testuser',
  twitter_image: 'https://example.com/avatar.jpg',
}

export const mockMastodonUser: DBUser = {
  ...mockUser,
  id: 'mastodon-user-1',
  mastodon_id: 'mastodon-123',
  mastodon_username: 'testuser',
  mastodon_image: 'https://mastodon.social/avatar.jpg',
  mastodon_instance: 'https://mastodon.social',
}

export const mockBlueskyUser: DBUser = {
  ...mockUser,
  id: 'bluesky-user-1',
  bluesky_id: 'did:plc:bluesky123',
  bluesky_username: 'testuser.bsky.social',
  bluesky_image: 'https://bsky.social/avatar.jpg',
}

export const mockFacebookUser: DBUser = {
  ...mockUser,
  id: 'facebook-user-1',
  facebook_id: 'fb-123456',
  facebook_image: 'https://facebook.com/avatar.jpg',
}

export const mockAccount: DBAccount = {
  id: 'account-1',
  user_id: 'test-user-1',
  type: 'oauth',
  provider: 'twitter',
  provider_account_id: '123456789',
  refresh_token: null,
  access_token: 'encrypted-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'Bearer',
  scope: 'tweet.read tweet.write',
  id_token: null,
  session_state: null,
  created_at: new Date(),
  updated_at: new Date(),
}

export const mockSession: DBSession = {
  id: 'session-1',
  sessionToken: 'test-session-token',
  userId: 'test-user-1',
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  created_at: new Date(),
  updated_at: new Date(),
}

export const mockAdapterUser: CustomAdapterUser = {
  id: 'test-user-1',
  name: 'Test User',
  email: 'none',
  emailVerified: null,
  has_onboarded: false,
  hqx_newsletter: false,
  oep_accepted: false,
  have_seen_newsletter: false,
  research_accepted: false,
  automatic_reconnect: false,
  twitter_id: null,
  twitter_username: null,
  twitter_image: null,
  bluesky_id: null,
  bluesky_username: null,
  bluesky_image: null,
  mastodon_id: null,
  mastodon_username: null,
  mastodon_image: null,
  mastodon_instance: null,
  facebook_id: null,
  facebook_image: null,
}

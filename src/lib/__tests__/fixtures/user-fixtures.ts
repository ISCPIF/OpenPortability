import type { DBUser } from '../../types/database'

/**
 * Fixtures pour les tests des utilisateurs
 */

export const mockBaseUser: Partial<DBUser> = {
  name: 'Test User',
  email: 'tes1111111111@example.com',
  // email_verified: null,
  // image: null,
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
}

export const mockTwitterUser: Partial<DBUser> = {
  ...mockBaseUser,
  name: 'Twitter User',
  twitter_id: '123456789',
  twitter_username: 'twitteruser',
  twitter_image: 'https://pbs.twimg.com/profile_images/123/avatar.jpg',
}

export const mockMastodonUser: Partial<DBUser> = {
  ...mockBaseUser,
  name: 'Mastodon User',
  mastodon_id: '987654321',
  mastodon_username: 'mastodonuser',
  mastodon_image: 'https://mastodon.social/avatars/original/missing.png',
  mastodon_instance: 'https://mastodon.social',
}

export const mockBlueskyUser: Partial<DBUser> = {
  ...mockBaseUser,
  name: 'Bluesky User',
  bluesky_id: 'did:plc:abcdef123456',
  bluesky_username: 'blueskyuser.bsky.social',
  bluesky_image: 'https://cdn.bsky.app/img/avatar/plain/did:plc:abcdef123456/avatar.jpg',
}

export const mockMultiProviderUser: Partial<DBUser> = {
  ...mockBaseUser,
  name: 'Multi Provider User',
  twitter_id: '123456789',
  twitter_username: 'multiuser',
  twitter_image: 'https://pbs.twimg.com/profile_images/123/avatar.jpg',
  mastodon_id: '987654321',
  mastodon_username: 'multiuser',
  mastodon_image: 'https://mastodon.social/avatars/original/missing.png',
  mastodon_instance: 'https://mastodon.social',
  bluesky_id: 'did:plc:xyz789',
  bluesky_username: 'multiuser.bsky.social',
  bluesky_image: 'https://cdn.bsky.app/img/avatar/plain/did:plc:xyz789/avatar.jpg',
}

export const mockOnboardedUser: Partial<DBUser> = {
  ...mockTwitterUser,
  has_onboarded: true,
  hqx_newsletter: true,
  oep_accepted: true,
  have_seen_newsletter: true,
  research_accepted: true,
  automatic_reconnect: true,
}

import type { DBUser } from '../../types/database'
import { randomUUID } from 'crypto'

/**
 * Fixtures pour les tests des utilisateurs
 * Note: Utiliser les getters pour obtenir des emails et IDs uniques à chaque appel
 */

// Générer un ID numérique unique pour les providers (bigint)
const getRandomId = () => Math.floor(Math.random() * 1000000000000000).toString()

const getBaseUser = (): Partial<DBUser> => ({
  name: 'Test User',
  email: `test-${randomUUID()}@example.com`,
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
})

// Export des getters au lieu des objets statiques
export const mockBaseUser = getBaseUser()

export const mockTwitterUser: Partial<DBUser> = {
  ...getBaseUser(),
  name: 'Twitter User',
  twitter_id: getRandomId(),
  twitter_username: `twitteruser-${randomUUID().slice(0, 8)}`,
  twitter_image: 'https://pbs.twimg.com/profile_images/123/avatar.jpg',
}

export const mockMastodonUser: Partial<DBUser> = {
  ...getBaseUser(),
  name: 'Mastodon User',
  mastodon_id: getRandomId(),
  mastodon_username: `mastodonuser-${randomUUID().slice(0, 8)}`,
  mastodon_image: 'https://mastodon.social/avatars/original/missing.png',
  mastodon_instance: 'https://mastodon.social',
}

export const mockBlueskyUser: Partial<DBUser> = {
  ...getBaseUser(),
  name: 'Bluesky User',
  bluesky_id: `did:plc:${randomUUID()}`,
  bluesky_username: `blueskyuser-${randomUUID().slice(0, 8)}.bsky.social`,
  bluesky_image: 'https://cdn.bsky.app/img/avatar/plain/did:plc:abcdef123456/avatar.jpg',
}

export const mockMultiProviderUser: Partial<DBUser> = {
  ...getBaseUser(),
  name: 'Multi Provider User',
  twitter_id: getRandomId(),
  twitter_username: `multiuser-${randomUUID().slice(0, 8)}`,
  twitter_image: 'https://pbs.twimg.com/profile_images/123/avatar.jpg',
  mastodon_id: getRandomId(),
  mastodon_username: `multiuser-${randomUUID().slice(0, 8)}`,
  mastodon_image: 'https://mastodon.social/avatars/original/missing.png',
  mastodon_instance: 'https://mastodon.social',
  bluesky_id: `did:plc:${randomUUID()}`,
  bluesky_username: `multiuser-${randomUUID().slice(0, 8)}.bsky.social`,
  bluesky_image: 'https://cdn.bsky.app/img/avatar/plain/did:plc:xyz789/avatar.jpg',
}

export const mockOnboardedUser: Partial<DBUser> = {
  ...getBaseUser(),
  name: 'Twitter User',
  twitter_id: getRandomId(),
  twitter_username: `twitteruser-${randomUUID().slice(0, 8)}`,
  twitter_image: 'https://pbs.twimg.com/profile_images/123/avatar.jpg',
  has_onboarded: true,
  hqx_newsletter: true,
  oep_accepted: true,
  have_seen_newsletter: true,
  research_accepted: true,
  automatic_reconnect: true,
}

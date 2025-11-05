import type { DBMastodonInstance } from '../../types/database'

/**
 * Fixtures pour les tests des instances Mastodon
 */

export const mockMastodonSocial: Omit<DBMastodonInstance, 'id' | 'created_at'> = {
  instance: 'mastodon.social',
  client_id: 'mastodon_social_client_id_123',
  client_secret: 'mastodon_social_client_secret_456',
}

export const mockPiailleFr: Omit<DBMastodonInstance, 'id' | 'created_at'> = {
  instance: 'piaille.fr',
  client_id: 'piaille_fr_client_id_789',
  client_secret: 'piaille_fr_client_secret_012',
}

export const mockMastodonOnline: Omit<DBMastodonInstance, 'id' | 'created_at'> = {
  instance: 'mastodon.online',
  client_id: 'mastodon_online_client_id_345',
  client_secret: 'mastodon_online_client_secret_678',
}

export const mockCustomInstance: Omit<DBMastodonInstance, 'id' | 'created_at'> = {
  instance: 'custom.mastodon.instance',
  client_id: 'custom_client_id_901',
  client_secret: 'custom_client_secret_234',
}

export const mockInstanceUpdate = {
  client_id: 'updated_client_id_567',
  client_secret: 'updated_client_secret_890',
}

export const mockNewInstanceCredentials = {
  client_id: 'new_instance_client_id_111',
  client_secret: 'new_instance_client_secret_222',
}

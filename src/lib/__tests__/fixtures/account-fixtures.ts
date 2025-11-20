import type { DBAccount } from '../../types/database'

/**
 * Fixtures pour les tests des comptes OAuth
 */

export const mockTwitterAccount = (userId: string): Partial<DBAccount> => ({
  user_id: userId,
  type: 'oauth',
  provider: 'twitter',
  provider_account_id: '123456789',
  access_token: 'encrypted_twitter_access_token',
  refresh_token: 'encrypted_twitter_refresh_token',
  expires_at: Math.floor(Date.now() / 1000) + 7200, // 2 heures
  token_type: 'bearer',
  scope: 'tweet.read tweet.write users.read follows.read follows.write',
  id_token: null,
  session_state: null,
})

export const mockMastodonAccount = (userId: string): Partial<DBAccount> => ({
  user_id: userId,
  type: 'oauth',
  provider: 'mastodon',
  provider_account_id: '987654321',
  access_token: 'encrypted_mastodon_access_token',
  refresh_token: null, // Mastodon n'utilise pas de refresh token
  expires_at: null,
  token_type: 'Bearer',
  scope: 'read write:follows',
  id_token: null,
  session_state: null,
})

export const mockBlueskyAccount = (userId: string): Partial<DBAccount> => ({
  user_id: userId,
  type: 'oauth',
  provider: 'bluesky',
  provider_account_id: 'did:plc:abcdef123456',
  access_token: 'encrypted_bluesky_access_token',
  refresh_token: 'encrypted_bluesky_refresh_token',
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 heure
  token_type: 'DPoP',
  scope: 'atproto transition:generic',
  id_token: null,
  session_state: null,
})

export const mockFacebookAccount = (userId: string): Partial<DBAccount> => ({
  user_id: userId,
  type: 'oauth',
  provider: 'facebook',
  provider_account_id: '111222333444',
  access_token: 'encrypted_facebook_access_token',
  refresh_token: null,
  expires_at: Math.floor(Date.now() / 1000) + 5184000, // 60 jours
  token_type: 'bearer',
  scope: 'public_profile email',
  id_token: null,
  session_state: null,
})

export const mockExpiredAccount = (userId: string): Partial<DBAccount> => ({
  user_id: userId,
  type: 'oauth',
  provider: 'twitter',
  provider_account_id: '999888777',
  access_token: 'encrypted_expired_access_token',
  refresh_token: 'encrypted_expired_refresh_token',
  expires_at: Math.floor(Date.now() / 1000) - 3600, // Expiré il y a 1 heure
  token_type: 'bearer',
  scope: 'tweet.read',
  id_token: null,
  session_state: null,
})

export const mockUpdatedTokens = {
  access_token: 'encrypted_new_access_token',
  refresh_token: 'encrypted_new_refresh_token',
  expires_at: Math.floor(Date.now() / 1000) + 7200,
  id_token: null,
}

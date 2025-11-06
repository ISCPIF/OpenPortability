import { describe, it, expect, beforeEach } from 'vitest'
import { pgAccountRepository } from '../../../repositories/auth/pg-account-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { encrypt, decrypt } from '../../../encryption'
import {
  mockTwitterAccount,
  mockMastodonAccount,
  mockBlueskyAccount,
  mockFacebookAccount,
  mockUpdatedTokens,
} from '../../fixtures/account-fixtures'
import { mockTwitterUser } from '../../fixtures/user-fixtures'

describe('PgAccountRepository', () => {
  describe('Token Encryption/Decryption', () => {
    it('should decrypt tokens when retrieving account via getProviderAccount', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      
      // Insert account with plain tokens (will be encrypted by upsertAccount)
      await pgAccountRepository.upsertAccount(accountData)
      
      // Retrieve via getProviderAccount - tokens should be decrypted
      const retrieved = await pgAccountRepository.getProviderAccount('twitter', user.id)
      
      expect(retrieved).not.toBeNull()
      expect(retrieved?.access_token).toBe(accountData.access_token)
      expect(retrieved?.refresh_token).toBe(accountData.refresh_token)
      // Verify tokens are not encrypted (they should be plain strings)
      expect(retrieved?.access_token).not.toBe(encrypt(accountData.access_token!))
    })

    it('should encrypt tokens when updating via updateTokens', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      
      await pgAccountRepository.upsertAccount(accountData)
      
      const newAccessToken = 'new_plain_access_token_12345'
      const newRefreshToken = 'new_plain_refresh_token_67890'
      
      // Update tokens with plain values
      const updated = await pgAccountRepository.updateTokens(
        'twitter',
        accountData.provider_account_id!,
        {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }
      )
      
      // Returned tokens should be decrypted
      expect(updated.access_token).toBe(newAccessToken)
      expect(updated.refresh_token).toBe(newRefreshToken)
      
      // Verify by retrieving again - should still be decrypted
      const retrieved = await pgAccountRepository.getProviderAccount('twitter', user.id)
      expect(retrieved?.access_token).toBe(newAccessToken)
      expect(retrieved?.refresh_token).toBe(newRefreshToken)
    })

    it('should handle null tokens correctly', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockMastodonAccount(user.id) // Mastodon doesn't use refresh token
      
      await pgAccountRepository.upsertAccount(accountData)
      
      const retrieved = await pgAccountRepository.getProviderAccount('mastodon', user.id)
      
      expect(retrieved?.access_token).toBe(accountData.access_token)
      expect(retrieved?.refresh_token).toBeNull()
    })

    it('should decrypt id_token if present', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      accountData.id_token = 'test_id_token_value'
      
      await pgAccountRepository.upsertAccount(accountData)
      
      const retrieved = await pgAccountRepository.getProviderAccount('twitter', user.id)
      
      expect(retrieved?.id_token).toBe('test_id_token_value')
      expect(retrieved?.id_token).not.toBe(encrypt('test_id_token_value'))
    })
  })

  describe('upsertAccount & getAccount', () => {
    it('should create and retrieve a Twitter account', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      
      const created = await pgAccountRepository.upsertAccount(accountData)
      
      expect(created.id).toBeDefined()
      expect(created.provider).toBe('twitter')
      expect(created.provider_account_id).toBe(accountData.provider_account_id)
      expect(created.access_token).toBe(accountData.access_token)
      
      const retrieved = await pgAccountRepository.getAccount('twitter', accountData.provider_account_id!)
      expect(retrieved).toEqual(created)
    })

    it('should create and retrieve a Mastodon account', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockMastodonAccount(user.id)
      
      const created = await pgAccountRepository.upsertAccount(accountData)
      
      expect(created.provider).toBe('mastodon')
      expect(created.refresh_token).toBeNull() // Mastodon n'utilise pas refresh token
      
      const retrieved = await pgAccountRepository.getAccount('mastodon', accountData.provider_account_id!)
      expect(retrieved).toEqual(created)
    })

    it('should create and retrieve a Bluesky account', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockBlueskyAccount(user.id)
      
      const created = await pgAccountRepository.upsertAccount(accountData)
      
      expect(created.provider).toBe('bluesky')
      expect(created.provider_account_id).toContain('did:plc:')
      
      const retrieved = await pgAccountRepository.getAccount('bluesky', accountData.provider_account_id!)
      expect(retrieved).toEqual(created)
    })

    it('should create and retrieve a Facebook account', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockFacebookAccount(user.id)
      
      const created = await pgAccountRepository.upsertAccount(accountData)
      
      expect(created.provider).toBe('facebook')
      
      const retrieved = await pgAccountRepository.getAccount('facebook', accountData.provider_account_id!)
      expect(retrieved).toEqual(created)
    })

    it('should update existing account on conflict (upsert)', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      
      const created = await pgAccountRepository.upsertAccount(accountData)
      
      // Upsert avec nouvelles données
      const updatedData = {
        ...accountData,
        access_token: 'new_encrypted_token',
        expires_at: Math.floor(Date.now() / 1000) + 10000,
      }
      
      const updated = await pgAccountRepository.upsertAccount(updatedData)
      
      expect(updated.id).toBe(created.id) // Même ID
      expect(updated.access_token).toBe('new_encrypted_token')
      expect(updated.expires_at).toBe(updatedData.expires_at)
    })

    it('should return null when account not found', async () => {
      const result = await pgAccountRepository.getAccount('twitter', 'nonexistent123')
      expect(result).toBeNull()
    })
  })

  describe('getProviderAccount', () => {
    it('should retrieve account by provider and user_id', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      
      await pgAccountRepository.upsertAccount(accountData)
      
      const retrieved = await pgAccountRepository.getProviderAccount('twitter', user.id)
      expect(retrieved?.provider).toBe('twitter')
      expect(retrieved?.user_id).toBe(user.id)
    })

    it('should return null when provider account not found', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      
      const result = await pgAccountRepository.getProviderAccount('twitter', user.id)
      expect(result).toBeNull()
    })
  })

  describe('getAccountsByUserId', () => {
    it('should retrieve all accounts for a user', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      
      await pgAccountRepository.upsertAccount(mockTwitterAccount(user.id))
      await pgAccountRepository.upsertAccount(mockMastodonAccount(user.id))
      await pgAccountRepository.upsertAccount(mockBlueskyAccount(user.id))
      
      const accounts = await pgAccountRepository.getAccountsByUserId(user.id)
      
      expect(accounts).toHaveLength(3)
      expect(accounts.map(a => a.provider).sort()).toEqual(['bluesky', 'mastodon', 'twitter'])
    })

    it('should return empty array when user has no accounts', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      
      const accounts = await pgAccountRepository.getAccountsByUserId(user.id)
      expect(accounts).toEqual([])
    })
  })

  describe('updateTokens', () => {
    it('should update account tokens', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      
      await pgAccountRepository.upsertAccount(accountData)
      
      const updated = await pgAccountRepository.updateTokens(
        'twitter',
        accountData.provider_account_id!,
        mockUpdatedTokens
      )
      
      expect(updated.access_token).toBe(mockUpdatedTokens.access_token)
      expect(updated.refresh_token).toBe(mockUpdatedTokens.refresh_token)
      expect(updated.expires_at).toBe(mockUpdatedTokens.expires_at)
    })

    it('should throw error when updating non-existent account', async () => {
      await expect(
        pgAccountRepository.updateTokens('twitter', 'nonexistent123', mockUpdatedTokens)
      ).rejects.toThrow()
    })
  })

  describe('deleteAccount', () => {
    it('should delete an account', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const accountData = mockTwitterAccount(user.id)
      
      await pgAccountRepository.upsertAccount(accountData)
      
      await pgAccountRepository.deleteAccount('twitter', accountData.provider_account_id!)
      
      const retrieved = await pgAccountRepository.getAccount('twitter', accountData.provider_account_id!)
      expect(retrieved).toBeNull()
    })
  })

  describe('deleteAccountsByUserId', () => {
    it('should delete all accounts for a user', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      
      await pgAccountRepository.upsertAccount(mockTwitterAccount(user.id))
      await pgAccountRepository.upsertAccount(mockMastodonAccount(user.id))
      
      await pgAccountRepository.deleteAccountsByUserId(user.id)
      
      const accounts = await pgAccountRepository.getAccountsByUserId(user.id)
      expect(accounts).toEqual([])
    })
  })
})

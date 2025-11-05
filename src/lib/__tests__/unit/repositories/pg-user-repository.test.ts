import { describe, it, expect } from 'vitest'
import { pgUserRepository } from '../../../repositories/pg-user-repository'
import {
  mockTwitterUser,
  mockMastodonUser,
  mockBlueskyUser,
  mockOnboardedUser,
} from '../../fixtures/user-fixtures'

describe('PgUserRepository', () => {
  describe('createUser & getUser', () => {
    it('should create and retrieve a Twitter user', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      expect(created.id).toBeDefined()
      expect(created.twitter_id).toBe(mockTwitterUser.twitter_id)
      expect(created.twitter_username).toBe(mockTwitterUser.twitter_username)
      
      const retrieved = await pgUserRepository.getUser(created.id)
      expect(retrieved).toEqual(created)
    })

    it('should create and retrieve a Mastodon user', async () => {
      const created = await pgUserRepository.createUser(mockMastodonUser)
      
      expect(created.id).toBeDefined()
      expect(created.mastodon_id).toBe(mockMastodonUser.mastodon_id)
      expect(created.mastodon_username).toBe(mockMastodonUser.mastodon_username)
      expect(created.mastodon_instance).toBe(mockMastodonUser.mastodon_instance)
      
      const retrieved = await pgUserRepository.getUser(created.id)
      expect(retrieved).toEqual(created)
    })

    it('should create and retrieve a Bluesky user', async () => {
      const created = await pgUserRepository.createUser(mockBlueskyUser)
      
      expect(created.id).toBeDefined()
      expect(created.bluesky_id).toBe(mockBlueskyUser.bluesky_id)
      expect(created.bluesky_username).toBe(mockBlueskyUser.bluesky_username)
      
      const retrieved = await pgUserRepository.getUser(created.id)
      expect(retrieved).toEqual(created)
    })

    it('should return null when user not found', async () => {
      const result = await pgUserRepository.getUser('00000000-0000-0000-0000-000000000000')
      expect(result).toBeNull()
    })
  })

  describe('getUserByEmail', () => {
    it('should retrieve user by email', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      const retrieved = await pgUserRepository.getUserByEmail(mockTwitterUser.email!)
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.email).toBe(mockTwitterUser.email)
    })

    it('should return null when email not found', async () => {
      const result = await pgUserRepository.getUserByEmail('nonexistent@example.com')
      expect(result).toBeNull()
    })
  })

  describe('getUserByProviderId', () => {
    it('should retrieve user by Twitter ID', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      const retrieved = await pgUserRepository.getUserByProviderId('twitter', mockTwitterUser.twitter_id!)
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.twitter_id).toBe(mockTwitterUser.twitter_id)
    })

    it('should retrieve user by Mastodon ID', async () => {
      const created = await pgUserRepository.createUser(mockMastodonUser)
      
      const retrieved = await pgUserRepository.getUserByProviderId('mastodon', mockMastodonUser.mastodon_id!)
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.mastodon_id).toBe(mockMastodonUser.mastodon_id)
    })

    it('should retrieve user by Bluesky ID', async () => {
      const created = await pgUserRepository.createUser(mockBlueskyUser)
      
      const retrieved = await pgUserRepository.getUserByProviderId('bluesky', mockBlueskyUser.bluesky_id!)
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.bluesky_id).toBe(mockBlueskyUser.bluesky_id)
    })

    it('should return null when provider ID not found', async () => {
      const result = await pgUserRepository.getUserByProviderId('mastodon', 'nonexistent123')
      expect(result).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      const updates = {
        name: 'Updated Name',
        has_onboarded: true,
        hqx_newsletter: true,
      }
      
      const updated = await pgUserRepository.updateUser(created.id, updates)
      
      expect(updated.name).toBe('Updated Name')
      expect(updated.has_onboarded).toBe(true)
      expect(updated.hqx_newsletter).toBe(true)
      expect(updated.twitter_id).toBe(mockTwitterUser.twitter_id) // Unchanged
    })

    it('should update provider fields', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      const updates = {
        bluesky_id: 'did:plc:newbluesky',
        bluesky_username: 'newuser.bsky.social',
      }
      
      const updated = await pgUserRepository.updateUser(created.id, updates)
      
      expect(updated.bluesky_id).toBe('did:plc:newbluesky')
      expect(updated.bluesky_username).toBe('newuser.bsky.social')
      expect(updated.twitter_id).toBe(mockTwitterUser.twitter_id) // Unchanged
    })

    it('should throw error when updating non-existent user', async () => {
      await expect(
        pgUserRepository.updateUser('00000000-0000-0000-0000-000000000000', { name: 'Test' })
      ).rejects.toThrow()
    })
  })

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      await pgUserRepository.deleteUser(created.id)
      
      const retrieved = await pgUserRepository.getUser(created.id)
      expect(retrieved).toBeNull()
    })
  })

  describe('hasShareEvents', () => {
    it('should return false when user has no share events', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      const result = await pgUserRepository.hasShareEvents(created.id)
      expect(result).toBe(false)
    })
  })

  describe('getUserActiveConsents', () => {
    it('should return empty object when user has no consents', async () => {
      const created = await pgUserRepository.createUser(mockTwitterUser)
      
      const result = await pgUserRepository.getUserActiveConsents(created.id)
      expect(result).toEqual({})
    })
  })
})

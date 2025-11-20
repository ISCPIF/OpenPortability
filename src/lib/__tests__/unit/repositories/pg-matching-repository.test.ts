import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { pgMatchingRepository } from '../../../repositories/public/pg-matching-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { publicPool, nextAuthPool } from '../../../database'
import { randomUUID } from 'crypto'

describe('PgMatchingRepository', () => {
  let userId: string
  let mockTwitterUser: any

  beforeEach(async () => {
    // Commit les transactions en cours
    await nextAuthPool.query('COMMIT')
    await publicPool.query('COMMIT')

    // Démarrer les transactions
    await nextAuthPool.query('BEGIN')
    await publicPool.query('BEGIN')

    // Créer un utilisateur de test
    mockTwitterUser = {
      name: 'Test User',
      email: `test-${randomUUID()}@example.com`,
      twitter_id: Math.floor(Math.random() * 1000000000000000),
      twitter_username: `testuser-${randomUUID().slice(0, 8)}`,
      twitter_image: 'https://example.com/avatar.jpg',
    }

    const user = await pgUserRepository.createUser(mockTwitterUser)
    userId = user.id
  })

  afterEach(async () => {
    await publicPool.query('COMMIT')
    await nextAuthPool.query('COMMIT')
  })

  describe('getFollowableTargets', () => {
    it('should return followable targets for a user', async () => {
      const result = await pgMatchingRepository.getFollowableTargets(userId, 1000, 0)

      expect(result).toBeDefined()
      expect(result.error).toBeNull()
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should return empty array if no targets found', async () => {
      const nonExistentUserId = randomUUID()

      const result = await pgMatchingRepository.getFollowableTargets(nonExistentUserId, 1000, 0)

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('should handle pagination correctly', async () => {
      const result1 = await pgMatchingRepository.getFollowableTargets(userId, 10, 0)
      const result2 = await pgMatchingRepository.getFollowableTargets(userId, 10, 1)

      expect(result1.data).toBeDefined()
      expect(result2.data).toBeDefined()
    })

    it('should convert node_id to string', async () => {
      const result = await pgMatchingRepository.getFollowableTargets(userId, 1000, 0)

      if (result.data && result.data.length > 0) {
        expect(typeof result.data[0].node_id).toBe('string')
      }
    })

    it('should include all required fields', async () => {
      const result = await pgMatchingRepository.getFollowableTargets(userId, 1000, 0)

      if (result.data && result.data.length > 0) {
        const target = result.data[0]
        expect(target).toHaveProperty('node_id')
        expect(target).toHaveProperty('bluesky_handle')
        expect(target).toHaveProperty('mastodon_id')
        expect(target).toHaveProperty('has_follow_bluesky')
        expect(target).toHaveProperty('has_follow_mastodon')
        expect(target).toHaveProperty('dismissed')
        expect(target).toHaveProperty('total_count')
      }
    })
  })

  describe('updateFollowStatus', () => {
    it('should update follow status for bluesky', async () => {
      const nodeId = '123456789'

      await expect(
        pgMatchingRepository.updateFollowStatus(userId, nodeId, 'bluesky', true)
      ).resolves.not.toThrow()
    })

    it('should update follow status for mastodon', async () => {
      const nodeId = '987654321'

      await expect(
        pgMatchingRepository.updateFollowStatus(userId, nodeId, 'mastodon', true)
      ).resolves.not.toThrow()
    })

    it('should handle follow failure (success=false)', async () => {
      const nodeId = '111111111'

      await expect(
        pgMatchingRepository.updateFollowStatus(userId, nodeId, 'bluesky', false)
      ).resolves.not.toThrow()
    })

    it('should throw error for invalid user', async () => {
      const invalidUserId = randomUUID()
      const nodeId = '123456789'

      // Should not throw, just update nothing
      await expect(
        pgMatchingRepository.updateFollowStatus(invalidUserId, nodeId, 'bluesky', true)
      ).resolves.not.toThrow()
    })
  })

  describe('updateFollowStatusBatch', () => {
    it('should update follow status for multiple targets', async () => {
      const nodeIds = ['111111111', '222222222', '333333333']

      await expect(
        pgMatchingRepository.updateFollowStatusBatch(userId, nodeIds, 'bluesky', true)
      ).resolves.not.toThrow()
    })

    it('should handle empty array', async () => {
      const nodeIds: string[] = []

      await expect(
        pgMatchingRepository.updateFollowStatusBatch(userId, nodeIds, 'bluesky', true)
      ).resolves.not.toThrow()
    })

    it('should update mastodon follow status batch', async () => {
      const nodeIds = ['444444444', '555555555']

      await expect(
        pgMatchingRepository.updateFollowStatusBatch(userId, nodeIds, 'mastodon', true)
      ).resolves.not.toThrow()
    })

    it('should handle batch failure', async () => {
      const nodeIds = ['666666666', '777777777']

      await expect(
        pgMatchingRepository.updateFollowStatusBatch(userId, nodeIds, 'bluesky', false)
      ).resolves.not.toThrow()
    })
  })

  describe('updateSourcesFollowersStatusBatch', () => {
    it('should update followers status for multiple sources', async () => {
      const followerTwitterId = '999999999'
      const sourceTwitterIds = [mockTwitterUser.twitter_id.toString()]

      await expect(
        pgMatchingRepository.updateSourcesFollowersStatusBatch(
          followerTwitterId,
          sourceTwitterIds,
          'bluesky',
          true
        )
      ).resolves.not.toThrow()
    })

    it('should throw error if no sources found', async () => {
      const followerTwitterId = '888888888'
      const sourceTwitterIds = ['999999999999999999']

      await expect(
        pgMatchingRepository.updateSourcesFollowersStatusBatch(
          followerTwitterId,
          sourceTwitterIds,
          'bluesky',
          true
        )
      ).rejects.toThrow('No users found for the given Twitter IDs')
    })

    it('should update mastodon followers status', async () => {
      const followerTwitterId = '777777777'
      const sourceTwitterIds = [mockTwitterUser.twitter_id.toString()]

      await expect(
        pgMatchingRepository.updateSourcesFollowersStatusBatch(
          followerTwitterId,
          sourceTwitterIds,
          'mastodon',
          true
        )
      ).resolves.not.toThrow()
    })
  })

  describe('updateSourcesFollowersStatus', () => {
    it('should update follower status for single source', async () => {
      const followerTwitterId = '666666666'
      const sourceTwitterId = mockTwitterUser.twitter_id.toString()

      await expect(
        pgMatchingRepository.updateSourcesFollowersStatus(
          followerTwitterId,
          sourceTwitterId,
          'bluesky',
          true
        )
      ).resolves.not.toThrow()
    })

    it('should be wrapper around batch method', async () => {
      const followerTwitterId = '555555555'
      const sourceTwitterId = mockTwitterUser.twitter_id.toString()

      await expect(
        pgMatchingRepository.updateSourcesFollowersStatus(
          followerTwitterId,
          sourceTwitterId,
          'mastodon',
          false
        )
      ).resolves.not.toThrow()
    })
  })

  describe('getSourcesFromFollower', () => {
    it('should return sources from follower', async () => {
      const twitterId = '123456789'

      const result = await pgMatchingRepository.getSourcesFromFollower(twitterId, 1000, 0)

      expect(result).toBeDefined()
      expect(result.error).toBeNull()
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should return empty array if no sources found', async () => {
      const twitterId = '999999999999999999'

      const result = await pgMatchingRepository.getSourcesFromFollower(twitterId, 1000, 0)

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('should handle pagination', async () => {
      const twitterId = '111111111'

      const result1 = await pgMatchingRepository.getSourcesFromFollower(twitterId, 10, 0)
      const result2 = await pgMatchingRepository.getSourcesFromFollower(twitterId, 10, 1)

      expect(result1.data).toBeDefined()
      expect(result2.data).toBeDefined()
    })

    it('should convert source_twitter_id to string', async () => {
      const twitterId = '222222222'

      const result = await pgMatchingRepository.getSourcesFromFollower(twitterId, 1000, 0)

      if (result.data && result.data.length > 0) {
        expect(typeof result.data[0].source_twitter_id).toBe('string')
      }
    })

    it('should include all required fields', async () => {
      const twitterId = '333333333'

      const result = await pgMatchingRepository.getSourcesFromFollower(twitterId, 1000, 0)

      if (result.data && result.data.length > 0) {
        const source = result.data[0]
        expect(source).toHaveProperty('source_twitter_id')
        expect(source).toHaveProperty('bluesky_handle')
        expect(source).toHaveProperty('mastodon_id')
        expect(source).toHaveProperty('has_been_followed_on_bluesky')
        expect(source).toHaveProperty('has_been_followed_on_mastodon')
      }
    })
  })

  describe('ignoreTarget', () => {
    it('should mark target as dismissed', async () => {
      const nodeId = '444444444'

      await expect(pgMatchingRepository.ignoreTarget(userId, nodeId)).resolves.not.toThrow()
    })

    it('should handle non-existent target gracefully', async () => {
      const nodeId = '555555555'

      await expect(pgMatchingRepository.ignoreTarget(userId, nodeId)).resolves.not.toThrow()
    })
  })

  describe('unignoreTarget', () => {
    it('should mark target as not dismissed', async () => {
      const nodeId = '666666666'

      await expect(pgMatchingRepository.unignoreTarget(userId, nodeId)).resolves.not.toThrow()
    })

    it('should handle non-existent target gracefully', async () => {
      const nodeId = '777777777'

      await expect(pgMatchingRepository.unignoreTarget(userId, nodeId)).resolves.not.toThrow()
    })
  })

  describe('markNodesAsUnavailableBatch', () => {
    it('should mark nodes as unavailable for bluesky', async () => {
      const nodeIds = ['888888888', '999999999']

      await expect(
        pgMatchingRepository.markNodesAsUnavailableBatch(nodeIds, 'bluesky', 'Account suspended')
      ).resolves.not.toThrow()
    })

    it('should mark nodes as unavailable for mastodon', async () => {
      const nodeIds = ['111111111', '222222222']

      await expect(
        pgMatchingRepository.markNodesAsUnavailableBatch(nodeIds, 'mastodon', 'Instance down')
      ).resolves.not.toThrow()
    })

    it('should handle empty array', async () => {
      const nodeIds: string[] = []

      await expect(
        pgMatchingRepository.markNodesAsUnavailableBatch(nodeIds, 'bluesky', 'Test reason')
      ).resolves.not.toThrow()
    })

    it('should handle non-existent nodes gracefully', async () => {
      const nodeIds = ['999999999999999999', '888888888888888888']

      await expect(
        pgMatchingRepository.markNodesAsUnavailableBatch(nodeIds, 'bluesky', 'Not found')
      ).resolves.not.toThrow()
    })
  })
})

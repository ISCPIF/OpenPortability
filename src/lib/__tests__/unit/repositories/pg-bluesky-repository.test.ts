import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { pgBlueskyRepository } from '../../../repositories/public/pg-bluesky-repository'
import { pgAccountRepository } from '../../../repositories/auth/pg-account-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { nextAuthPool, publicPool } from '../../../database'
import { randomUUID } from 'crypto'
import { mockTwitterUser } from '../../fixtures/user-fixtures'

describe('PgBlueskyRepository', () => {
  let userId: string
  const blueskyDid = 'did:plc:' + randomUUID().replace(/-/g, '').slice(0, 24)
  const blueskyHandle = 'testuser.bsky.social'

  beforeEach(async () => {
    // Commit les transactions en cours
    await nextAuthPool.query('COMMIT')
    await publicPool.query('COMMIT')

    // Créer l'utilisateur et COMMIT
    await nextAuthPool.query('BEGIN')
    const user = await pgUserRepository.createUser({
      ...mockTwitterUser,
      email: `test-${randomUUID()}@example.com`,
      twitter_id: Math.floor(Math.random() * 1000000000000000).toString(),
      twitter_username: `twitteruser-${randomUUID().slice(0, 8)}`,
    })
    userId = user.id
    await nextAuthPool.query('COMMIT')

    // Redémarrer les transactions
    await nextAuthPool.query('BEGIN')
    await publicPool.query('BEGIN')
  })

  afterEach(async () => {
    // Nettoyer les données
    await nextAuthPool.query('COMMIT')
    await publicPool.query('COMMIT')

    await nextAuthPool.query('BEGIN')
    await nextAuthPool.query('DELETE FROM "next-auth".users WHERE id = $1', [userId])
    await nextAuthPool.query('COMMIT')

    // Redémarrer les transactions
    await nextAuthPool.query('BEGIN')
    await publicPool.query('BEGIN')
  })

  describe('getUserByBlueskyId', () => {
    it('should return null when user not found', async () => {
      const nonExistentDid = 'did:plc:' + randomUUID().replace(/-/g, '').slice(0, 24)
      const user = await pgBlueskyRepository.getUserByBlueskyId(nonExistentDid)
      expect(user).toBeNull()
    })

    it('should return user when Bluesky account exists', async () => {
      // COMMIT pour que linkBlueskyAccount puisse voir l'utilisateur
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      // Link a Bluesky account first dans une transaction
      await nextAuthPool.query('BEGIN')
      const blueskyData = {
        accessJwt: 'test-access-token',
        refreshJwt: 'test-refresh-token',
        handle: blueskyHandle,
        did: blueskyDid,
        scope: 'atproto',
        token_type: 'bearer',
      }

      await pgBlueskyRepository.linkBlueskyAccount(userId, blueskyData)
      await nextAuthPool.query('COMMIT')

      // Now retrieve the user
      await nextAuthPool.query('BEGIN')
      const user = await pgBlueskyRepository.getUserByBlueskyId(blueskyDid)
      expect(user).not.toBeNull()
      expect(user?.id).toBe(userId)
      await nextAuthPool.query('COMMIT')
      
      // Redémarrer les transactions pour afterEach
      await nextAuthPool.query('BEGIN')
      await publicPool.query('BEGIN')
    })
  })

  describe('linkBlueskyAccount', () => {
    it('should link a Bluesky account to a user', async () => {
      // COMMIT pour que linkBlueskyAccount puisse voir l'utilisateur
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      // Link dans une transaction
      await nextAuthPool.query('BEGIN')
      const blueskyData = {
        accessJwt: 'test-access-token',
        refreshJwt: 'test-refresh-token',
        handle: blueskyHandle,
        did: blueskyDid,
        scope: 'atproto',
        token_type: 'bearer',
      }

      await expect(
        pgBlueskyRepository.linkBlueskyAccount(userId, blueskyData)
      ).resolves.not.toThrow()
      await nextAuthPool.query('COMMIT')

      // Verify account was created by getting user by DID
      await nextAuthPool.query('BEGIN')
      const user = await pgBlueskyRepository.getUserByBlueskyId(blueskyDid)
      expect(user).not.toBeNull()
      expect(user?.id).toBe(userId)
      await nextAuthPool.query('COMMIT')
      
      // Redémarrer les transactions pour afterEach
      await nextAuthPool.query('BEGIN')
      await publicPool.query('BEGIN')
    })

    it('should handle different token types', async () => {
      const tokenTypes = ['bearer', 'Bearer', 'BEARER']

      for (const tokenType of tokenTypes) {
        const blueskyData = {
          accessJwt: `test-access-${tokenType}`,
          refreshJwt: `test-refresh-${tokenType}`,
          handle: `${blueskyHandle}-${tokenType}`,
          did: `did:plc:${randomUUID().replace(/-/g, '').slice(0, 24)}`,
          scope: 'atproto',
          token_type: tokenType,
        }

        await expect(
          pgBlueskyRepository.linkBlueskyAccount(userId, blueskyData)
        ).resolves.not.toThrow()
      }
    })

    it('should throw error if user does not exist', async () => {
      const nonExistentUserId = randomUUID()
      const blueskyData = {
        accessJwt: 'test-access-token',
        refreshJwt: 'test-refresh-token',
        handle: blueskyHandle,
        did: blueskyDid,
        scope: 'atproto',
        token_type: 'bearer',
      }

      await expect(
        pgBlueskyRepository.linkBlueskyAccount(nonExistentUserId, blueskyData)
      ).rejects.toThrow()
    })
  })

  describe('updateBlueskyProfile', () => {
    it('should update user Bluesky profile', async () => {
      // COMMIT pour que updateBlueskyProfile puisse voir l'utilisateur
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      await nextAuthPool.query('BEGIN')
      const profile = {
        did: blueskyDid,
        handle: blueskyHandle,
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      }

      await expect(
        pgBlueskyRepository.updateBlueskyProfile(userId, profile)
      ).resolves.not.toThrow()
      await nextAuthPool.query('COMMIT')

      // Verify profile was updated
      await nextAuthPool.query('BEGIN')
      const user = await pgUserRepository.getUser(userId)
      expect(user?.bluesky_id).toBe(blueskyDid)
      expect(user?.bluesky_username).toBe(blueskyHandle)
      expect(user?.bluesky_image).toBe('https://example.com/avatar.jpg')
    })

    it('should handle profile without avatar', async () => {
      // COMMIT pour que updateBlueskyProfile puisse voir l'utilisateur
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      await nextAuthPool.query('BEGIN')
      const profile = {
        did: blueskyDid,
        handle: blueskyHandle,
        displayName: 'Test User',
      }

      await expect(
        pgBlueskyRepository.updateBlueskyProfile(userId, profile)
      ).resolves.not.toThrow()
      await nextAuthPool.query('COMMIT')

      await nextAuthPool.query('BEGIN')
      const user = await pgUserRepository.getUser(userId)
      expect(user?.bluesky_id).toBe(blueskyDid)
      expect(user?.bluesky_username).toBe(blueskyHandle)
      expect(user?.bluesky_image).toBeNull()
    })

    it('should throw error if user does not exist', async () => {
      const nonExistentUserId = randomUUID()
      const profile = {
        did: blueskyDid,
        handle: blueskyHandle,
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      }

      await expect(
        pgBlueskyRepository.updateBlueskyProfile(nonExistentUserId, profile)
      ).rejects.toThrow()
    })
  })

  describe('updateFollowStatus', () => {
    it('should update follow status for a source-target relationship', async () => {
      // COMMIT pour créer source et node
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      // First, we need to create a sources_targets relationship
      const nodeId = Math.floor(Math.random() * 1000000000000000)
      
      // Create node entry first (FK constraint)
      await publicPool.query('BEGIN')
      await publicPool.query(
        `INSERT INTO nodes (twitter_id) VALUES ($1) ON CONFLICT (twitter_id) DO NOTHING`,
        [nodeId]
      )
      await publicPool.query('COMMIT')

      // Create source entry
      await publicPool.query('BEGIN')
      await publicPool.query(
        `INSERT INTO sources (id, bluesky_handle) VALUES ($1, $2)`,
        [userId, 'test.bsky.social']
      )
      await publicPool.query('COMMIT')

      // Create sources_targets entry
      await publicPool.query('BEGIN')
      await publicPool.query(
        `INSERT INTO sources_targets (source_id, node_id, has_follow_bluesky)
         VALUES ($1, $2, false)`,
        [userId, nodeId]
      )
      await publicPool.query('COMMIT')

      // Update follow status
      await publicPool.query('BEGIN')
      await expect(
        pgBlueskyRepository.updateFollowStatus(userId, nodeId.toString())
      ).resolves.not.toThrow()
      await publicPool.query('COMMIT')

      // Verify status was updated
      await publicPool.query('BEGIN')
      const result = await publicPool.query(
        `SELECT has_follow_bluesky FROM sources_targets
         WHERE source_id = $1 AND node_id = $2`,
        [userId, nodeId]
      )
      await publicPool.query('COMMIT')

      expect(result.rows[0]?.has_follow_bluesky).toBe(true)
      
      // Redémarrer les transactions
      await nextAuthPool.query('BEGIN')
      await publicPool.query('BEGIN')
    })

    it('should handle non-existent relationship gracefully', async () => {
      // COMMIT pour que updateFollowStatus puisse voir l'utilisateur
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      await publicPool.query('BEGIN')
      const nodeId = Math.floor(Math.random() * 1000000000000000).toString()

      // This should not throw even if relationship doesn't exist
      await expect(
        pgBlueskyRepository.updateFollowStatus(userId, nodeId)
      ).resolves.not.toThrow()
      await publicPool.query('COMMIT')
      
      // Redémarrer les transactions
      await nextAuthPool.query('BEGIN')
      await publicPool.query('BEGIN')
    })
  })
})

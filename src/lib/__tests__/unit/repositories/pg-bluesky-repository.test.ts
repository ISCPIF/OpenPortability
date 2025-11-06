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
      // Link a Bluesky account first
      const blueskyData = {
        accessJwt: 'test-access-token',
        refreshJwt: 'test-refresh-token',
        handle: blueskyHandle,
        did: blueskyDid,
        scope: 'atproto',
        token_type: 'bearer',
      }

      await pgBlueskyRepository.linkBlueskyAccount(userId, blueskyData)

      // Now retrieve the user
      const user = await pgBlueskyRepository.getUserByBlueskyId(blueskyDid)
      expect(user).not.toBeNull()
      expect(user?.id).toBe(userId)
    })
  })

  describe('linkBlueskyAccount', () => {
    it('should link a Bluesky account to a user', async () => {
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

      // Verify account was created
      const account = await pgAccountRepository.getProviderAccount('bluesky', blueskyDid)
      expect(account).not.toBeNull()
      expect(account?.id).toBe(userId)
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
      const profile = {
        did: blueskyDid,
        handle: blueskyHandle,
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      }

      await expect(
        pgBlueskyRepository.updateBlueskyProfile(userId, profile)
      ).resolves.not.toThrow()

      // Verify profile was updated
      const user = await pgUserRepository.getUser(userId)
      expect(user?.bluesky_id).toBe(blueskyDid)
      expect(user?.bluesky_username).toBe(blueskyHandle)
      expect(user?.bluesky_image).toBe('https://example.com/avatar.jpg')
    })

    it('should handle profile without avatar', async () => {
      const profile = {
        did: blueskyDid,
        handle: blueskyHandle,
        displayName: 'Test User',
      }

      await expect(
        pgBlueskyRepository.updateBlueskyProfile(userId, profile)
      ).resolves.not.toThrow()

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
      // First, we need to create a sources_targets relationship
      const targetTwitterId = Math.floor(Math.random() * 1000000000000000).toString()

      // Create source entry
      await publicPool.query('BEGIN')
      await publicPool.query(
        `INSERT INTO sources (id, bluesky_handle) VALUES ($1, $2)`,
        [userId, 'test.bsky.social']
      )

      // Create sources_targets entry
      await publicPool.query(
        `INSERT INTO sources_targets (source_id, target_twitter_id, has_follow_bluesky)
         VALUES ($1, $2, false)`,
        [userId, targetTwitterId]
      )
      await publicPool.query('COMMIT')

      // Update follow status
      await expect(
        pgBlueskyRepository.updateFollowStatus(userId, targetTwitterId)
      ).resolves.not.toThrow()

      // Verify status was updated
      await publicPool.query('BEGIN')
      const result = await publicPool.query(
        `SELECT has_follow_bluesky FROM sources_targets
         WHERE source_id = $1 AND target_twitter_id = $2`,
        [userId, targetTwitterId]
      )
      await publicPool.query('COMMIT')

      expect(result.rows[0]?.has_follow_bluesky).toBe(true)
    })

    it('should handle non-existent relationship gracefully', async () => {
      const targetTwitterId = Math.floor(Math.random() * 1000000000000000).toString()

      // This should not throw even if relationship doesn't exist
      await expect(
        pgBlueskyRepository.updateFollowStatus(userId, targetTwitterId)
      ).resolves.not.toThrow()
    })
  })
})

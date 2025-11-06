import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { pgShareEventsRepository } from '../../../repositories/public/pg-share-events-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { mockTwitterUser } from '../../fixtures/user-fixtures'
import { nextAuthPool, publicPool } from '../../../database'
import { randomUUID } from 'crypto'

describe('PgShareEventsRepository', () => {
  let userId: string
  let sourceId: string

  beforeEach(async () => {
    // Commit la transaction en cours du setup
    await nextAuthPool.query('COMMIT')
    await publicPool.query('COMMIT')
    
    // Créer l'utilisateur et COMMIT pour qu'il soit visible dans publicPool
    await nextAuthPool.query('BEGIN')
    const user = await pgUserRepository.createUser(mockTwitterUser)
    userId = user.id
    await nextAuthPool.query('COMMIT')
    
    // Créer une source dans la table sources (FK pour share_events)
    // Note: sources.id = users.id (relation 1-1)
    await publicPool.query('BEGIN')
    sourceId = userId
    await publicPool.query(
      `INSERT INTO sources (id, bluesky_handle) VALUES ($1, $2)`,
      [sourceId, 'test.bsky.social']
    )
    await publicPool.query('COMMIT')
    
    // Redémarrer les transactions pour le test
    await nextAuthPool.query('BEGIN')
    await publicPool.query('BEGIN')
  })

  afterEach(async () => {
    // Nettoyer les données créées
    await nextAuthPool.query('COMMIT')
    await publicPool.query('COMMIT')
    
    await publicPool.query('BEGIN')
    await publicPool.query('DELETE FROM sources WHERE id = $1', [userId])
    await publicPool.query('COMMIT')
    
    await nextAuthPool.query('BEGIN')
    await nextAuthPool.query('DELETE FROM "next-auth".users WHERE id = $1', [userId])
    await nextAuthPool.query('COMMIT')
    
    // Redémarrer les transactions pour les autres tests
    await nextAuthPool.query('BEGIN')
    await publicPool.query('BEGIN')
  })

  describe('createShareEvent', () => {
    it('should create a new share event', async () => {
      const event = {
        source_id: sourceId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      await expect(pgShareEventsRepository.createShareEvent(event)).resolves.not.toThrow()
    })

    it('should create share event with different platforms', async () => {
      const platforms = ['twitter', 'bluesky', 'mastodon']

      for (const platform of platforms) {
        const event = {
          source_id: sourceId,
          platform,
          shared_at: new Date().toISOString(),
          success: true,
        } as any

        await expect(pgShareEventsRepository.createShareEvent(event)).resolves.not.toThrow()
      }
    })

    it('should create share event with success=false', async () => {
      const event = {
        source_id: sourceId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: false,
      } as any

      await expect(pgShareEventsRepository.createShareEvent(event)).resolves.not.toThrow()
    })
  })

  describe('getShareEvents', () => {
    it('should return empty array when user has no events', async () => {
      const events = await pgShareEventsRepository.getShareEvents(userId)
      expect(events).toEqual([])
    })

    it('should return all share events for a user', async () => {
      // Create multiple events
      const event1 = {
        source_id: sourceId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      const event2 = {
        source_id: sourceId,
        platform: 'bluesky',
        shared_at: new Date().toISOString(),
        success: false,
      } as any

      await pgShareEventsRepository.createShareEvent(event1)
      await new Promise((resolve) => setTimeout(resolve, 10))
      await pgShareEventsRepository.createShareEvent(event2)

      const events = await pgShareEventsRepository.getShareEvents(userId)

      expect(events.length).toBeGreaterThanOrEqual(2)
      // Vérifier que les deux événements sont présents (ordre peut varier)
      const platforms = events.map(e => e.platform)
      expect(platforms).toContain('twitter')
      expect(platforms).toContain('bluesky')
    })

    it('should return events ordered by created_at DESC', async () => {
      const timestamps = []

      for (let i = 0; i < 3; i++) {
        const event = {
          source_id: sourceId,
          platform: 'twitter',
          shared_at: new Date().toISOString(),
          success: true,
        } as any
        await pgShareEventsRepository.createShareEvent(event)
        timestamps.push(new Date().toISOString())
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const events = await pgShareEventsRepository.getShareEvents(userId)

      expect(events.length).toBeGreaterThanOrEqual(3)
      // Verify DESC order (most recent first)
      for (let i = 0; i < events.length - 1; i++) {
        const current = new Date(events[i].created_at || '')
        const next = new Date(events[i + 1].created_at || '')
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    })
  })

  describe('hasShareEvents', () => {
    it('should return false when user has no events', async () => {
      const has = await pgShareEventsRepository.hasShareEvents(userId)
      expect(has).toBe(false)
    })

    it('should return true when user has events', async () => {
      const event = {
        source_id: sourceId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      await pgShareEventsRepository.createShareEvent(event)

      const has = await pgShareEventsRepository.hasShareEvents(userId)
      expect(has).toBe(true)
    })

    it('should return true even with one event', async () => {
      const event = {
        source_id: sourceId,
        platform: 'bluesky',
        shared_at: new Date().toISOString(),
        success: false,
      } as any

      await pgShareEventsRepository.createShareEvent(event)

      const has = await pgShareEventsRepository.hasShareEvents(userId)
      expect(has).toBe(true)
    })
  })

  describe('deleteShareEvents', () => {
    it('should delete all share events for a user', async () => {
      // Create events
      const event1 = {
        source_id: sourceId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      const event2 = {
        source_id: sourceId,
        platform: 'bluesky',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      await pgShareEventsRepository.createShareEvent(event1)
      await pgShareEventsRepository.createShareEvent(event2)

      // Verify events exist
      let events = await pgShareEventsRepository.getShareEvents(userId)
      expect(events.length).toBeGreaterThanOrEqual(2)

      // Delete all events
      await pgShareEventsRepository.deleteShareEvents(userId)

      // Verify all deleted
      events = await pgShareEventsRepository.getShareEvents(userId)
      expect(events).toEqual([])
    })

    it('should not affect other users events', async () => {
      // COMMIT les transactions en cours
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      // Create another user with unique data et COMMIT
      await nextAuthPool.query('BEGIN')
      const user2 = await pgUserRepository.createUser({
        ...mockTwitterUser,
        email: `test-${randomUUID()}@example.com`,
        twitter_id: Math.floor(Math.random() * 1000000000000000).toString(),
        twitter_username: `twitteruser-${randomUUID().slice(0, 8)}`,
      })
      await nextAuthPool.query('COMMIT')
      
      // Create a source for user2 (sources.id = users.id)
      await publicPool.query('BEGIN')
      const sourceId2 = user2.id
      await publicPool.query(
        `INSERT INTO sources (id, bluesky_handle) VALUES ($1, $2)`,
        [sourceId2, 'test2.bsky.social']
      )
      await publicPool.query('COMMIT')
      
      // Redémarrer les transactions pour le reste du test
      await nextAuthPool.query('BEGIN')
      await publicPool.query('BEGIN')

      // Create events for both users
      const event1 = {
        source_id: sourceId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      const event2 = {
        source_id: sourceId2,
        platform: 'bluesky',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      await pgShareEventsRepository.createShareEvent(event1)
      await pgShareEventsRepository.createShareEvent(event2)

      // Delete events for user1
      await pgShareEventsRepository.deleteShareEvents(userId)

      // Verify user1 has no events
      const user1Events = await pgShareEventsRepository.getShareEvents(userId)
      expect(user1Events).toEqual([])

      // Verify user2 still has events
      const user2Events = await pgShareEventsRepository.getShareEvents(user2.id)
      expect(user2Events.length).toBeGreaterThanOrEqual(1)
    })
  })
})

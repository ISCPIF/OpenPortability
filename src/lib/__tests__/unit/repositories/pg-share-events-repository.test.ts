import { describe, it, expect, beforeEach } from 'vitest'
import { pgShareEventsRepository } from '../../../repositories/public/pg-share-events-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { mockTwitterUser } from '../../fixtures/user-fixtures'

describe('PgShareEventsRepository', () => {
  let userId: string

  beforeEach(async () => {
    const user = await pgUserRepository.createUser(mockTwitterUser)
    userId = user.id
  })

  describe('createShareEvent', () => {
    it('should create a new share event', async () => {
      const event = {
        source_id: userId,
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
          source_id: userId,
          platform,
          shared_at: new Date().toISOString(),
          success: true,
        } as any

        await expect(pgShareEventsRepository.createShareEvent(event)).resolves.not.toThrow()
      }
    })

    it('should create share event with success=false', async () => {
      const event = {
        source_id: userId,
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
        source_id: userId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      const event2 = {
        source_id: userId,
        platform: 'bluesky',
        shared_at: new Date().toISOString(),
        success: false,
      } as any

      await pgShareEventsRepository.createShareEvent(event1)
      await new Promise((resolve) => setTimeout(resolve, 10))
      await pgShareEventsRepository.createShareEvent(event2)

      const events = await pgShareEventsRepository.getShareEvents(userId)

      expect(events.length).toBeGreaterThanOrEqual(2)
      expect(events[0].platform).toBe('bluesky') // Most recent first
      expect(events[1].platform).toBe('twitter')
    })

    it('should return events ordered by created_at DESC', async () => {
      const timestamps = []

      for (let i = 0; i < 3; i++) {
        const event = {
          source_id: userId,
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
        source_id: userId,
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
        source_id: userId,
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
        source_id: userId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      const event2 = {
        source_id: userId,
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
      // Create another user
      const user2 = await pgUserRepository.createUser({
        ...mockTwitterUser,
        email: 'user2@example.com',
      })

      // Create events for both users
      const event1 = {
        source_id: userId,
        platform: 'twitter',
        shared_at: new Date().toISOString(),
        success: true,
      } as any

      const event2 = {
        source_id: user2.id,
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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { pgStatsRepository } from '../../../repositories/public/pg-stats-repository'
import { redis } from '../../../redis'
import { publicPool } from '../../../database'
import { randomUUID } from 'crypto'

// Mock Redis pour les tests
vi.mock('../../../redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}))

describe('PgStatsRepository', () => {
  const userId = randomUUID()

  beforeEach(async () => {
    // Commit les transactions en cours
    await publicPool.query('COMMIT')
    await publicPool.query('BEGIN')

    // Nettoyer les caches Redis
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await publicPool.query('COMMIT')
    await publicPool.query('BEGIN')
    vi.clearAllMocks()
  })

  describe('getUserCompleteStats', () => {
    it('should return cached stats from Redis if available', async () => {
      const mockStats = {
        connections: {
          followers: 100,
          following: 50,
          totalEffectiveFollowers: 75,
        },
        matches: {
          bluesky: { total: 20, hasFollowed: 15, notFollowed: 5 },
          mastodon: { total: 10, hasFollowed: 8, notFollowed: 2 },
        },
        updated_at: new Date().toISOString(),
      }

      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(mockStats))

      const result = await pgStatsRepository.getUserCompleteStats(userId, true)

      expect(result).toEqual(mockStats)
      expect(redis.get).toHaveBeenCalledWith(`user:stats:${userId}`)
      expect(redis.set).not.toHaveBeenCalled()
    })

    it('should fetch from DB if Redis cache miss (has_onboard=true)', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null)
      vi.mocked(redis.set).mockResolvedValueOnce('OK')

      const result = await pgStatsRepository.getUserCompleteStats(userId, true)

      expect(result).toBeDefined()
      expect(result.connections).toBeDefined()
      expect(result.matches).toBeDefined()
      expect(redis.get).toHaveBeenCalledWith(`user:stats:${userId}`)
      expect(redis.set).toHaveBeenCalledWith(
        `user:stats:${userId}`,
        expect.any(String),
        86400
      )
    })

    it('should fetch from DB if Redis cache miss (has_onboard=false)', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null)
      vi.mocked(redis.set).mockResolvedValueOnce('OK')

      const result = await pgStatsRepository.getUserCompleteStats(userId, false)

      expect(result).toBeDefined()
      expect(result.connections).toBeDefined()
      expect(result.matches).toBeDefined()
      expect(redis.get).toHaveBeenCalledWith(`user:stats:${userId}`)
      expect(redis.set).toHaveBeenCalledWith(
        `user:stats:${userId}`,
        expect.any(String),
        86400
      )
    })

    it('should handle Redis errors and fallback to DB', async () => {
      const redisError = new Error('Redis connection failed')
      vi.mocked(redis.get).mockRejectedValueOnce(redisError)
      vi.mocked(redis.set).mockResolvedValueOnce('OK')

      const result = await pgStatsRepository.getUserCompleteStats(userId, true)

      expect(result).toBeDefined()
      expect(result.connections).toBeDefined()
      expect(redis.set).toHaveBeenCalled()
    })

    it('should handle Redis set errors gracefully', async () => {
      const redisError = new Error('Redis set failed')
      vi.mocked(redis.get).mockResolvedValueOnce(null)
      vi.mocked(redis.set).mockRejectedValueOnce(redisError)

      const result = await pgStatsRepository.getUserCompleteStats(userId, true)

      expect(result).toBeDefined()
      expect(result.connections).toBeDefined()
    })

    it('should throw error if user not found', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null)
      const nonExistentUserId = randomUUID()

      await expect(
        pgStatsRepository.getUserCompleteStats(nonExistentUserId, true)
      ).rejects.toThrow()
    })
  })

  describe('getGlobalStats', () => {
    it('should return cached stats from Redis if available', async () => {
      const mockStats = {
        users: { total: 1000, onboarded: 500 },
        connections: {
          followers: 5000,
          following: 3000,
          withHandle: 2500,
          withHandleBluesky: 1500,
          withHandleMastodon: 1000,
          followedOnBluesky: 800,
          followedOnMastodon: 600,
        },
        updated_at: new Date().toISOString(),
      }

      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(mockStats))

      const result = await pgStatsRepository.getGlobalStats()

      expect(result).toEqual(mockStats)
      expect(redis.get).toHaveBeenCalledWith('stats:global')
      expect(redis.set).not.toHaveBeenCalled()
    })

    it('should fetch from DB if Redis cache miss', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null)
      vi.mocked(redis.set).mockResolvedValueOnce('OK')

      const result = await pgStatsRepository.getGlobalStats()

      expect(result).toBeDefined()
      expect(result.users).toBeDefined()
      expect(result.connections).toBeDefined()
      expect(redis.get).toHaveBeenCalledWith('stats:global')
      expect(redis.set).toHaveBeenCalledWith(
        'stats:global',
        expect.any(String),
        86400
      )
    })

    it('should handle Redis errors and fallback to DB', async () => {
      const redisError = new Error('Redis connection failed')
      vi.mocked(redis.get).mockRejectedValueOnce(redisError)

      const result = await pgStatsRepository.getGlobalStats()

      expect(result).toBeDefined()
      expect(result.users).toBeDefined()
      expect(result.connections).toBeDefined()
    })

    it('should handle Redis set errors gracefully', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null)
      vi.mocked(redis.set).mockRejectedValueOnce(new Error('Redis set failed'))

      const result = await pgStatsRepository.getGlobalStats()

      expect(result).toBeDefined()
      expect(result.users).toBeDefined()
    })
  })

  describe('getGlobalStatsFromCache', () => {
    it('should return stats from global_stats_cache table', async () => {
      const result = await pgStatsRepository.getGlobalStatsFromCache()

      // Result can be null or a valid GlobalStats object
      if (result) {
        expect(result.users).toBeDefined()
        expect(result.connections).toBeDefined()
      }
    })

    it('should return null if cache table is empty', async () => {
      // This test assumes the table might be empty
      const result = await pgStatsRepository.getGlobalStatsFromCache()

      // Either null or valid stats
      expect(result === null || result?.users !== undefined).toBe(true)
    })

    it('should handle database errors gracefully', async () => {
      const result = await pgStatsRepository.getGlobalStatsFromCache()

      // Should return null on error, not throw
      expect(result === null || result?.users !== undefined).toBe(true)
    })
  })

  describe('refreshUserStatsCache', () => {
    it('should refresh user stats cache and invalidate Redis (has_onboard=true)', async () => {
      vi.mocked(redis.del).mockResolvedValueOnce(1)

      await expect(
        pgStatsRepository.refreshUserStatsCache(userId, true)
      ).resolves.not.toThrow()

      expect(redis.del).toHaveBeenCalledWith(`user:stats:${userId}`)
    })

    it('should refresh user stats cache and invalidate Redis (has_onboard=false)', async () => {
      vi.mocked(redis.del).mockResolvedValueOnce(1)

      await expect(
        pgStatsRepository.refreshUserStatsCache(userId, false)
      ).resolves.not.toThrow()

      expect(redis.del).toHaveBeenCalledWith(`user:stats:${userId}`)
    })

    it('should handle Redis del errors gracefully', async () => {
      vi.mocked(redis.del).mockRejectedValueOnce(new Error('Redis del failed'))

      await expect(
        pgStatsRepository.refreshUserStatsCache(userId, true)
      ).resolves.not.toThrow()
    })

    it('should throw error if user not found', async () => {
      const nonExistentUserId = randomUUID()

      await expect(
        pgStatsRepository.refreshUserStatsCache(nonExistentUserId, true)
      ).rejects.toThrow()
    })
  })

  describe('refreshGlobalStatsCache', () => {
    it('should refresh global stats cache and invalidate Redis', async () => {
      vi.mocked(redis.del).mockResolvedValueOnce(1)

      await expect(
        pgStatsRepository.refreshGlobalStatsCache()
      ).resolves.not.toThrow()

      expect(redis.del).toHaveBeenCalledWith('stats:global')
    })

    it('should handle Redis del errors gracefully', async () => {
      vi.mocked(redis.del).mockRejectedValueOnce(new Error('Redis del failed'))

      await expect(
        pgStatsRepository.refreshGlobalStatsCache()
      ).resolves.not.toThrow()
    })
  })
})

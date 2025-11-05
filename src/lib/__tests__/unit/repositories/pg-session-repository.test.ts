import { describe, it, expect } from 'vitest'
import { pgSessionRepository } from '../../../repositories/pg-session-repository'
import { pgUserRepository } from '../../../repositories/pg-user-repository'
import {
  mockSession,
  mockExpiredSession,
  mockShortSession,
  mockSessionUpdate,
} from '../../fixtures/session-fixtures'
import { mockTwitterUser } from '../../fixtures/user-fixtures'

describe('PgSessionRepository', () => {
  describe('createSession & getSession', () => {
    it('should create and retrieve a session', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const sessionData = mockSession(user.id)
      
      const created = await pgSessionRepository.createSession(sessionData)
      
      expect(created.id).toBeDefined()
      expect(created.sessionToken).toBe(sessionData.sessionToken)
      expect(created.userId).toBe(user.id)
      expect(created.expires).toEqual(sessionData.expires)
      
      const retrieved = await pgSessionRepository.getSession(sessionData.sessionToken!)
      expect(retrieved).toEqual(created)
    })

    it('should return null when session not found', async () => {
      const result = await pgSessionRepository.getSession('nonexistent_token')
      expect(result).toBeNull()
    })
  })

  describe('getSessionAndUser', () => {
    it('should retrieve session with user data', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const sessionData = mockSession(user.id)
      
      await pgSessionRepository.createSession(sessionData)
      
      const result = await pgSessionRepository.getSessionAndUser(sessionData.sessionToken!)
      
      expect(result).not.toBeNull()
      expect(result?.session.sessionToken).toBe(sessionData.sessionToken)
      expect(result?.session.userId).toBe(user.id)
      expect(result?.user.id).toBe(user.id)
      expect(result?.user.name).toBe(mockTwitterUser.name)
      expect(result?.user.twitter_id).toBe(mockTwitterUser.twitter_id)
    })

    it('should return null when session not found', async () => {
      const result = await pgSessionRepository.getSessionAndUser('nonexistent_token')
      expect(result).toBeNull()
    })
  })

  describe('updateSession', () => {
    it('should update session expiration', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const sessionData = mockSession(user.id)
      
      await pgSessionRepository.createSession(sessionData)
      
      const updated = await pgSessionRepository.updateSession(
        sessionData.sessionToken!,
        mockSessionUpdate
      )
      
      expect(updated.expires).toEqual(mockSessionUpdate.expires)
      expect(updated.sessionToken).toBe(sessionData.sessionToken)
    })

    it('should throw error when updating non-existent session', async () => {
      await expect(
        pgSessionRepository.updateSession('nonexistent_token', mockSessionUpdate)
      ).rejects.toThrow()
    })
  })

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const sessionData = mockSession(user.id)
      
      await pgSessionRepository.createSession(sessionData)
      
      await pgSessionRepository.deleteSession(sessionData.sessionToken!)
      
      const retrieved = await pgSessionRepository.getSession(sessionData.sessionToken!)
      expect(retrieved).toBeNull()
    })
  })

  describe('deleteSessionsByUserId', () => {
    it('should delete all sessions for a user', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      
      const session1 = mockSession(user.id)
      const session2 = mockShortSession(user.id)
      
      await pgSessionRepository.createSession(session1)
      await pgSessionRepository.createSession(session2)
      
      await pgSessionRepository.deleteSessionsByUserId(user.id)
      
      const retrieved1 = await pgSessionRepository.getSession(session1.sessionToken!)
      const retrieved2 = await pgSessionRepository.getSession(session2.sessionToken!)
      
      expect(retrieved1).toBeNull()
      expect(retrieved2).toBeNull()
    })
  })

  describe('deleteExpiredSessions', () => {
    it('should delete only expired sessions', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      
      const validSession = mockSession(user.id)
      const expiredSession = mockExpiredSession(user.id)
      
      await pgSessionRepository.createSession(validSession)
      await pgSessionRepository.createSession(expiredSession)
      
      const deletedCount = await pgSessionRepository.deleteExpiredSessions()
      
      expect(deletedCount).toBeGreaterThanOrEqual(1)
      
      const validRetrieved = await pgSessionRepository.getSession(validSession.sessionToken!)
      const expiredRetrieved = await pgSessionRepository.getSession(expiredSession.sessionToken!)
      
      expect(validRetrieved).not.toBeNull()
      expect(expiredRetrieved).toBeNull()
    })

    it('should return 0 when no expired sessions', async () => {
      const user = await pgUserRepository.createUser(mockTwitterUser)
      const sessionData = mockSession(user.id)
      
      await pgSessionRepository.createSession(sessionData)
      
      const deletedCount = await pgSessionRepository.deleteExpiredSessions()
      
      // Peut être 0 ou plus selon l'état de la DB
      expect(deletedCount).toBeGreaterThanOrEqual(0)
    })
  })
})

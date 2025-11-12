import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { pgLanguagePrefRepository } from '../../../repositories/public/pg-language-pref-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { mockTwitterUser } from '../../fixtures/user-fixtures'
import { nextAuthPool, publicPool } from '../../../database'
import { randomUUID } from 'crypto'

describe('PgLanguagePrefRepository', () => {
  let userId: string

  beforeEach(async () => {
    // Commit la transaction en cours du setup
    await nextAuthPool.query('COMMIT')
    await publicPool.query('COMMIT')
    
    // Créer l'utilisateur et COMMIT pour qu'il soit visible dans publicPool
    await nextAuthPool.query('BEGIN')
    const user = await pgUserRepository.createUser(mockTwitterUser)
    userId = user.id
    await nextAuthPool.query('COMMIT')
    
    // Redémarrer les transactions pour le test
    await nextAuthPool.query('BEGIN')
    await publicPool.query('BEGIN')
  })

  afterEach(async () => {
    // Nettoyer l'utilisateur créé
    await nextAuthPool.query('COMMIT')
    await publicPool.query('COMMIT')
    
    await nextAuthPool.query('BEGIN')
    await nextAuthPool.query('DELETE FROM "next-auth".users WHERE id = $1', [userId])
    await nextAuthPool.query('COMMIT')
    
    // Redémarrer les transactions pour les autres tests
    await nextAuthPool.query('BEGIN')
    await publicPool.query('BEGIN')
  })

  describe('getUserLanguagePreference', () => {
    it('should return null when user has no preference', async () => {
      const pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      expect(pref).toBeNull()
    })

    it('should return language preference when set', async () => {
      await pgLanguagePrefRepository.updateLanguagePreference(userId, 'fr')

      const pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      expect(pref).not.toBeNull()
      expect(pref?.language).toBe('fr')
      expect(pref?.user_id).toBe(userId)
    })
  })

  describe('updateLanguagePreference', () => {
    it('should create new language preference', async () => {
      await pgLanguagePrefRepository.updateLanguagePreference(userId, 'en')

      const pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      expect(pref?.language).toBe('en')
    })

    it('should update existing language preference', async () => {
      await pgLanguagePrefRepository.updateLanguagePreference(userId, 'en')
      let pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      expect(pref?.language).toBe('en')

      await pgLanguagePrefRepository.updateLanguagePreference(userId, 'es')
      pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      expect(pref?.language).toBe('es')
    })

    it('should support multiple languages', async () => {
      const languages = ['en', 'fr', 'es', 'de', 'it']

      for (const lang of languages) {
        await pgLanguagePrefRepository.updateLanguagePreference(userId, lang)
        const pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
        expect(pref?.language).toBe(lang)
      }
    })
  })

  describe('deleteLanguagePreference', () => {
    it('should delete language preference', async () => {
      await pgLanguagePrefRepository.updateLanguagePreference(userId, 'fr')
      let pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      expect(pref).not.toBeNull()

      await pgLanguagePrefRepository.deleteLanguagePreference(userId)
      pref = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      expect(pref).toBeNull()
    })

    it('should not affect other users preferences', async () => {
      // COMMIT les transactions en cours
      await nextAuthPool.query('COMMIT')
      await publicPool.query('COMMIT')
      
      // Créer user2 avec des données uniques et COMMIT
      await nextAuthPool.query('BEGIN')
      const user2 = await pgUserRepository.createUser({
        ...mockTwitterUser,
        email: `test-${randomUUID()}@example.com`,
        twitter_id: Math.floor(Math.random() * 1000000000000000).toString(),
        twitter_username: `twitteruser-${randomUUID().slice(0, 8)}`,
      })
      await nextAuthPool.query('COMMIT')
      
      // Redémarrer les transactions pour le reste du test
      await nextAuthPool.query('BEGIN')
      await publicPool.query('BEGIN')

      await pgLanguagePrefRepository.updateLanguagePreference(userId, 'fr')
      await pgLanguagePrefRepository.updateLanguagePreference(user2.id, 'en')

      await pgLanguagePrefRepository.deleteLanguagePreference(userId)

      const pref1 = await pgLanguagePrefRepository.getUserLanguagePreference(userId)
      const pref2 = await pgLanguagePrefRepository.getUserLanguagePreference(user2.id)

      expect(pref1).toBeNull()
      expect(pref2?.language).toBe('en')
    })
  })
})

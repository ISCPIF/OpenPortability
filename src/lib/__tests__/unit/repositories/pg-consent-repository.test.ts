import { describe, it, expect, beforeEach } from 'vitest'
import { pgConsentRepository } from '../../../repositories/public/pg-consent-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { mockTwitterUser } from '../../fixtures/user-fixtures'

describe('PgConsentRepository', () => {
  let userId: string

  beforeEach(async () => {
    // Create a test user for each test
    const user = await pgUserRepository.createUser(mockTwitterUser)
    userId = user.id
  })

  describe('getUserActiveConsents', () => {
    it('should return empty object when user has no consents', async () => {
      const consents = await pgConsentRepository.getUserActiveConsents(userId)
      expect(consents).toEqual({})
    })

    it('should return active consents as Record<string, boolean>', async () => {
      // Insert test consents
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'bluesky_dm',
        consent_value: false,
        is_active: true,
      })

      const consents = await pgConsentRepository.getUserActiveConsents(userId)

      expect(consents).toEqual({
        email_newsletter: true,
        bluesky_dm: false,
      })
    })

    it('should only return active consents', async () => {
      // Insert active consent
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      // Insert inactive consent
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'marketing',
        consent_value: true,
        is_active: false,
      })

      const consents = await pgConsentRepository.getUserActiveConsents(userId)

      expect(consents).toEqual({
        email_newsletter: true,
      })
      expect(consents.marketing).toBeUndefined()
    })
  })

  describe('getConsentHistory', () => {
    it('should return empty array when user has no history', async () => {
      const history = await pgConsentRepository.getConsentHistory(userId)
      expect(history).toEqual([])
    })

    it('should return all consents ordered by timestamp DESC', async () => {
      // Insert consents with delays to ensure different timestamps
      const consent1 = await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10))

      const consent2 = await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'marketing',
        consent_value: false,
        is_active: true,
      })

      const history = await pgConsentRepository.getConsentHistory(userId)

      expect(history.length).toBeGreaterThanOrEqual(2)
      expect(history[0].consent_type).toBe('marketing')
      expect(history[0].consent_value).toBe(false)
    })

    it('should filter by consent type when specified', async () => {
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'marketing',
        consent_value: false,
        is_active: true,
      })

      const history = await pgConsentRepository.getConsentHistory(userId, 'email_newsletter')

      expect(history).toHaveLength(1)
      expect(history[0].consent_type).toBe('email_newsletter')
      expect(history[0].consent_value).toBe(true)
    })
  })

  describe('updateConsent', () => {
    it('should create new consent and deactivate previous ones', async () => {
      // Insert initial consent
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      // Update consent
      await pgConsentRepository.updateConsent(userId, 'email_newsletter', false, {
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      })

      // Check active consent
      const active = await pgConsentRepository.getConsent(userId, 'email_newsletter')
      expect(active?.consent_value).toBe(false)
      expect(active?.ip_address).toBe('192.168.1.1')
      expect(active?.user_agent).toBe('Mozilla/5.0')

      // Check history
      const history = await pgConsentRepository.getConsentHistory(userId, 'email_newsletter')
      expect(history.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle IP address chain correctly', async () => {
      const ipChain = '192.168.1.1, 10.0.0.1, 172.16.0.1'

      await pgConsentRepository.updateConsent(userId, 'email_newsletter', true, {
        ip_address: ipChain,
      })

      const consent = await pgConsentRepository.getConsent(userId, 'email_newsletter')
      expect(consent?.ip_address).toBe('192.168.1.1') // First IP
      expect(consent?.ip_address_full).toBe(ipChain) // Full chain
    })

    it('should handle race condition (23505) gracefully', async () => {
      // Insert initial consent
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      // Simulate race condition: two concurrent updates
      // Both should succeed without throwing
      const promise1 = pgConsentRepository.updateConsent(userId, 'email_newsletter', false)
      const promise2 = pgConsentRepository.updateConsent(userId, 'email_newsletter', false)

      // Both should complete without error
      await expect(Promise.all([promise1, promise2])).resolves.toBeDefined()

      // Final state should be consistent
      const consent = await pgConsentRepository.getConsent(userId, 'email_newsletter')
      expect(consent?.consent_value).toBe(false)
    })

    it('should handle null metadata gracefully', async () => {
      await pgConsentRepository.updateConsent(userId, 'email_newsletter', true)

      const consent = await pgConsentRepository.getConsent(userId, 'email_newsletter')
      expect(consent?.consent_value).toBe(true)
      expect(consent?.ip_address).toBeNull()
      expect(consent?.user_agent).toBeNull()
    })
  })

  describe('insertConsent', () => {
    it('should insert a new consent', async () => {
      const consent = await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      expect(consent.id).toBeDefined()
      expect(consent.user_id).toBe(userId)
      expect(consent.consent_type).toBe('email_newsletter')
      expect(consent.consent_value).toBe(true)
      expect(consent.is_active).toBe(true)
    })

    it('should insert consent with IP and user agent', async () => {
      const consent = await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'marketing',
        consent_value: false,
        ip_address: '192.168.1.100',
        user_agent: 'Chrome/120.0',
        is_active: true,
      })

      expect(consent.ip_address).toBe('192.168.1.100')
      expect(consent.user_agent).toBe('Chrome/120.0')
    })
  })

  describe('upsertConsent', () => {
    it('should insert new consent if not exists', async () => {
      const consent = await pgConsentRepository.upsertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      expect(consent.consent_value).toBe(true)
    })

    it('should update existing consent on conflict', async () => {
      // Insert initial
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      // Upsert with different value
      const updated = await pgConsentRepository.upsertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: false,
        is_active: true,
      })

      expect(updated.consent_value).toBe(false)

      // Verify only one active consent exists
      const history = await pgConsentRepository.getConsentHistory(userId, 'email_newsletter')
      const activeCount = history.filter((c) => c.is_active).length
      expect(activeCount).toBe(1)
    })
  })

  describe('getConsent', () => {
    it('should return active consent by type', async () => {
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      const consent = await pgConsentRepository.getConsent(userId, 'email_newsletter')
      expect(consent).not.toBeNull()
      expect(consent?.consent_type).toBe('email_newsletter')
      expect(consent?.is_active).toBe(true)
    })

    it('should return null when consent not found', async () => {
      const consent = await pgConsentRepository.getConsent(userId, 'nonexistent')
      expect(consent).toBeNull()
    })

    it('should not return inactive consent', async () => {
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: false,
      })

      const consent = await pgConsentRepository.getConsent(userId, 'email_newsletter')
      expect(consent).toBeNull()
    })
  })

  describe('deleteConsent', () => {
    it('should delete a specific consent', async () => {
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      await pgConsentRepository.deleteConsent(userId, 'email_newsletter')

      const consent = await pgConsentRepository.getConsent(userId, 'email_newsletter')
      expect(consent).toBeNull()
    })
  })

  describe('deleteUserConsents', () => {
    it('should delete all consents for a user', async () => {
      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: true,
        is_active: true,
      })

      await pgConsentRepository.insertConsent({
        user_id: userId,
        consent_type: 'marketing',
        consent_value: false,
        is_active: true,
      })

      await pgConsentRepository.deleteUserConsents(userId)

      const consents = await pgConsentRepository.getUserActiveConsents(userId)
      expect(consents).toEqual({})
    })
  })
})

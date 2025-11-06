import { describe, it, expect, beforeEach } from 'vitest'
import { pgNewsletterListingRepository } from '../../../repositories/public/pg-newsletter-listing-repository'
import { pgUserRepository } from '../../../repositories/auth/pg-user-repository'
import { mockTwitterUser } from '../../fixtures/user-fixtures'

describe('PgNewsletterListingRepository', () => {
  let userId: string
  let userEmail: string

  beforeEach(async () => {
    userEmail = `test-${Date.now()}@example.com`
    const user = await pgUserRepository.createUser({
      ...mockTwitterUser,
      email: userEmail,
    })
    userId = user.id
  })

  describe('insertNewsletterListing', () => {
    it('should insert user into newsletter listing', async () => {
      await pgNewsletterListingRepository.insertNewsletterListing(userId)

      const listing = await pgNewsletterListingRepository.getNewsletterListing(userId)
      expect(listing).not.toBeNull()
      expect(listing?.user_id).toBe(userId)
      expect(listing?.email).toBe(userEmail)
    })

    it('should handle duplicate inserts gracefully', async () => {
      await pgNewsletterListingRepository.insertNewsletterListing(userId)
      // Second insert should not throw
      await expect(pgNewsletterListingRepository.insertNewsletterListing(userId)).resolves.not.toThrow()
    })

    it('should throw error if user not found', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000'
      await expect(pgNewsletterListingRepository.insertNewsletterListing(nonExistentUserId)).rejects.toThrow()
    })
  })

  describe('getNewsletterListing', () => {
    it('should return null when user not in listing', async () => {
      const listing = await pgNewsletterListingRepository.getNewsletterListing(userId)
      expect(listing).toBeNull()
    })

    it('should return listing when user is in list', async () => {
      await pgNewsletterListingRepository.insertNewsletterListing(userId)

      const listing = await pgNewsletterListingRepository.getNewsletterListing(userId)
      expect(listing).not.toBeNull()
      expect(listing?.user_id).toBe(userId)
      expect(listing?.email).toBe(userEmail)
    })
  })

  describe('isInNewsletterListing', () => {
    it('should return false when user not in listing', async () => {
      const isIn = await pgNewsletterListingRepository.isInNewsletterListing(userId)
      expect(isIn).toBe(false)
    })

    it('should return true when user is in listing', async () => {
      await pgNewsletterListingRepository.insertNewsletterListing(userId)

      const isIn = await pgNewsletterListingRepository.isInNewsletterListing(userId)
      expect(isIn).toBe(true)
    })
  })

  describe('deleteNewsletterListing', () => {
    it('should delete user from newsletter listing', async () => {
      await pgNewsletterListingRepository.insertNewsletterListing(userId)
      let listing = await pgNewsletterListingRepository.getNewsletterListing(userId)
      expect(listing).not.toBeNull()

      await pgNewsletterListingRepository.deleteNewsletterListing(userId)
      listing = await pgNewsletterListingRepository.getNewsletterListing(userId)
      expect(listing).toBeNull()
    })

    it('should not affect other users listings', async () => {
      const user2Email = `test2-${Date.now()}@example.com`
      const user2 = await pgUserRepository.createUser({
        ...mockTwitterUser,
        email: user2Email,
      })

      await pgNewsletterListingRepository.insertNewsletterListing(userId)
      await pgNewsletterListingRepository.insertNewsletterListing(user2.id)

      await pgNewsletterListingRepository.deleteNewsletterListing(userId)

      const listing1 = await pgNewsletterListingRepository.getNewsletterListing(userId)
      const listing2 = await pgNewsletterListingRepository.getNewsletterListing(user2.id)

      expect(listing1).toBeNull()
      expect(listing2).not.toBeNull()
      expect(listing2?.email).toBe(user2Email)
    })
  })
})

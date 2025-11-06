import { describe, it, expect } from 'vitest'
import { pgMastodonInstanceRepository } from '../../../repositories/auth/pg-mastodon-instance-repository'
import {
  mockMastodonSocial,
  mockPiailleFr,
  mockMastodonOnline,
  mockCustomInstance,
  mockInstanceUpdate,
  mockNewInstanceCredentials,
} from '../../fixtures/mastodon-instance-fixtures'

describe('PgMastodonInstanceRepository', () => {
  describe('createInstance & getInstance', () => {
    it('should create and retrieve a Mastodon instance', async () => {
      const created = await pgMastodonInstanceRepository.createInstance(mockMastodonSocial)
      
      expect(created.id).toBeDefined()
      expect(created.instance).toBe(mockMastodonSocial.instance)
      expect(created.client_id).toBe(mockMastodonSocial.client_id)
      expect(created.client_secret).toBe(mockMastodonSocial.client_secret)
      
      const retrieved = await pgMastodonInstanceRepository.getInstance(mockMastodonSocial.instance)
      expect(retrieved).toEqual(created)
    })

    it('should normalize instance name to lowercase', async () => {
      const created = await pgMastodonInstanceRepository.createInstance({
        instance: 'Mastodon.SOCIAL',
        client_id: 'test_id',
        client_secret: 'test_secret',
      })
      
      expect(created.instance).toBe('mastodon.social')
      
      const retrieved = await pgMastodonInstanceRepository.getInstance('MASTODON.SOCIAL')
      expect(retrieved?.instance).toBe('mastodon.social')
    })

    it('should return null when instance not found', async () => {
      const result = await pgMastodonInstanceRepository.getInstance('nonexistent.instance')
      expect(result).toBeNull()
    })
  })

  describe('getAllInstances', () => {
    it('should retrieve all instances', async () => {
      await pgMastodonInstanceRepository.createInstance(mockMastodonSocial)
      await pgMastodonInstanceRepository.createInstance(mockPiailleFr)
      await pgMastodonInstanceRepository.createInstance(mockMastodonOnline)
      
      const instances = await pgMastodonInstanceRepository.getAllInstances()
      
      expect(instances.length).toBeGreaterThanOrEqual(3)
      
      const instanceNames = instances.map(i => i.instance)
      expect(instanceNames).toContain(mockMastodonSocial.instance)
      expect(instanceNames).toContain(mockPiailleFr.instance)
      expect(instanceNames).toContain(mockMastodonOnline.instance)
    })

    it('should return instances sorted by name', async () => {
      await pgMastodonInstanceRepository.createInstance(mockMastodonSocial)
      await pgMastodonInstanceRepository.createInstance(mockPiailleFr)
      
      const instances = await pgMastodonInstanceRepository.getAllInstances()
      
      // Vérifier que les instances sont triées
      for (let i = 0; i < instances.length - 1; i++) {
        expect(instances[i].instance.localeCompare(instances[i + 1].instance)).toBeLessThanOrEqual(0)
      }
    })
  })

  describe('updateInstance', () => {
    it('should update instance credentials', async () => {
      await pgMastodonInstanceRepository.createInstance(mockMastodonSocial)
      
      const updated = await pgMastodonInstanceRepository.updateInstance(
        mockMastodonSocial.instance,
        mockInstanceUpdate
      )
      
      expect(updated.client_id).toBe(mockInstanceUpdate.client_id)
      expect(updated.client_secret).toBe(mockInstanceUpdate.client_secret)
      expect(updated.instance).toBe(mockMastodonSocial.instance)
    })

    it('should throw error when updating non-existent instance', async () => {
      await expect(
        pgMastodonInstanceRepository.updateInstance('nonexistent.instance', mockInstanceUpdate)
      ).rejects.toThrow()
    })
  })

  describe('deleteInstance', () => {
    it('should delete an instance', async () => {
      await pgMastodonInstanceRepository.createInstance(mockCustomInstance)
      
      await pgMastodonInstanceRepository.deleteInstance(mockCustomInstance.instance)
      
      const retrieved = await pgMastodonInstanceRepository.getInstance(mockCustomInstance.instance)
      expect(retrieved).toBeNull()
    })
  })

  describe('getOrCreateInstance', () => {
    it('should return existing instance', async () => {
      const existing = await pgMastodonInstanceRepository.createInstance(mockMastodonSocial)
      
      const result = await pgMastodonInstanceRepository.getOrCreateInstance(
        mockMastodonSocial.instance,
        async () => {
          throw new Error('Should not be called')
        }
      )
      
      expect(result.id).toBe(existing.id)
      expect(result.instance).toBe(mockMastodonSocial.instance)
    })

    it('should create new instance if not exists', async () => {
      const newInstance = 'new.mastodon.instance'
      
      const result = await pgMastodonInstanceRepository.getOrCreateInstance(
        newInstance,
        async () => mockNewInstanceCredentials
      )
      
      expect(result.instance).toBe(newInstance)
      expect(result.client_id).toBe(mockNewInstanceCredentials.client_id)
      expect(result.client_secret).toBe(mockNewInstanceCredentials.client_secret)
      
      // Vérifier que l'instance a bien été créée
      const retrieved = await pgMastodonInstanceRepository.getInstance(newInstance)
      expect(retrieved).toEqual(result)
    })

    it('should normalize instance name in getOrCreate', async () => {
      const result = await pgMastodonInstanceRepository.getOrCreateInstance(
        'UPPERCASE.INSTANCE',
        async () => mockNewInstanceCredentials
      )
      
      expect(result.instance).toBe('uppercase.instance')
    })
  })
})

import { 
  IBlueskyRepository,
  BlueskySessionData,
  BlueskyProfile 
} from '../types/bluesky'
import { pgBlueskyRepository } from './public/pg-bluesky-repository'

/**
 * @deprecated Use pgBlueskyRepository from public schema instead
 * This class is kept for backward compatibility during migration
 */
export class BlueskyRepository implements IBlueskyRepository {
  /**
   * @deprecated Use pgBlueskyRepository.getUserByBlueskyId() instead
   */
  async getUserByBlueskyId(did: string) {
    return pgBlueskyRepository.getUserByBlueskyId(did)
  }

  /**
   * @deprecated Use pgBlueskyRepository.linkBlueskyAccount() instead
   */
  async linkBlueskyAccount(userId: string, blueskyData: BlueskySessionData): Promise<void> {
    return pgBlueskyRepository.linkBlueskyAccount(userId, blueskyData)
  }

  /**
   * @deprecated Use pgBlueskyRepository.updateBlueskyProfile() instead
   */
  async updateBlueskyProfile(userId: string, profile: BlueskyProfile): Promise<void> {
    return pgBlueskyRepository.updateBlueskyProfile(userId, profile)
  }

  /**
   * @deprecated Use pgBlueskyRepository.updateFollowStatus() instead
   */
  async updateFollowStatus(userId: string, targetTwitterId: string): Promise<void> {
    return pgBlueskyRepository.updateFollowStatus(userId, targetTwitterId)
  }
}
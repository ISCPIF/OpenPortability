import { MatchingTarget, StoredProcedureTarget } from '../types/matching'
import { pgMatchingRepository } from './public/pg-matching-repository'

/**
 * @deprecated Use pgMatchingRepository from public schema instead
 * This class is kept for backward compatibility during migration
 */
export class MatchingRepository {
  /**
   * @deprecated Use pgMatchingRepository.getFollowableTargets() instead
   */
  async getFollowableTargets(
    userId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    return pgMatchingRepository.getFollowableTargets(userId, pageSize, pageNumber)
  }

  /**
   * @deprecated Use pgMatchingRepository.updateFollowStatus() instead
   */
  async updateFollowStatus(
    userId: string,
    targetId: string,
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    return pgMatchingRepository.updateFollowStatus(userId, targetId, platform, success, error)
  }

  /**
   * @deprecated Use pgMatchingRepository.updateFollowStatusBatch() instead
   */
  async updateFollowStatusBatch(
    userId: string,
    targetIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    return pgMatchingRepository.updateFollowStatusBatch(userId, targetIds, platform, success, error)
  }

  /**
   * @deprecated Use pgMatchingRepository.updateSourcesFollowersStatusBatch() instead
   */
  async updateSourcesFollowersStatusBatch(
    followerTwitterId: string,
    sourceTwitterIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    return pgMatchingRepository.updateSourcesFollowersStatusBatch(
      followerTwitterId,
      sourceTwitterIds,
      platform,
      success,
      error
    )
  }

  /**
   * @deprecated Use pgMatchingRepository.updateSourcesFollowersStatus() instead
   */
  async updateSourcesFollowersStatus(
    followerTwitterId: string,
    sourceId: string,
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    return pgMatchingRepository.updateSourcesFollowersStatus(
      followerTwitterId,
      sourceId,
      platform,
      success,
      error
    )
  }

  /**
   * Met à jour le statut de suivi dans sources_followers pour un utilisateur non-onboarded
   * basé sur les node_id des cibles
   */
  async updateSourcesFollowersByNodeIds(
    followerTwitterId: string,
    targetNodeIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    return pgMatchingRepository.updateSourcesFollowersByNodeIds(
      followerTwitterId,
      targetNodeIds,
      platform,
      success,
      error
    )
  }

  /**
   * @deprecated Use pgMatchingRepository.getSourcesFromFollower() instead
   */
  async getSourcesFromFollower(
    twitterId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: any[] | null; error: any }> {
    return pgMatchingRepository.getSourcesFromFollower(twitterId, pageSize, pageNumber) as any
  }

  /**
   * @deprecated Use pgMatchingRepository.ignoreTarget() instead
   */
  async ignoreTarget(userId: string, targetTwitterId: string): Promise<void> {
    return pgMatchingRepository.ignoreTarget(userId, targetTwitterId)
  }

  /**
   * @deprecated Use pgMatchingRepository.unignoreTarget() instead
   */
  async unignoreTarget(userId: string, targetTwitterId: string): Promise<void> {
    return pgMatchingRepository.unignoreTarget(userId, targetTwitterId)
  }

  /**
   * @deprecated Use pgMatchingRepository.markNodesAsUnavailableBatch() instead
   */
  async markNodesAsUnavailableBatch(
    nodeIds: string[],
    platform: 'bluesky' | 'mastodon',
    reason: string
  ): Promise<void> {
    return pgMatchingRepository.markNodesAsUnavailableBatch(nodeIds, platform, reason)
  }
}
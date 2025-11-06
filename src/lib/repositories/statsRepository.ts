import { UserCompleteStats, GlobalStats } from "../types/stats";
import { pgStatsRepository } from "./public/pg-stats-repository";

/**
 * @deprecated Use pgStatsRepository from public schema instead
 * This class is kept for backward compatibility during migration
 */
export class StatsRepository {
  /**
   * @deprecated Use pgStatsRepository.getUserCompleteStats() instead
   */
  async getUserCompleteStats(userId: string, has_onboard: boolean): Promise<UserCompleteStats> {
    return pgStatsRepository.getUserCompleteStats(userId, has_onboard)
  }

  /**
   * @deprecated Use pgStatsRepository.getGlobalStats() instead
   */
  async getGlobalStats(): Promise<GlobalStats> {
    return pgStatsRepository.getGlobalStats()
  }

  /**
   * @deprecated Use pgStatsRepository.getGlobalStatsFromCache() instead
   */
  async getGlobalStatsFromCache(): Promise<GlobalStats | null> {
    return pgStatsRepository.getGlobalStatsFromCache()
  }

  /**
   * @deprecated Use pgStatsRepository.refreshUserStatsCache() instead
   */
  async refreshUserStatsCache(userId: string, has_onboard: boolean): Promise<void> {
    return pgStatsRepository.refreshUserStatsCache(userId, has_onboard)
  }

  /**
   * @deprecated Use pgStatsRepository.refreshGlobalStatsCache() instead
   */
  async refreshGlobalStatsCache(): Promise<void> {
    return pgStatsRepository.refreshGlobalStatsCache()
  }
}
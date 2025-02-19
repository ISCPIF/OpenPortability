import { StatsRepository } from "@/lib/repositories/statsRepository";
import { UserCompleteStats, GlobalStats, ReconnectionStats } from "@/lib/types/stats";

export class StatsService {
    private repository: StatsRepository;
    
    constructor(repository: StatsRepository) {
      this.repository = repository;
    }
    
    async getGlobalStats(): Promise<GlobalStats> {
      return this.repository.getGlobalStats();
    }

    async getUserStats(userId: string, has_onboard: boolean): Promise<UserCompleteStats> {
      return this.repository.getUserCompleteStats(userId, has_onboard);
    }

    async getReconnectionStats(): Promise<ReconnectionStats> {
      const globalStats = await this.repository.getGlobalStats();
      
      return {
        connections: globalStats.connections.followers + globalStats.connections.following,
        blueskyMappings: globalStats.connections.withHandle,
        sources: globalStats.users.total
      };
    }

    async refreshUserStats(userId: string, has_onboard: boolean): Promise<void> {
      return this.repository.refreshUserStatsCache(userId, has_onboard);
    }

    async refreshGlobalStats(): Promise<void> {
      return this.repository.refreshGlobalStatsCache();
    }
}
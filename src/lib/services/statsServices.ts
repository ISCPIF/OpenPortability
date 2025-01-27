import { StatsRepository } from "@/lib/repositories/statsRepository";
import { StatsResponse, ReconnectionStats } from "@/lib/types/stats";

export class StatsService {
    private repository: StatsRepository;
    
    constructor(repository: StatsRepository) {
      this.repository = repository;
    }
    
    async getTotalStats(): Promise<StatsResponse> {
      const [followersResult, followingResult, sourcesResult] = await Promise.all([
        this.repository.getFollowersCount(),
        this.repository.getFollowingCount(),
        this.repository.getSourcesCount()
      ]);

      return {
        total_followers: followersResult.data?.count ?? 0,
        total_following: followingResult.data?.count ?? 0,
        total_sources: sourcesResult.count ?? 0
      };
    }

    async getReconnectionStats(): Promise<ReconnectionStats> {
        try {
          const [
            followersData,
            followingData,
            targetsWithHandleData,
            sourcesData
          ] = await Promise.all([
            this.repository.getFollowersCount(),
            this.repository.getFollowingCount(),
            this.repository.getTargetsWithHandleCount(),
            this.repository.getSourcesCount()
          ]);
    
          const followersCount = followersData.data?.count ?? 0;
          const followingCount = followingData.data?.count ?? 0;
          const targetsWithHandleCount = targetsWithHandleData.data?.count ?? 0;
          const sourcesCount = sourcesData.count ?? 0;
          return {
            connections: Number(followersCount) + Number(followingCount),
            blueskyMappings: Number(targetsWithHandleCount),
            sources: Number(sourcesCount)
          };
        } catch (error) {
          throw error;
        }
      }
  }
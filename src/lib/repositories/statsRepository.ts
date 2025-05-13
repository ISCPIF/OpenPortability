import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { RawStatsData, UserCompleteStats, GlobalStats } from "../types/stats";
import { logError, logWarning } from "../log_utils";

interface CountResponse {
  count: number;
}

interface UserStats {
  targets_count: number;
  followers_count: number;
  has_follow_count: number;
}

interface PlatformMatchesCount {
  bluesky_matches_count: number;
  mastodon_matches_count: number;
}

export class StatsRepository {
    async getFollowersCount(): Promise<PostgrestSingleResponse<CountResponse>> {
      const response = await supabase.rpc('count_followers').single();
      if (response.error) {
        logError('Repository', 'StatsRepository.getFollowersCount', response.error, 'unknown');
      }
      return response;
    }

    async getFollowingCount(): Promise<PostgrestSingleResponse<CountResponse>> {
      const response = await supabase.rpc('count_targets').single();
      if (response.error) {
        logError('Repository', 'StatsRepository.getFollowingCount', response.error, 'unknown');
      }
      return response;
    }

    async getSourcesCount(): Promise<{ count: number }> {
      const { count } = await supabase
        .from('sources')
        .select('*', { count: 'exact', head: true });
      
      return { count: count ?? 0 };
    }

    async getTargetsWithHandleCount(): Promise<PostgrestSingleResponse<CountResponse>> {
        const response = await supabase.rpc('count_targets_with_handle').single();
        if (response.error) {
            logError('Repository', 'StatsRepository.getTargetsWithHandleCount', response.error, 'unknown');
        }
        return response;
    }

    async getUserCompleteStats(userId: string, has_onboard: boolean): Promise<UserCompleteStats> {
      let data, error;

      if (!has_onboard) {
        ({ data, error } = await supabase
          .rpc('get_user_complete_stats_from_sources', { p_user_id: userId })
          .abortSignal(AbortSignal.timeout(30000))  // Apply timeout before single()
          .single());
      } else {
        ({ data, error } = await supabase
          .rpc('get_user_complete_stats', { p_user_id: userId })
          .abortSignal(AbortSignal.timeout(30000))  // Apply timeout before single()
          .single());
      }

      if (error) {
        logError('Repository', 'StatsRepository.getUserCompleteStats', error, userId, { has_onboard });
        throw error;
      }

      return data;
    }

    async getGlobalStats(): Promise<GlobalStats> {
      const { data, error } = await supabase
        .rpc('get_global_stats')
        .single();

      if (error) {
        logError('Repository', 'StatsRepository.getGlobalStats', error, 'unknown');
        throw error;
      }

      return data;
    }

    async refreshUserStatsCache(userId: string, has_onboard: boolean): Promise<void> {
      let error;

      if (!has_onboard) {
        ({ error } = await supabase
          .rpc('get_user_complete_stats_from_sources', { 
            p_user_id: userId.toString() 
          })
          .single());
      } else {
        ({ error } = await supabase.rpc('refresh_user_stats_caches', {
          p_user_id: userId
        }));
      }
      
      if (error) {
        logError('Repository', 'StatsRepository.refreshUserStatsCache', error, userId, { has_onboard });
        throw error;
      }
    }

    async refreshGlobalStatsCache(): Promise<void> {
      const { error } = await supabase
        .rpc('refresh_global_stats_cache');

      if (error) {
        logError('Repository', 'StatsRepository.refreshGlobalStatsCache', error, 'unknown');
        throw error;
      }
    }

    async getPlatformMatchesCount(userId: string): Promise<PostgrestSingleResponse<PlatformMatchesCount>> {
      const response = await supabase
        .rpc('count_platform_matches', { user_id: userId })
        .single();
      if (response.error) {
        logError('Repository', 'StatsRepository.getPlatformMatchesCount', response.error, userId);
      }
      return response;
    }
}
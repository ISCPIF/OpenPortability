import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { redis } from '@/lib/redis';
import logger from '@/lib/log_utils';
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
    async getUserCompleteStats(userId: string, has_onboard: boolean): Promise<UserCompleteStats> {
      // 1. Essayer Redis d'abord
      try {
        const cacheKey = `user:stats:${userId}`;
        const cached = await redis.get(cacheKey);
        
        if (cached) {
          // logger.logInfo('Repository', 'StatsRepository.getUserCompleteStats', 'User stats served from Redis cache', userId, {
          //   context: 'Redis cache hit'
          // });
          console.log("USING CACHEEEEE")
          return JSON.parse(cached) as UserCompleteStats;
        }
      } catch (redisError) {
        logger.logWarning('Repository', 'StatsRepository.getUserCompleteStats', 'Redis unavailable, fallback to DB', userId, {
          context: 'Redis cache miss or error',
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
        });
      }

      // 2. Fallback vers DB (logique existante)
      let data: unknown, error: unknown;

      if (!has_onboard) {
        ({ data, error } = await supabase
          .rpc('get_user_complete_stats_from_sources', { p_user_id: userId })
          .abortSignal(AbortSignal.timeout(30000))
          .single());
      } else {
        ({ data, error } = await supabase
          .rpc('get_user_complete_stats', { p_user_id: userId })
          .abortSignal(AbortSignal.timeout(30000))
          .single());
      }

      console.log("stats are ->", data)

      if (error) {
        console.log('Repository', 'StatsRepository.getUserCompleteStats', error, userId, { has_onboard });
        throw error;
      }

      // 3. Mettre en cache Redis (TTL: 10 minutes)
      try {
        const cacheKey = `user:stats:${userId}`;
        await redis.set(cacheKey, JSON.stringify(data), 86400); // 10 minutes
        
        // logger.logInfo('Repository', 'StatsRepository.getUserCompleteStats', 'User stats cached in Redis', userId, {
          // context: 'Database result cached for 10 minutes'
        // });
      } catch (redisError) {
        logger.logWarning('Repository', 'StatsRepository.getUserCompleteStats', 'Failed to cache in Redis', userId, {
          context: 'Redis caching failed, continuing without cache',
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
        });
      }

      // console.log("data from getUserCompleteStats", data);
      return data as UserCompleteStats;
    }

    async getGlobalStats(): Promise<GlobalStats> {
      try {
        // 1. Essayer Redis d'abord
        const cached = await redis.get('stats:global');
        if (cached) {
          logger.logInfo('Repository', 'StatsRepository.getGlobalStats', 'Global stats served from Redis cache', 'system', {
            context: 'Redis cache hit for global stats'
          });
          return JSON.parse(cached) as GlobalStats;
        }

        // 2. Cache miss - récupérer depuis la DB
        logger.logInfo('Repository', 'StatsRepository.getGlobalStats', 'Redis cache miss, fetching from database', 'system', {
          context: 'Fallback to database for global stats'
        });

        const { data, error } = await supabase
          .rpc('get_global_stats')
          .single();

        if (error) {
          logger.logError('Repository', 'StatsRepository.getGlobalStats', error, 'system', {
            context: 'Database query failed for global stats'
          });
          throw error;
        }

        // 3. Mettre en cache pour éviter les futurs cache miss
        await redis.set('stats:global', JSON.stringify(data), 86400);
        
        logger.logInfo('Repository', 'StatsRepository.getGlobalStats', 'Global stats fetched from DB and cached', 'system', {
          context: 'Database fallback successful, data cached in Redis'
        });

        return data as GlobalStats;

      } catch (redisError) {
        // 4. Si Redis complètement indisponible, aller directement en DB
        logger.logWarning('Repository', 'StatsRepository.getGlobalStats', 'Redis unavailable, using database fallback', 'system', {
          context: 'Redis error, direct database access',
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
        });

        const { data, error } = await supabase
          .rpc('get_global_stats')
          .single();

        if (error) {
          logger.logError('Repository', 'StatsRepository.getGlobalStats', error, 'system', {
            context: 'Database fallback also failed'
          });
          throw error;
        }

        return data as GlobalStats;
      }
    }

    async getGlobalStatsFromCache(): Promise<GlobalStats | null> {
      try {
        const { data, error } = await supabase
          .from('global_stats_cache')
          .select('stats')
          .eq('id', true)
          .single();

        if (error || !data) {
          logger.logWarning('Repository', 'StatsRepository.getGlobalStatsFromCache', 'No data in global_stats_cache', 'system', {
            context: 'Cache table empty or error',
            error: error?.message
          });
          return null;
        }

        return data.stats as GlobalStats;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.logError('Repository', 'StatsRepository.getGlobalStatsFromCache', err, 'system', {
          context: 'Failed to read from global_stats_cache table'
        });
        return null;
      }
    }

    async refreshUserStatsCache(userId: string, has_onboard: boolean): Promise<void> {
      let error;

      if (!has_onboard) {
        ({ error } = await supabase
          .rpc('get_user_complete_stats_from_sources', { 
            p_user_id: userId.toString() 
          })
          .single());

          console.log("WRONG SIDE")
      } else {
        
        ({ error } = await supabase.rpc('refresh_user_stats_cache', {
          p_user_id: userId
        }));
        console.log("UPDATING USER STAT CACHE")
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
}
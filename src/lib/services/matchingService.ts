import { MatchingRepository } from '../repositories/matchingRepository';
import { MatchingResult, MatchingTarget, MatchingStats, MatchedFollower } from '../types/matching';
import { StatsService } from './statsServices';
import { StatsRepository } from '../repositories/statsRepository';
import { redis } from '../redis';

export interface FollowAction {
  userId: string;
  targetId: string;
  platform: 'bluesky' | 'mastodon';
  status: 'success' | 'error';
  error?: string;
  timestamp: Date;
}

export class MatchingService {
  private repository: MatchingRepository;
  private statsRepo : StatsRepository;
  private statsService: StatsService;

  constructor() {
    this.repository = new MatchingRepository();
    this.statsRepo = new StatsRepository();
    this.statsService = new StatsService(this.statsRepo);
  }

  async getFollowableTargets(userId: string): Promise<MatchingResult> {
    const PAGE_SIZE = 1000;
    let allMatches: MatchingTarget[] = [];
    let page = 0;
    let totalCount = 0;

    // Première requête pour obtenir le total et la première page
    const { data: firstPageMatches, error: firstPageError } = 
      await this.repository.getFollowableTargets(userId, PAGE_SIZE, 0);

    // console.log("****************************************",firstPageMatches)

    if (firstPageError) {
      throw new Error(`Failed to fetch first page: ${firstPageError}`);
    }

    if (!firstPageMatches || firstPageMatches.length === 0) {
      return {
        following: [],
        stats: {
          total_following: 0,
          matched_following: 0,
          bluesky_matches: 0,
          mastodon_matches: 0
        }
      };
    }

    // Get total count from first result
    totalCount = firstPageMatches[0]?.total_count || firstPageMatches.length;
    allMatches = [...firstPageMatches];

    // Calculate total pages based on total count
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    
    while (page < totalPages) {
      // console.log("round of page ->", page)
      // console.log("roud of matches ->", matches)
      const { data: matches, error: matchesError } = 
        await this.repository.getFollowableTargets(userId, PAGE_SIZE, page);
      // console.log("roud of matches ->", matches)

      if (matchesError) {
        console.error(`Error fetching page ${page + 1}:`, matchesError);
        break;
      }

      if (!matches || matches.length === 0) {
        console.log(`No more matches found on page ${page + 1}`);
        break;
      }

      if (page === 0) {
        // First page already added above
      } else {
        allMatches = [...allMatches, ...matches];
      }

      page++;
      // console.log(`Total matches so far: ${allMatches.length}`);

      // Safety check to prevent infinite loops
      if (allMatches.length >= totalCount) {
        break;
      }
    }

    const result = {
      following: allMatches,
      stats: {
        total_following: totalCount,
        matched_following: allMatches.length,
        bluesky_matches: allMatches.filter(m => m.bluesky_handle).length,
        mastodon_matches: allMatches.filter(m => m.mastodon_id).length
      }
    };
    
    return result;
  }

  async getSourcesFromFollower(twitterId: string): Promise<MatchingResult> {
    console.log('[MatchingService] getSourcesFromFollower started for twitterId:', twitterId);
    
    // ÉTAPE 1: Récupérer les Twitter IDs depuis le repository
    const { data: basicData, error } = await this.repository.getSourcesFromFollower(twitterId);
    
    if (error) {
      console.error('[MatchingService] Error from repository:', error);
      throw new Error(`Failed to fetch sources: ${error}`);
    }

    if (!basicData || basicData.length === 0) {
      console.log('[MatchingService] No sources found');
      return {
        following: [],
        stats: {
          total_following: 0,
          matched_following: 0,
          bluesky_matches: 0,
          mastodon_matches: 0
        }
      };
    }

    console.log(`[MatchingService] Retrieved ${basicData.length} basic records from repository`);

    // ÉTAPE 2: Enrichir avec Redis pour créer des MatchedFollower
    const enrichedFollowers: MatchedFollower[] = [];
    
    for (const item of basicData) {
      try {
        // Cast vers any pour éviter l'erreur TypeScript - le repository retourne bien source_twitter_id
        const followerData = item as any;
        
        // Récupérer les mappings Redis en parallèle
        const [blueskyMapping, mastodonMapping] = await Promise.all([
          this.getBlueskyMapping(followerData.source_twitter_id),
          this.getMastodonMapping(followerData.source_twitter_id)
        ]);

        // Si on n'a aucun mapping, on ignore l'objet (comme demandé)
        if (!blueskyMapping && !mastodonMapping) {
          console.log(`[MatchingService] No Redis mapping found for Twitter ID: ${followerData.source_twitter_id}, skipping`);
          continue;
        }

        // Créer l'objet MatchedFollower enrichi
        const enrichedFollower: MatchedFollower = {
          source_twitter_id: followerData.source_twitter_id,
          bluesky_handle: blueskyMapping?.username || null,
          mastodon_id: mastodonMapping?.id || null,
          mastodon_username: mastodonMapping?.username || null,
          mastodon_instance: mastodonMapping?.instance || null,
          has_been_followed_on_bluesky: followerData.has_been_followed_on_bluesky,
          has_been_followed_on_mastodon: followerData.has_been_followed_on_mastodon,
        };

        enrichedFollowers.push(enrichedFollower);

      } catch (redisError) {
        console.error(`[MatchingService] Redis error for Twitter ID ${(item as any).source_twitter_id}:`, redisError);
        // En cas d'erreur Redis, on ignore l'objet
        continue;
      }
    }

    console.log(`[MatchingService] Successfully enriched ${enrichedFollowers.length} followers out of ${basicData.length} total`);

    // ÉTAPE 3: Retourner le résultat au format MatchingResult
    const result = {
      following: enrichedFollowers,
      stats: {
        total_following: basicData.length,
        matched_following: enrichedFollowers.length,
        bluesky_matches: enrichedFollowers.filter(f => f.bluesky_handle).length,
        mastodon_matches: enrichedFollowers.filter(f => f.mastodon_id).length
      }
    };
    
    console.log('[MatchingService] Final results:', result.stats);
    return result;
  }

  // Helper pour récupérer le mapping Bluesky depuis Redis
  private async getBlueskyMapping(twitterId: string): Promise<{ username: string; id: string } | null> {
    try {
      const redisKey = `twitter_to_bluesky:${twitterId}`;
      const redisValue = await redis.get(redisKey);
      
      if (!redisValue) {
        return null;
      }

      // Supporter les deux formats Redis:
      // Format nouveau: "username|id" 
      // Format existant: "username.bsky.social" (juste le handle)
      if (redisValue.includes('|')) {
        // Format pipe-delimited: "username|id"
        const [username, id] = redisValue.split('|');
        
        if (!username || !id) {
          console.warn(`[MatchingService] Invalid Bluesky Redis pipe format for ${twitterId}: ${redisValue}`);
          return null;
        }

        return { username, id };
      } else {
        // Format legacy: juste le handle Bluesky
        // Ex: "fondationshoah.bsky.social"
        if (redisValue.includes('.bsky.social')) {
          return { 
            username: redisValue, // Le handle complet
            id: '' // Pas d'ID disponible dans le format legacy
          };
        } else {
          console.warn(`[MatchingService] Unknown Bluesky Redis format for ${twitterId}: ${redisValue}`);
          return null;
        }
      }
    } catch (error) {
      console.error(`[MatchingService] Error getting Bluesky mapping for ${twitterId}:`, error);
      return null;
    }
  }

  // Helper pour récupérer le mapping Mastodon depuis Redis
  private async getMastodonMapping(twitterId: string): Promise<{ id: string; username: string; instance: string } | null> {
    try {
      const redisKey = `twitter_to_mastodon:${twitterId}`;
      const redisValue = await redis.get(redisKey);
      
      if (!redisValue) {
        return null;
      }

      // Supporter les deux formats Redis:
      // Format nouveau: "id|username|instance"
      // Format existant: JSON object
      if (redisValue.includes('|')) {
        // Format pipe-delimited: "id|username|instance"
        const [id, username, instance] = redisValue.split('|');
        
        if (!id || !username || !instance) {
          console.warn(`[MatchingService] Invalid Mastodon Redis pipe format for ${twitterId}: ${redisValue}`);
          return null;
        }

        return { id, username, instance };
      } else {
        // Format legacy: JSON object
        try {
          const parsed = JSON.parse(redisValue);
          if (parsed.id && parsed.username && parsed.instance) {
            return {
              id: parsed.id,
              username: parsed.username,
              instance: parsed.instance
            };
          } else {
            console.warn(`[MatchingService] Missing fields in Mastodon JSON for ${twitterId}: ${redisValue}`);
            return null;
          }
        } catch (parseError) {
          console.warn(`[MatchingService] Invalid Mastodon JSON format for ${twitterId}: ${redisValue}`);
          return null;
        }
      }
    } catch (error) {
      console.error(`[MatchingService] Error getting Mastodon mapping for ${twitterId}:`, error);
      return null;
    }
  }

  async updateFollowStatus(action: FollowAction): Promise<void> {
    try {
      await this.repository.updateFollowStatus(
        action.userId,
        action.targetId,
        action.platform,
        action.status === 'success',
        action.error
      );
    } catch (error) {
      console.error('Failed to update follow status:', error);
      throw new Error('Failed to update follow status');
    }
  }

  async updateFollowStatusBatch(
    userId: string,
    targetIds: number[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    console.log('[MatchingService.updateFollowStatusBatch] Starting batch update:', {
      platform,
      userId,
      numberOfTargets: targetIds.length,
      success,
      error
    });

    try {
      // 1. Mise à jour des relations dans sources_targets
      await this.repository.updateFollowStatusBatch(
        userId,
        targetIds,
        platform,
        success,
        error
      );
      
      // 2. Rafraîchir les stats utilisateur (remplace le trigger PostgreSQL)
      if (success) {
        console.log('[MatchingService.updateFollowStatusBatch] Refreshing user stats after successful follow');
        await this.statsService.refreshUserStats(userId, true);
      }
      
      console.log('[MatchingService.updateFollowStatusBatch] Successfully updated follow status for batch');
    } catch (error) {
      console.error('[MatchingService.updateFollowStatusBatch] Failed to update follow status batch:', error);
      throw new Error('Failed to update follow status batch');
    }
  }

  async getBatchFollowTargets(
    userId: string,
    platform: 'bluesky' | 'mastodon',
    limit: number = 50
  ): Promise<MatchingTarget[]> {
    try {
      return await this.repository.getUnprocessedFollowTargets(userId, platform, limit);
    } catch (error) {
      console.error('Failed to get batch follow targets:', error);
      throw new Error('Failed to get batch follow targets');
    }
  }

  async updateSourcesFollowersStatusBatch(
    followerTwitterId: string,
    sourceIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await this.repository.updateSourcesFollowersStatusBatch(
        followerTwitterId,
        sourceIds,
        platform,
        success,
        error
      );
    } catch (error) {
      console.error('Failed to update sources followers status:', error);
      throw new Error('Failed to update sources followers status');
    }
  }

  async updateSourcesFollowersStatus(
    followerTwitterId: string,
    sourceId: string,
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await this.repository.updateSourcesFollowersStatus(
        followerTwitterId,
        sourceId,
        platform,
        success,
        error
      );
    } catch (error) {
      console.error('Failed to update sources followers status:', error);
      throw new Error('Failed to update sources followers status');
    }
  }

  async ignoreTarget(userId: string, targetTwitterId: string, action: string): Promise<void> {
    if (action === 'ignore') {
      return this.repository.ignoreTarget(userId, targetTwitterId);
    } else {
      return this.repository.unignoreTarget(userId, targetTwitterId);
    }
  }

  /**
   * Récupère uniquement les listes des twitter_id du réseau utilisateur
   * @param userId UUID de l'utilisateur
   * @returns Objet avec following et followers (sans stats)
   */
  async getUserNetworkIds(userId: string): Promise<{
    following: string[];
    followers: string[];
  }> {
    const userNetwork = await this.repository.getUserNetwork(userId);
    
    return {
      following: userNetwork.following,
      followers: userNetwork.followers
    };
  }
}
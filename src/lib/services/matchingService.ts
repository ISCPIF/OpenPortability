import { MatchingRepository } from '../repositories/matchingRepository';
import { MatchingResult, MatchingTarget, MatchingStats } from '../types/matching';

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

  constructor() {
    this.repository = new MatchingRepository();
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

    allMatches = [...firstPageMatches];
    totalCount = firstPageMatches[0].total_count;
    page = 1;

    // Récupérer les pages suivantes si nécessaire
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    
    while (page < totalPages) {
      const { data: matches, error: matchesError } = 
        await this.repository.getFollowableTargets(userId, PAGE_SIZE, page);

      if (matchesError) {
        console.error(`Error fetching page ${page + 1}:`, matchesError);
        break;
      }

      if (matches && matches.length > 0) {
        allMatches = [...allMatches, ...matches];
      }

      page++;
    }

    const stats: MatchingStats = {
      total_following: totalCount,
      matched_following: allMatches.length,
      bluesky_matches: allMatches.filter(m => m.bluesky_handle).length,
      mastodon_matches: allMatches.filter(m => m.mastodon_handle).length
    };

    // console.log("ALL MATCHSSSSSSSS", allMatches)
    return {
      following: allMatches,
      stats
    };
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
    targetIds: string[],
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
      await this.repository.updateFollowStatusBatch(
        userId,
        targetIds,
        platform,
        success,
        error
      );
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


  async getSourcesFromFollower(twitterId: string): Promise<MatchingResult> {
    console.log('[MatchingService] getSourcesFromFollower started for twitterId:', twitterId);
    const PAGE_SIZE = 1000;
    let allMatches: MatchingTarget[] = [];
    let page = 0;
    let totalCount = 0;
  
    const { data: firstPageMatches, error: firstPageError } = 
      await this.repository.getSourcesFromFollower(twitterId, PAGE_SIZE, 0);
    
    console.log('[MatchingService] First page results:', {
      matchesFound: firstPageMatches?.length || 0,
      error: firstPageError
    });
  
    if (firstPageError) {
      console.error('[MatchingService] Error fetching first page:', firstPageError);
      throw new Error(`Failed to fetch first page: ${firstPageError}`);
    }
  
    if (!firstPageMatches || firstPageMatches.length === 0) {
      console.log('[MatchingService] No matches found');
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
  
    allMatches = [...firstPageMatches];
    totalCount = firstPageMatches[0].total_count;
    console.log('[MatchingService] Total count from first page:', totalCount);
  
    // Fetch remaining pages if necessary
    while (allMatches.length < totalCount) {
      console.log('[MatchingService] Fetching page', page + 1);
      const { data: nextPageMatches, error: nextPageError } = 
        await this.repository.getSourcesFromFollower(twitterId, PAGE_SIZE, page + 1);
      
      if (nextPageError) {
        console.error('[MatchingService] Error fetching page', page + 1, ':', nextPageError);
        throw new Error(`Failed to fetch page ${page + 1}: ${nextPageError}`);
      }
  
      if (!nextPageMatches || nextPageMatches.length === 0) {
        console.log('[MatchingService] No more matches found on page', page + 1);
        break;
      }
      
      allMatches = [...allMatches, ...nextPageMatches];
      page++;
      console.log('[MatchingService] Total matches so far:', allMatches.length);
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
    
    console.log('[MatchingService] Final results:', result.stats);
    return result;
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
}
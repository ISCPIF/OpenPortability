import { MatchingTarget } from '../types/matching';
import { supabase, authClient } from '../supabase';

export class MatchingRepository {
  private supabase;
  private authClient;

  constructor() {
    this.supabase = supabase;
    this.authClient = authClient;
  }
  // }

  async getFollowableTargets(
    userId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    return await this.supabase.rpc('get_followable_targets', {
      user_id: userId,
      page_size: pageSize,
      page_number: pageNumber
    });
  }

  async updateFollowStatus(
    userId: string,
    targetId: string,
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const updates = platform === 'bluesky' 
      ? {
          has_follow_bluesky: success,
          followed_at_bluesky: success ? now : null,
          follow_error_bluesky: error
        }
      : {
          has_follow_mastodon: success,
          followed_at_mastodon: success ? now : null,
          follow_error_mastodon: error
        };

    const { error: updateError } = await this.supabase
      .from('sources_targets')
      .update(updates)
      .eq('source_id', userId)
      .eq('target_twitter_id', targetId);

    if (updateError) {
      console.error('Failed to update follow status:', updateError);
      throw updateError;
    }
  }

  async updateFollowStatusBatch(
    userId: string,
    targetIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    console.log('[MatchingRepository.updateFollowStatusBatch] Starting database update:', {
      platform,
      userId,
      targetIds,
      success,
      error
    });

    const now = new Date().toISOString();
    const updates = platform === 'bluesky' 
      ? {
          has_follow_bluesky: success,
          followed_at_bluesky: success ? now : null,
          // follow_error_bluesky: error
        }
      : {
          has_follow_mastodon: success,
          followed_at_mastodon: success ? now : null,
          // follow_error_mastodon: error
        };

    console.log('[MatchingRepository.updateFollowStatusBatch] Applying updates:', updates);

    const { error: updateError } = await this.supabase
      .from('sources_targets')
      .update(updates)
      .eq('source_id', userId)
      .in('target_twitter_id', targetIds);

    if (updateError) {
      console.error('[MatchingRepository.updateFollowStatusBatch] Failed to update follow status batch:', updateError);
      throw updateError;
    }

    console.log('[MatchingRepository.updateFollowStatusBatch] Successfully updated follow status for batch');
  }

  async updateSourcesFollowersStatusBatch(
    followerTwitterId: string,
    sourceTwitterIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    console.log('[MatchingRepository.updateSourcesFollowersStatusBatch] Starting database update:', {
      platform,
      followerTwitterId,
      sourceTwitterIds,
      success,
      error
    });

    // Get the UUIDs for the source Twitter IDs
    const { data: sourceUsers, error: sourceError } = await this.authClient
      .from('users')
      .select('id, twitter_id')
      .in('twitter_id', sourceTwitterIds);

    if (sourceError) {
      console.error('[MatchingRepository.updateSourcesFollowersStatusBatch] Error getting source UUIDs:', sourceError);
      throw new Error(`Failed to get source UUIDs: ${sourceError.message}`);
    }

    if (!sourceUsers || sourceUsers.length === 0) {
      console.error('[MatchingRepository.updateSourcesFollowersStatusBatch] No users found for Twitter IDs:', sourceTwitterIds);
      throw new Error('No users found for the given Twitter IDs');
    }

    // Get the UUIDs
    const sourceUUIDs = sourceUsers.map(user => user.id);

    const now = new Date().toISOString();
    const updates = platform === 'bluesky' 
      ? {
          has_been_followed_on_bluesky: success,
          followed_at_bluesky: success ? now : null,
          follow_error_bluesky: error
        }
      : {
          has_been_followed_on_mastodon: success,
          followed_at_mastodon: success ? now : null,
          follow_error_mastodon: error
        };

    const { error: updateError } = await this.supabase
      .from('sources_followers')
      .update(updates)
      .eq('follower_id', followerTwitterId)
      .in('source_id', sourceUUIDs);

    if (updateError) {
      console.error('[MatchingRepository.updateSourcesFollowersStatusBatch] Error updating follow status:', updateError);
      throw new Error(`Failed to update follow status: ${updateError.message}`);
    }

    console.log('[MatchingRepository.updateSourcesFollowersStatusBatch] Successfully updated follow status');
  }

  async updateSourcesFollowersStatus(
    followerTwitterId: string,
    sourceId: string,
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    return this.updateSourcesFollowersStatusBatch(followerTwitterId, [sourceId], platform, success, error);
  }

  async getSourcesFromFollower(
    twitterId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    console.log('[MatchingRepository] getSourcesFromFollower called with:', { twitterId, pageSize, pageNumber });
    const result = await this.supabase.rpc('get_sources_from_follower', {
      follower_twitter_id_param: twitterId,
      page_size: pageSize,
      page_number: pageNumber
    });
    console.log('[MatchingRepository] getSourcesFromFollower result:', { 
      dataLength: result.data?.length || 0,
      error: result.error
    });
    return result;
  }
}
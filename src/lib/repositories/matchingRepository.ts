import { MatchingTarget } from '../types/matching';
import { supabase } from '../supabase';

export class MatchingRepository {
  private supabase;

  constructor() {
    this.supabase = supabase;
  }

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

  // async getUnprocessedFollowTargets(
  //   userId: string,
  //   platform: 'bluesky' | 'mastodon',
  //   limit: number
  // ): Promise<MatchingTarget[]> {
  //   const query = this.supabase
  //     .from('sources_targets')
  //     .select(`
  //       target_twitter_id,
  //       ${platform === 'bluesky' ? 'bluesky_handle' : 'mastodon_username,mastodon_instance'}
  //     `)
  //     .eq('source_id', userId);

  //   if (platform === 'bluesky') {
  //     query
  //       .is('has_follow_bluesky', false)
  //       .not('bluesky_handle', 'is', null);
  //   } else {
  //     query
  //       .is('has_follow_mastodon', false)
  //       .not('mastodon_username', 'is', null)
  //       .not('mastodon_instance', 'is', null);
  //   }

  //   const { data, error } = await query.limit(limit);

  //   if (error) {
  //     console.error('Failed to get unprocessed follow targets:', error);
  //     throw error;
  //   }

  //   return data?.map(row => ({
  //     targetId: row.target_twitter_id,
  //     ...(platform === 'bluesky' 
  //       ? { blueskyHandle: row.bluesky_handle }
  //       : { 
  //           mastodonUsername: row.mastodon_username,
  //           mastodonInstance: row.mastodon_instance
  //         }
  //     )
  //   })) || [];
  // }
}
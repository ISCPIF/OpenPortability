import { MatchingTarget, StoredProcedureTarget } from '../types/matching';
import { supabase, authClient } from '../supabase';
import { redis } from '../redis';
import logger, { logError, logWarning, logInfo, logDebug } from '../log_utils';

// Types pour la fonction get_social_graph_data
interface SocialGraphTarget {
  twitter_id: string;
  bluesky_handle?: string;
  mastodon_id?: string;
  mastodon_username?: string;
  mastodon_instance?: string;
  has_follow: boolean;
  followed_at?: string;
}

interface SocialGraphFollower {
  twitter_id: string;
  bluesky_handle?: string;
  has_follow?: boolean;
  followed_at?: string;
  has_been_followed: boolean;
}

interface SocialGraphSource {
  source_twitter_id: string;
  source_bluesky_username?: string;
  source_bluesky_id?: string;
  source_mastodon_username?: string;
  source_mastodon_id?: string;
  source_mastodon_instance?: string;
  relationship: 'is_followed_by';
}

interface SocialGraphDataWithArchive {
  strategy: 'user_with_archive';
  source_id: string;
  targets: {
    bluesky: SocialGraphTarget[];
    mastodon: SocialGraphTarget[];
  };
  followers: {
    bluesky: SocialGraphFollower[];
    mastodon: SocialGraphFollower[];
  };
}

interface SocialGraphDataWithoutArchive {
  strategy: 'user_without_archive';
  twitter_id: string;
  found_in_sources: {
    bluesky: SocialGraphSource[];
    mastodon: SocialGraphSource[];
  };
}

export type SocialGraphData = SocialGraphDataWithArchive | SocialGraphDataWithoutArchive;

export class MatchingRepository {
  private supabase;
  private authClient;

  constructor() {
    this.supabase = supabase;
    this.authClient = authClient;
  }

  async getFollowableTargets(
    userId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    console.log('📦 [MatchingRepository.getFollowableTargets] Début - userId:', userId, 'pageSize:', pageSize, 'pageNumber:', pageNumber);
    

    // 2. Fallback vers la fonction SQL existante
    console.log('🟦 [MatchingRepository.getFollowableTargets] Appel SQL get_followable_targets...');
    const result = await this.supabase.rpc('get_followable_targets', {
      user_id: userId,
      page_size: pageSize,
      page_number: pageNumber
    });
    
    console.log('🟦 [MatchingRepository.getFollowableTargets] Résultat SQL - éléments:', result.data?.length || 0, 'erreur:', result.error);
    console.log('🟦 [MatchingRepository.getFollowableTargets] Détail SQL result:', result.data);
    
    return result;
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
          // follow_error_bluesky: error
        }
      : {
          has_follow_mastodon: success,
          followed_at_mastodon: success ? now : null,
          // follow_error_mastodon: error
        };

    const { error: updateError } = await this.supabase
      .from('sources_targets')
      .update(updates)
      .eq('source_id', userId)
      .eq('node_id', targetId);  // CORRIGÉ: target_twitter_id → node_id et conversion en BIGINT

    if (updateError) {
      logError('Repository', 'MatchingRepository.updateFollowStatus', updateError, userId, {
        targetId,
        platform,
        success
      });
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
    const { error: updateError } = await this.supabase
      .from('sources_targets')
      .update(updates)
      .eq('source_id', userId)
      .in('node_id', targetIds);

    if (updateError) {
      logError('Repository', 'MatchingRepository.updateFollowStatusBatch', updateError, userId, {
        targetCount: targetIds.length,
        platform,
        success
      });
      throw updateError;
    }
  }

  async updateSourcesFollowersStatusBatch(
    followerTwitterId: string,
    sourceTwitterIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {

    // Get the UUIDs for the source Twitter IDs
    const { data: sourceUsers, error: sourceError } = await this.authClient
      .from('users')
      .select('id, twitter_id')
      .in('twitter_id', sourceTwitterIds);

    if (sourceError) {
      logError('Repository', 'MatchingRepository.updateSourcesFollowersStatusBatch', sourceError, 'unknown', {
        followerTwitterId,
        sourceTwitterIds,
        context: 'Error getting source UUIDs'
      });
      throw new Error(`Failed to get source UUIDs: ${sourceError.message}`);
    }

    if (!sourceUsers || sourceUsers.length === 0) {
      logWarning('Repository', 'MatchingRepository.updateSourcesFollowersStatusBatch', 'No users found for Twitter IDs', 'unknown', {
        followerTwitterId,
        sourceTwitterIds
      });
      throw new Error('No users found for the given Twitter IDs');
    }

    // Get the UUIDs
    const sourceUUIDs = sourceUsers.map(user => user.id);

    const now = new Date().toISOString();
    const updates = platform === 'bluesky' 
      ? {
          has_been_followed_on_bluesky: success,
          followed_at_bluesky: success ? now : null,
          // follow_error_bluesky: error
        }
      : {
          has_been_followed_on_mastodon: success,
          followed_at_mastodon: success ? now : null,
          // follow_error_mastodon: error
        };

    const { error: updateError } = await this.supabase
      .from('sources_followers')
      .update(updates)
      .eq('node_id', followerTwitterId)
      .in('source_id', sourceUUIDs);

    if (updateError) {
      logError('Repository', 'MatchingRepository.updateSourcesFollowersStatusBatch', updateError, 'unknown', {
        followerTwitterId,
        sourceUUIDs,
        platform,
        context: 'Error updating follow status'
      });
      throw new Error(`Failed to update follow status: ${updateError.message}`);
    }
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
    
    // DEBUG: Vérifier la conversion parseInt
    const parsedTwitterId = twitterId;
    
    // ÉTAPE 1: Récupérer les UUIDs depuis sources_followers (ULTRA RAPIDE)
    const step1Start = Date.now();    
    const uuidResult = await this.supabase.rpc('get_sources_from_follower', {
      follower_twitter_id_param: parsedTwitterId, // CORRIGÉ: Convertir BigInt en string
      page_size: pageSize,
      page_number: pageNumber
    });
    
    const step1Duration = Date.now() - step1Start;
    
    // DEBUG: Afficher la réponse brute de Supabase
    
    if (uuidResult.error) {
      const errorString = uuidResult.error instanceof Error ? uuidResult.error.message : String(uuidResult.error);
      logger.logError("MatchingRepo", "getSourcesFromFollower", `❌ [STEP 1] Error getting source UUIDs:`, errorString);
      return { data: null, error: uuidResult.error };
    }

    // Si pas de résultats, retourner vide
    if (!uuidResult.data || uuidResult.data.length === 0) {
      logger.logError("MatchingRepo", "getSourcesFromFollower", `🚫 [STEP 1] No sources found for follower ${twitterId} - returning empty array`);
      return { data: [], error: null };
    }

    // NOUVELLE LOGIQUE: utiliser directement les résultats de l'étape 1
    const finalData = (uuidResult.data || []).map((item: any) => ({
      source_twitter_id: item.source_twitter_id?.toString?.() ?? String(item.source_twitter_id),
      bluesky_handle: item.bluesky_handle ?? null,
      mastodon_id: item.mastodon_id ?? null,
      mastodon_username: item.mastodon_username ?? null,
      mastodon_instance: item.mastodon_instance ?? null,
      has_been_followed_on_bluesky: item.has_been_followed_on_bluesky ?? false,
      has_been_followed_on_mastodon: item.has_been_followed_on_mastodon ?? false,
      total_count: item.total_count ?? 0,
    }));

    return { data: finalData as any, error: null };
  }

  async ignoreTarget(userId: string, targetTwitterId: string): Promise<void> {
    try {
      await this.supabase
        .from("sources_targets")
        .update({ dismissed: true })
        .eq("source_id", userId)
        .eq("node_id", targetTwitterId);  // CORRIGÉ: ÉVITER parseInt()
        
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError("MatchingRepo", "ignoreTarget", "Failed to mark target as dismissed", errorString);
      throw error;
    }
  }

  async unignoreTarget(userId: string, targetTwitterId: string): Promise<void> {
    try {
      await this.supabase
        .from("sources_targets")
        .update({ dismissed: false })
        .eq("source_id", userId)
        .eq("node_id", targetTwitterId);  // CORRIGÉ: ÉVITER parseInt()
        
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError("MatchingRepo", "unignoreTarget", "Failed to mark target as not dismissed", errorString);
      throw error;
    }
  }

  async markNodesAsUnavailableBatch(
    nodeIds: string[], 
    platform: 'bluesky' | 'mastodon', 
    reason: string
  ): Promise<void> {
    console.log('Repository', `markNodesAsUnavailableBatch called with nodeIds: ${JSON.stringify(nodeIds)}, platform: ${platform}, reason: ${reason}`, "system");
    
    const updates = platform === 'bluesky' 
      ? { 
          bluesky_unavailable: true, 
          failure_reason_bluesky: reason 
        }
      : { 
          mastodon_unavailable: true, 
          failure_reason_mastodon: reason 
        };
  
    console.log('Repository', `Updates object: ${JSON.stringify(updates)}`, "system");
  
    // Convertir les nodeIds en bigint pour la requête PostgreSQL
    const bigintNodeIds = nodeIds.map(id => BigInt(id));
    
    const { data, error, count } = await this.supabase
      .from('nodes')
      .update(updates)
      .in('twitter_id', bigintNodeIds)
      .select('twitter_id, bluesky_unavailable, mastodon_unavailable, failure_reason_bluesky, failure_reason_mastodon');
  
    console.log('Repository', `Update result - count: ${count}, data: ${JSON.stringify(data)}, error: ${error}`, "system");
  
    if (error) {
      throw new Error(`Failed to mark nodes as unavailable: ${error.message}`);
    }
  }
}
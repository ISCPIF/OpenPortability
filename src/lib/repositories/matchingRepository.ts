import { MatchingTarget, StoredProcedureTarget } from '../types/matching';
import { supabase, authClient } from '../supabase';
import { redis } from '../redis';
import { logError, logWarning, logInfo, logDebug } from '../log_utils';

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
  private FOLLOWABLE_CACHE_TTL_SECONDS = 900; // 15 minutes

  constructor() {
    this.supabase = supabase;
    this.authClient = authClient;
  }

  async getFollowableTargets(
    userId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    // console.log("getFollowableTargets", userId, pageSize, pageNumber);
    
    try {
      // 1. Essayer Redis-first approach
      const redisResult = await this.getFollowableTargetsFromRedis(userId, pageSize, pageNumber);
      if (redisResult.data !== null) {
        // console.log("getFollowableTargets Redis success:", {
        //   dataLength: redisResult.data.length,
        //   firstItem: redisResult.data.length > 0 ? redisResult.data[0] : null
        // });
        return redisResult;
      }
    } catch (redisError) {
      logWarning('Repository', 'MatchingRepository.getFollowableTargets', 'Redis unavailable, falling back to SQL', userId, {
        error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
      });
    }

    // 2. Fallback vers la fonction SQL existante
    // console.log("getFollowableTargets falling back to SQL function");
    const result = await this.supabase.rpc('get_followable_targets', {
      user_id: userId,
      page_size: pageSize,
      page_number: pageNumber
    });
    
    // console.log("getFollowableTargets SQL result:", {
    //   error: result.error,
    //   dataLength: result.data?.length || 0,
    //   firstItem: result.data && result.data.length > 0 ? result.data[0] : null
    // });
    
    return result;
  }

  /**
   * Nouvelle implémentation Redis-first pour getFollowableTargets
   */
  private async getFollowableTargetsFromRedis(
    userId: string,
    pageSize: number,
    pageNumber: number
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    try {
      // 0. Try per-user SET-based cache first
      const keys = this.getUserTargetsSetKeys(userId);

      // 1. D'abord récupérer les plateformes connectées de l'utilisateur (comme PostgreSQL)
      const { data: userPlatforms, error: userError } = await authClient
        .from('users')
        .select('bluesky_username, mastodon_username')
        .eq('id', userId)
        .single();

      if (userError) {
        throw new Error(`User platforms error: ${userError.message}`);
      }

      const hasBluesky = !!userPlatforms?.bluesky_username;
      const hasMastodon = !!userPlatforms?.mastodon_username;

      // 2. Vérifier présence des sets, sinon les initialiser depuis la DB (warm-up)
      const [hasBlueskySet, hasMastodonSet, hasDismissedSet] = await Promise.all([
        redis.exists(keys.pendingBluesky),
        redis.exists(keys.pendingMastodon),
        redis.exists(keys.dismissed),
      ]);

      if (!hasBlueskySet && !hasMastodonSet && !hasDismissedSet) {
        await this.warmUserTargetsSets(userId, keys);
      }

      // 3. Lire les candidats depuis les sets en fonction des plateformes connectées
      const unionKeys: string[] = [];
      if (hasBluesky) unionKeys.push(keys.pendingBluesky);
      if (hasMastodon) unionKeys.push(keys.pendingMastodon);
      let candidateIds: string[] = [];
      if (unionKeys.length > 0) {
        candidateIds = await redis.sunion(unionKeys);
      }

      // Exclure les ignorés
      const dismissedIds = new Set(await redis.smembers(keys.dismissed));
      candidateIds = candidateIds.filter(id => !dismissedIds.has(id));

      if (candidateIds.length === 0) {
        return { data: [], error: null };
      }

      // 4. Récupérer les correspondances depuis Redis en batch
      const mappings = await redis.batchGetSocialMappings(candidateIds);

      // 4. Construire les résultats avec les correspondances trouvées ET filtrage par plateformes utilisateur
      const results: StoredProcedureTarget[] = [];
      let totalCount = 0;

      // Pour dériver les flags has_follow_* à partir des sets pending
      const [blueskyPending, mastodonPending] = await Promise.all([
        hasBluesky ? redis.smembers(keys.pendingBluesky) : Promise.resolve([] as string[]),
        hasMastodon ? redis.smembers(keys.pendingMastodon) : Promise.resolve([] as string[]),
      ]);
      const blueskyPendingSet = new Set(blueskyPending);
      const mastodonPendingSet = new Set(mastodonPending);

      for (const twitterId of candidateIds) {
        const mapping = mappings.get(twitterId);

        // NOUVELLE LOGIQUE: Filtrer selon les plateformes connectées de l'utilisateur (comme PostgreSQL)
        const hasBlueskyMapping = !!(mapping?.bluesky);
        const hasMastodonMapping = !!(mapping?.mastodon);
        
        // Condition identique à PostgreSQL: (has_bluesky AND bluesky_mapping) OR (has_mastodon AND mastodon_mapping)
        const shouldInclude = (hasBluesky && hasBlueskyMapping) || (hasMastodon && hasMastodonMapping);

        if (shouldInclude) {
          const result: StoredProcedureTarget = {
            // Type in StoredProcedureTarget expects number; Twitter IDs exceed JS safe int
            // but we keep type compatibility here and rely on string IDs downstream where needed.
            node_id: (twitterId as unknown as number),
            // Retourner les données seulement pour les plateformes connectées (comme PostgreSQL)
            bluesky_handle: (hasBluesky && mapping?.bluesky) || null,
            mastodon_handle: (hasMastodon && mapping?.mastodon?.username) || null,
            mastodon_id: (hasMastodon && mapping?.mastodon?.id) || null,
            mastodon_username: (hasMastodon && mapping?.mastodon?.username) || null,
            mastodon_instance: (hasMastodon && mapping?.mastodon?.instance) || null,
            has_follow_bluesky: hasBluesky ? !blueskyPendingSet.has(twitterId) : false,
            has_follow_mastodon: hasMastodon ? !mastodonPendingSet.has(twitterId) : false,
            followed_at_bluesky: null,
            followed_at_mastodon: null,
            dismissed: false,
            total_count: 0 // Sera mis à jour après
          };

          results.push(result);
          totalCount++;
        }
      }

      // 5. Appliquer la pagination
      const startIndex = pageNumber * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = results.slice(startIndex, endIndex);

      // 6. Ajouter le total_count à chaque résultat
      paginatedResults.forEach(result => {
        result.total_count = totalCount;
      });

      return { data: paginatedResults, error: null };

    } catch (error) {
      logError('Repository', 'MatchingRepository.getFollowableTargetsFromRedis', error as any, userId);
      return { data: null, error: error };
    }
  }

  /**
   * Construit la clé Redis pour le cache des followable targets par utilisateur
   */
  private getFollowableTargetsCacheKey(userId: string): string {
    return `user:${userId}:followable_targets:v1`;
  }

  /**
   * Construit les clés Redis des sets de cibles par utilisateur
   */
  private getUserTargetsSetKeys(userId: string): { pendingBluesky: string; pendingMastodon: string; dismissed: string } {
    return {
      pendingBluesky: `user:${userId}:targets:pending:bluesky`,
      pendingMastodon: `user:${userId}:targets:pending:mastodon`,
      dismissed: `user:${userId}:targets:dismissed`,
    };
  }

  /**
   * Warm-up des sets Redis à partir de la table sources_targets
   */
  private async warmUserTargetsSets(userId: string, keys?: { pendingBluesky: string; pendingMastodon: string; dismissed: string }): Promise<void> {
    const k = keys || this.getUserTargetsSetKeys(userId);
    const { data, error } = await this.supabase
      .from('sources_targets')
      .select('node_id::text, has_follow_bluesky, has_follow_mastodon, dismissed')
      .eq('source_id', userId);

    if (error) {
      throw new Error(`Failed to warm user target sets: ${error.message}`);
    }

    const blueskyPending: string[] = [];
    const mastodonPending: string[] = [];
    const dismissed: string[] = [];

    for (const row of data || []) {
      if (row.dismissed) dismissed.push(row.node_id);
      if (row.has_follow_bluesky === false) blueskyPending.push(row.node_id);
      if (row.has_follow_mastodon === false) mastodonPending.push(row.node_id);
    }

    // Écrire en Redis (sets) + TTL
    if (blueskyPending.length > 0) await redis.sadd(k.pendingBluesky, blueskyPending);
    if (mastodonPending.length > 0) await redis.sadd(k.pendingMastodon, mastodonPending);
    if (dismissed.length > 0) await redis.sadd(k.dismissed, dismissed);

    // Toujours poser un TTL pour auto-expiration (même si vide, on pose TTL après première écriture)
    await Promise.all([
      redis.expire(k.pendingBluesky, this.FOLLOWABLE_CACHE_TTL_SECONDS),
      redis.expire(k.pendingMastodon, this.FOLLOWABLE_CACHE_TTL_SECONDS),
      redis.expire(k.dismissed, this.FOLLOWABLE_CACHE_TTL_SECONDS),
    ]);
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

    // Invalidate per-user cache so next read is fresh
    try {
      await redis.del(this.getFollowableTargetsCacheKey(userId));
    } catch (e) {
      logWarning('Repository', 'MatchingRepository.updateFollowStatus', 'Failed to invalidate cache', userId, {
        error: e instanceof Error ? e.message : 'Unknown cache del error',
      });
    }

    // Write-through: retirer la cible du set pending correspondant si succès
    try {
      if (success) {
        const keys = this.getUserTargetsSetKeys(userId);
        if (platform === 'bluesky') {
          await redis.srem(keys.pendingBluesky, String(targetId));
        } else {
          await redis.srem(keys.pendingMastodon, String(targetId));
        }
      }
    } catch (e) {
      logWarning('Repository', 'MatchingRepository.updateFollowStatus', 'Failed to update pending set', userId, {
        error: e instanceof Error ? e.message : 'Unknown srem error',
      });
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

    // Invalidate per-user cache so next read is fresh
    try {
      await redis.del(this.getFollowableTargetsCacheKey(userId));
    } catch (e) {
      logWarning('Repository', 'MatchingRepository.updateFollowStatusBatch', 'Failed to invalidate cache', userId, {
        error: e instanceof Error ? e.message : 'Unknown cache del error',
      });
    }

    // Write-through: retirer les cibles du set pending correspondant si succès
    try {
      if (success && targetIds.length > 0) {
        const keys = this.getUserTargetsSetKeys(userId);
        const idsAsString = targetIds.map(id => String(id));
        if (platform === 'bluesky') {
          await redis.srem(keys.pendingBluesky, idsAsString);
        } else {
          await redis.srem(keys.pendingMastodon, idsAsString);
        }
      }
    } catch (e) {
      logWarning('Repository', 'MatchingRepository.updateFollowStatusBatch', 'Failed to update pending set', userId, {
        error: e instanceof Error ? e.message : 'Unknown srem error',
      });
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
    console.log(`🔍 [STEP 1] Starting getSourcesFromFollower for twitterId: ${twitterId}, pageSize: ${pageSize}, pageNumber: ${pageNumber}`);
    
    // DEBUG: Vérifier la conversion parseInt
    const parsedTwitterId = twitterId;
    console.log(`🔢 [DEBUG] Original twitterId: "${twitterId}" (type: ${typeof twitterId})`);
    console.log(`🔢 [DEBUG] Parsed twitterId: ${parsedTwitterId} (type: ${typeof parsedTwitterId})`);
    console.log(`🔢 [DEBUG] Expected: 1309241221039165446`);
    console.log(`🔢 [DEBUG] Match expected: ${parsedTwitterId === "1309241221039165446"}`);
    
    // ÉTAPE 1: Récupérer les UUIDs depuis sources_followers (ULTRA RAPIDE)
    const step1Start = Date.now();
    console.log(`⚡ [STEP 1] Calling get_sources_from_follower RPC...`);
    
    const uuidResult = await this.supabase.rpc('get_sources_from_follower', {
      follower_twitter_id_param: parsedTwitterId, // CORRIGÉ: Convertir BigInt en string
      page_size: pageSize,
      page_number: pageNumber
    });
    
    const step1Duration = Date.now() - step1Start;
    console.log(`✅ [STEP 1] get_sources_from_follower completed in ${step1Duration}ms`);
    
    // DEBUG: Afficher la réponse brute de Supabase
    console.log(`🔍 [DEBUG] Raw Supabase response:`, JSON.stringify(uuidResult, null, 2));
    
    if (uuidResult.error) {
      console.error(`❌ [STEP 1] Error getting source UUIDs:`, uuidResult.error);
      return { data: null, error: uuidResult.error };
    }

    console.log(`📊 [STEP 1] Retrieved ${uuidResult.data?.length || 0} UUID records`);
    console.log(`📊 [DEBUG] First 3 records:`, uuidResult.data?.slice(0, 3));

    // Si pas de résultats, retourner vide
    if (!uuidResult.data || uuidResult.data.length === 0) {
      console.log(`🚫 [STEP 1] No sources found for follower ${twitterId} - returning empty array`);
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

    const step3Duration = Date.now() - step1Start;
    const totalDuration = Date.now() - step1Start;
    
    console.log(`✅ [STEP 3] Data merging completed in ${step3Duration}ms`);
    console.log(`🎉 [FINAL] getSourcesFromFollower completed successfully!`);
    console.log(`📊 [FINAL] Final results: ${finalData.length}`);
    console.log(`⏱️ [FINAL] Total duration: ${totalDuration}ms (Step1: ${step1Duration}ms)`);
    
    return { data: finalData as any, error: null };
  }

  async ignoreTarget(userId: string, targetTwitterId: string): Promise<void> {
    try {
      await this.supabase
        .from("sources_targets")
        .update({ dismissed: true })
        .eq("source_id", userId)
        .eq("node_id", targetTwitterId);  // CORRIGÉ: ÉVITER parseInt()
        
      console.log("Target marked as dismissed", {
        userId,
        targetTwitterId,
        context: "MatchingRepository.ignoreTarget",
      });

      // Invalidate per-user cache so next read is fresh
      try {
        await redis.del(this.getFollowableTargetsCacheKey(userId));
      } catch (e) {
        logWarning('Repository', 'MatchingRepository.ignoreTarget', 'Failed to invalidate cache', userId, {
          error: e instanceof Error ? e.message : 'Unknown cache del error',
        });
      }

      // Write-through: ajouter la cible au set dismissed
      try {
        const keys = this.getUserTargetsSetKeys(userId);
        await redis.sadd(keys.dismissed, String(targetTwitterId));
      } catch (e) {
        logWarning('Repository', 'MatchingRepository.ignoreTarget', 'Failed to update dismissed set', userId, {
          error: e instanceof Error ? e.message : 'Unknown sadd error',
        });
      }
    } catch (error) {
      console.log("Failed to mark target as dismissed", {
        error: error instanceof Error ? error.message : String(error),
        context: "MatchingRepository.ignoreTarget",
      });
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
        
      console.log("Target marked as not dismissed", {
        userId,
        targetTwitterId,
        context: "MatchingRepository.unignoreTarget",
      });

      // Invalidate per-user cache so next read is fresh
      try {
        await redis.del(this.getFollowableTargetsCacheKey(userId));
      } catch (e) {
        logWarning('Repository', 'MatchingRepository.unignoreTarget', 'Failed to invalidate cache', userId, {
          error: e instanceof Error ? e.message : 'Unknown cache del error',
        });
      }

      // Write-through: retirer du set dismissed
      try {
        const keys = this.getUserTargetsSetKeys(userId);
        await redis.srem(keys.dismissed, String(targetTwitterId));
      } catch (e) {
        logWarning('Repository', 'MatchingRepository.unignoreTarget', 'Failed to update dismissed set', userId, {
          error: e instanceof Error ? e.message : 'Unknown srem error',
        });
      }
    } catch (error) {
      console.log("Failed to mark target as not dismissed", {
        error: error instanceof Error ? error.message : String(error),
        context: "MatchingRepository.unignoreTarget",
      });
      throw error;
    }
  }

  /**
   * Récupère les personnes que l'utilisateur suit (following)
   * @param userId UUID de l'utilisateur
   * @param limit Nombre maximum de résultats (0 = pas de limite, récupère tout)
   * @returns Liste des twitter_ids des personnes suivies
   */
  async getUserFollowing(userId: string, limit: number = 0): Promise<string[]> {
    const BATCH_SIZE = 1000;
    const allFollowing: string[] = [];
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await this.supabase
          .from('sources_targets')
          .select('node_id::text') // FORCER node_id en TEXT
          .eq('source_id', userId)
          .eq('dismissed', false)
          .range(offset, offset + BATCH_SIZE - 1)
          .order('node_id::text'); // Ordre consistant pour la pagination

        if (error) {
          logError('Repository', 'MatchingRepository.getUserFollowing', error, userId, { 
            limit, 
            offset, 
            batchSize: BATCH_SIZE 
          });
          throw error;
        }

        const batch = data?.map(item => item.node_id) || [];
        allFollowing.push(...batch);

        // Vérifier si on a atteint la limite demandée
        if (limit > 0 && allFollowing.length >= limit) {
          return allFollowing.slice(0, limit);
        }

        // Vérifier s'il y a encore des données
        hasMore = batch.length === BATCH_SIZE;
        offset += BATCH_SIZE;

        // Log de progression pour les gros datasets
        if (offset % 5000 === 0) {
          logInfo('Repository', 'MatchingRepository.getUserFollowing', 
            `Retrieved ${allFollowing.length} following records so far`, userId);
        }
      }

      logInfo('Repository', 'MatchingRepository.getUserFollowing', 
        `Retrieved total of ${allFollowing.length} following records`, userId);

      return allFollowing;

    } catch (error) {
      logError('Repository', 'MatchingRepository.getUserFollowing', 
        `Failed after retrieving ${allFollowing.length} records`, userId, error);
      throw error;
    }
  }

  /**
   * Récupère les followers de l'utilisateur
   * @param userId UUID de l'utilisateur
   * @param limit Nombre maximum de résultats (0 = pas de limite, récupère tout)
   * @returns Liste des twitter_ids des followers
   */
  async getUserFollowers(userId: string, limit: number = 0): Promise<string[]> {
    const BATCH_SIZE = 1000;
    const allFollowers: string[] = [];
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data, error } = await this.supabase
          .from('sources_followers')
          .select('follower_id')
          .eq('source_id', userId)
          .range(offset, offset + BATCH_SIZE - 1)
          .order('follower_id'); // Ordre consistant pour la pagination

        if (error) {
          logError('Repository', 'MatchingRepository.getUserFollowers', error, userId, { 
            limit, 
            offset, 
            batchSize: BATCH_SIZE 
          });
          throw error;
        }

        const batch = data?.map(item => item.follower_id) || [];
        allFollowers.push(...batch);

        // Vérifier si on a atteint la limite demandée
        if (limit > 0 && allFollowers.length >= limit) {
          return allFollowers.slice(0, limit);
        }

        // Vérifier s'il y a encore des données
        hasMore = batch.length === BATCH_SIZE;
        offset += BATCH_SIZE;

        // Log de progression pour les gros datasets
        if (offset % 5000 === 0) {
          logInfo('Repository', 'MatchingRepository.getUserFollowers', 
            `Retrieved ${allFollowers.length} follower records so far`, userId);
        }
      }

      logInfo('Repository', 'MatchingRepository.getUserFollowers', 
        `Retrieved total of ${allFollowers.length} follower records`, userId);

      return allFollowers;

    } catch (error) {
      logError('Repository', 'MatchingRepository.getUserFollowers', 
        `Failed after retrieving ${allFollowers.length} records`, userId, error);
      throw error;
    }
  }

  /**
   * Récupère les stats cachées de l'utilisateur depuis user_stats_cache
   * @param userId UUID de l'utilisateur
   * @returns Stats cachées ou null si pas trouvées
   */
  async getCachedUserStats(userId: string): Promise<{
    followers: number;
    following: number;
  } | null> {
    const { data, error } = await this.supabase
      .from('user_stats_cache')
      .select('stats')
      .eq('user_id', userId)
      .single();

    console.log("data", data)
    console.log("error", error)

    if (error) {
      logWarning('Repository', 'MatchingRepository.getCachedUserStats', 
        'No cached stats found, will fallback to direct count', userId);
      return null;
    }

    const stats = data?.stats as any;
    if (stats?.connections) {
      return {
        followers: stats.connections.followers || 0,
        following: stats.connections.following || 0
      };
    }

    return null;
  }

  /**
   * Récupère le nombre total de personnes que l'utilisateur suit (depuis cache ou count direct)
   * @param userId UUID de l'utilisateur
   * @returns Nombre total de following
   */
  async getUserFollowingCount(userId: string): Promise<number> {

    console.log("FOLLOWING")
    // Essayer d'abord le cache
    const cachedStats = await this.getCachedUserStats(userId);
    if (cachedStats) {
      return cachedStats.following;
    }

    console.log("cachedStats", cachedStats)


    // Fallback sur count direct si pas de cache
    const { count, error } = await this.supabase
      .from('sources_targets')
      .select('*', { count: 'exact', head: true})
      .eq('source_id', userId)
      .eq('dismissed', false);

    console.log("count", count)
    console.log("error", error)

    if (error) {
      logError('Repository', 'MatchingRepository.getUserFollowingCount', error, userId);
      throw error;
    }

    return count || 0;
  }

  /**
   * Récupère le nombre total de followers de l'utilisateur (depuis cache ou count direct)
   * @param userId UUID de l'utilisateur
   * @returns Nombre total de followers
   */
  async getUserFollowersCount(userId: string): Promise<number> {

    console.log("FOLLOWERS")
    // Essayer d'abord le cache
    const cachedStats = await this.getCachedUserStats(userId);
    if (cachedStats) {
      return cachedStats.followers;
    }

    console.log("cachedStats", cachedStats)

    // Fallback sur count direct si pas de cache
    const { count, error } = await this.supabase
      .from('sources_followers')
      .select('*', { count: 'exact', head: true})
      .eq('source_id', userId);

    console.log("count", count)
    console.log("error", error)

    if (error) {
      logError('Repository', 'MatchingRepository.getUserFollowersCount', error, userId);
      throw error;
    }

    return count || 0;
  }

  /**
   * Récupère le réseau complet de l'utilisateur (following + followers)
   * @param userId UUID de l'utilisateur
   * @param limit Nombre maximum de résultats par type (0 = pas de limite, récupère tout, max 1M pour performance)
   * @returns Objet avec following, followers et stats (avec vrais totaux)
   */
  async getUserNetwork(userId: string, limit: number = 100000): Promise<{
    following: string[];
    followers: string[];
    // stats: {
    //   followingCount: number;
    //   followersCount: number;
    //   isLimited: boolean;
    // };
  }> {
    console.log("userOd ----> ", userId)
    console.log("limit ----> ", limit)
    
    // Limite de sécurité pour les très gros comptes (1 million max par type)
    const MAX_CONNECTIONS_PER_TYPE = 1000000;
    const effectiveLimit = limit === 0 ? MAX_CONNECTIONS_PER_TYPE : Math.min(limit, MAX_CONNECTIONS_PER_TYPE);
    
    // Récupérer les données ET les vrais totaux en parallèle
    const [following, followers] = await Promise.all([
      this.getUserFollowing(userId, effectiveLimit),
      this.getUserFollowers(userId, effectiveLimit),
      // this.
    ]);

    return {
      following,
      followers,
      // stats
    };
  }

/**
 * Récupère les données du graphe social avec les connexions retrouvées
 * @param inputId - UUID (source_id) ou Twitter ID
 * @returns Données du graphe social selon la stratégie détectée
 */
async getSocialGraphData(inputId: string): Promise<{ data: SocialGraphData | null; error: any }> {
  console.log('MatchingRepository', 'getSocialGraphData', `Fetching social graph data for input: ${inputId}`);

  try {
    const result = await this.supabase.rpc('get_social_graph_data', {
      input_id: inputId
    });

    if (result.error) {
      logError('MatchingRepository', 'getSocialGraphData', 'Error calling get_social_graph_data', result.error);
      return { data: null, error: result.error };
    }

    if (!result.data) {
      logWarning('MatchingRepository', 'getSocialGraphData', 'No data returned from get_social_graph_data');
      return { data: null, error: null };
    }

    console.log('MatchingRepository', 'getSocialGraphData', `Successfully fetched social graph data`, {
      strategy: result.data.strategy,
      inputId
    });

    return { data: result.data as SocialGraphData, error: null };
  } catch (error) {
    logError('MatchingRepository', 'getSocialGraphData', 'Exception in getSocialGraphData', error);
    return { data: null, error };
  }
}

}
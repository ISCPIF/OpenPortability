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
    
    // try {
    //   // 1. Essayer Redis-first approach
    //   console.log('🔴 [MatchingRepository.getFollowableTargets] Tentative Redis-first...');
    //   const redisResult = await this.getFollowableTargetsFromRedis(userId, pageSize, pageNumber);
      
    //   if (redisResult.data !== null) {
    //     console.log('✅ [MatchingRepository.getFollowableTargets] Redis réussi - éléments:', redisResult.data?.length || 0);
    //     console.log('✅ [MatchingRepository.getFollowableTargets] Détail Redis result:', redisResult.data);
    //     return redisResult;
    //   } else {
    //     console.log('🔴 [MatchingRepository.getFollowableTargets] Redis a retourné null - fallback vers SQL');
    //   }
    // } catch (redisError) {
    //   console.log('⚠️ [MatchingRepository.getFollowableTargets] Erreur Redis - fallback vers SQL:', redisError);
    //   logWarning('Repository', 'MatchingRepository.getFollowableTargets', 'Redis unavailable, falling back to SQL', userId, {
    //     error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
    //   });
    // }

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

  /**
   * Nouvelle implémentation Redis-first pour getFollowableTargets
   */
  private async getFollowableTargetsFromRedis(
    userId: string,
    pageSize: number,
    pageNumber: number
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    console.log('🔴 [getFollowableTargetsFromRedis] Début Redis - userId:', userId);
    
    try {
      // 1. D'abord récupérer les plateformes connectées de l'utilisateur (comme PostgreSQL)
      console.log('👤 [getFollowableTargetsFromRedis] Récupération des plateformes utilisateur...');
      const { data: userPlatforms, error: userError } = await authClient
        .from('users')
        .select('bluesky_username, mastodon_username')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('❌ [getFollowableTargetsFromRedis] Erreur plateformes utilisateur:', userError);
        throw new Error(`User platforms error: ${userError.message}`);
      }

      const hasBluesky = !!userPlatforms?.bluesky_username;
      const hasMastodon = !!userPlatforms?.mastodon_username;
      
      console.log('👤 [getFollowableTargetsFromRedis] Plateformes utilisateur - Bluesky:', hasBluesky, 'Mastodon:', hasMastodon);
      console.log('👤 [getFollowableTargetsFromRedis] Détail userPlatforms:', userPlatforms);

      // 2. Récupérer tous les sources_targets de l'utilisateur qui ne sont pas encore suivis
      console.log('💾 [getFollowableTargetsFromRedis] Récupération sources_targets...');
      const { data: sourcesTargets, error: dbError } = await this.supabase
        .from('sources_targets')
        .select('node_id::text, has_follow_bluesky, has_follow_mastodon, followed_at_bluesky, followed_at_mastodon, dismissed') // FORCER node_id en TEXT
        .eq('source_id', userId)
        .or('has_follow_bluesky.eq.false,has_follow_mastodon.eq.false'); // Au moins une plateforme non suivie

      if (dbError) {
        console.error('❌ [getFollowableTargetsFromRedis] Erreur base de données:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log('💾 [getFollowableTargetsFromRedis] Sources targets récupérés:', sourcesTargets?.length || 0);
      console.log('💾 [getFollowableTargetsFromRedis] Détail sources targets:', sourcesTargets);

      if (!sourcesTargets || sourcesTargets.length === 0) {
        console.log('🚫 [getFollowableTargetsFromRedis] Aucun sources_targets - retour vide');
        return { data: [], error: null };
      }

      // 3. Récupérer les correspondances depuis Redis en batch
      const twitterIds = sourcesTargets.map(st => st.node_id); // CONVERSION EN STRING
      
      console.log('🔴 [getFollowableTargetsFromRedis] Twitter IDs à rechercher dans Redis:', twitterIds.length);
      console.log('🔴 [getFollowableTargetsFromRedis] Détail Twitter IDs:', twitterIds.slice(0, 10), '...'); // Afficher seulement les 10 premiers
      
      // Utiliser la méthode batchGetSocialMappings au lieu de mget
      const mappings = await redis.batchGetSocialMappings(twitterIds);
      
      console.log('🔴 [getFollowableTargetsFromRedis] Mappings Redis récupérés:', mappings.size);
      console.log('🔴 [getFollowableTargetsFromRedis] Exemple mappings:', Array.from(mappings.entries()).slice(0, 3));

      // 4. Construire les résultats avec les correspondances trouvées ET filtrage par plateformes utilisateur
      console.log('🔍 [getFollowableTargetsFromRedis] Construction des résultats...');
      const results: StoredProcedureTarget[] = [];
      let totalCount = 0;
      let skippedCount = 0;
      let skippedReasons: { [key: string]: number } = {};
      let blueskyMappings = 0;
      let mastodonMappings = 0;
      let bothPlatformMappings = 0;

      for (const sourceTarget of sourcesTargets) {
        const twitterId = sourceTarget.node_id; // CONVERSION EN STRING
        
        // Récupérer les mappings depuis la Map retournée
        const mapping = mappings.get(twitterId);

        // NOUVELLE LOGIQUE: Filtrer selon les plateformes connectées de l'utilisateur (comme PostgreSQL)
        const hasBlueskyMapping = !!(mapping?.bluesky);
        const hasMastodonMapping = !!(mapping?.mastodon);
        
        // Condition identique à PostgreSQL: (has_bluesky AND bluesky_mapping) OR (has_mastodon AND mastodon_mapping)
        const shouldInclude = (hasBluesky && hasBlueskyMapping) || (hasMastodon && hasMastodonMapping);

        if (shouldInclude) {
          // Compter les plateformes SEULEMENT pour les plateformes connectées
          if (hasBluesky && hasBlueskyMapping) blueskyMappings++;
          if (hasMastodon && hasMastodonMapping) mastodonMappings++;
          if (hasBluesky && hasBlueskyMapping && hasMastodon && hasMastodonMapping) bothPlatformMappings++;

          const result: StoredProcedureTarget = {
            node_id: twitterId,
            // Retourner les données seulement pour les plateformes connectées (comme PostgreSQL)
            bluesky_handle: (hasBluesky && mapping?.bluesky) || null,
            mastodon_handle: (hasMastodon && mapping?.mastodon?.username) || null,
            mastodon_id: (hasMastodon && mapping?.mastodon?.id) || null,
            mastodon_username: (hasMastodon && mapping?.mastodon?.username) || null,
            mastodon_instance: (hasMastodon && mapping?.mastodon?.instance) || null,
            has_follow_bluesky: sourceTarget.has_follow_bluesky || false,
            has_follow_mastodon: sourceTarget.has_follow_mastodon || false,
            followed_at_bluesky: sourceTarget.followed_at_bluesky,
            followed_at_mastodon: sourceTarget.followed_at_mastodon,
            dismissed: sourceTarget.dismissed || false,
            total_count: 0 // Sera mis à jour après
          };

          results.push(result);
          totalCount++;
        } else {
          // Compter les comptes ignorés et leurs raisons
          skippedCount++;
          if (!mapping) {
            skippedReasons['no_mapping'] = (skippedReasons['no_mapping'] || 0) + 1;
          } else if (!shouldInclude) {
            skippedReasons['platform_not_connected'] = (skippedReasons['platform_not_connected'] || 0) + 1;
          }
        }
      }

  

      console.log('📈 [getFollowableTargetsFromRedis] Statistiques de construction:');
      console.log('  - Total results:', results.length);
      console.log('  - Skipped count:', skippedCount);
      console.log('  - Skipped reasons:', skippedReasons);
      console.log('  - Bluesky mappings:', blueskyMappings);
      console.log('  - Mastodon mappings:', mastodonMappings);
      console.log('  - Both platform mappings:', bothPlatformMappings);

      // 5. Appliquer la pagination
      const startIndex = pageNumber * pageSize;
      const endIndex = startIndex + pageSize;
      console.log('📄 [getFollowableTargetsFromRedis] Pagination - startIndex:', startIndex, 'endIndex:', endIndex);
      
      const paginatedResults = results.slice(startIndex, endIndex);
      console.log('📄 [getFollowableTargetsFromRedis] Résultats paginés:', paginatedResults.length);

      // 6. Ajouter le total_count à chaque résultat
      paginatedResults.forEach(result => {
        result.total_count = totalCount;
      });

      console.log('✅ [getFollowableTargetsFromRedis] Résultat final Redis:', paginatedResults);
      return { data: paginatedResults, error: null };

    } catch (error) {
      console.error('❌ [getFollowableTargetsFromRedis] Erreur Redis:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      logError('Repository', 'MatchingRepository.getFollowableTargetsFromRedis', err, userId);
      return { data: null, error: error };
    }
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
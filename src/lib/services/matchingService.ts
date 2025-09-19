import { MatchingRepository } from '../repositories/matchingRepository';
import { MatchingResult, MatchingTarget, MatchingStats, MatchedFollower } from '../types/matching';
import { StatsService } from './statsServices';
import { StatsRepository } from '../repositories/statsRepository';
import logger from '../log_utils';

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
    console.log('🚀 [MatchingService.getFollowableTargets] Début de la récupération des cibles pour userId:', userId);
    
    const PAGE_SIZE = 1000;
    let allMatches: MatchingTarget[] = [];
    let page = 0;
    let totalCount = 0;

    console.log('📋 [MatchingService.getFollowableTargets] Configuration - PAGE_SIZE:', PAGE_SIZE);

    // Première requête pour obtenir le total et la première page
    console.log('📡 [MatchingService.getFollowableTargets] Appel repository.getFollowableTargets pour la première page...');
    const { data: firstPageMatches, error: firstPageError } = 
      await this.repository.getFollowableTargets(userId, PAGE_SIZE, 0);

    if (firstPageError) {
      console.error('❌ [MatchingService.getFollowableTargets] Erreur lors de la première page:', firstPageError);
      throw new Error(`Failed to fetch first page: ${firstPageError}`);
    }

    console.log('📊 [MatchingService.getFollowableTargets] Première page reçue - nombre d\'éléments:', firstPageMatches?.length || 0);
    console.log('📊 [MatchingService.getFollowableTargets] Détail première page:', firstPageMatches);

    if (!firstPageMatches || firstPageMatches.length === 0) {
      console.log('🚫 [MatchingService.getFollowableTargets] Aucune donnée trouvée - retour résultat vide');
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

    console.log('🔢 [MatchingService.getFollowableTargets] Total count détecté:', totalCount);
    console.log('📄 [MatchingService.getFollowableTargets] Éléments ajoutés à allMatches:', allMatches.length);

    // Calculate total pages based on total count
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    console.log('📚 [MatchingService.getFollowableTargets] Nombre total de pages calculé:', totalPages);
    
    while (page < totalPages) {
      console.log(`🔄 [MatchingService.getFollowableTargets] Récupération page ${page + 1}/${totalPages}...`);

      const { data: matches, error: matchesError } = 
        await this.repository.getFollowableTargets(userId, PAGE_SIZE, page);
      
      if (matchesError) {
        console.error(`❌ [MatchingService.getFollowableTargets] Erreur page ${page + 1}:`, matchesError);
        break;
      }

      console.log(`📊 [MatchingService.getFollowableTargets] Page ${page + 1} reçue - éléments:`, matches?.length || 0);

      if (!matches || matches.length === 0) {
        console.log(`🚫 [MatchingService.getFollowableTargets] Page ${page + 1} vide - arrêt de la pagination`);
        break;
      }

      if (page === 0) {
        console.log('⏭️ [MatchingService.getFollowableTargets] Page 0 déjà ajoutée précédemment');
        // First page already added above
      } else {
        const beforeLength = allMatches.length;
        allMatches = [...allMatches, ...matches];
        console.log(`➕ [MatchingService.getFollowableTargets] Page ${page + 1} ajoutée - avant: ${beforeLength}, après: ${allMatches.length}`);
      }

      page++;
      // Safety check to prevent infinite loops
      if (allMatches.length >= totalCount) {
        console.log('🛑 [MatchingService.getFollowableTargets] Limite de sécurité atteinte - arrêt');
        break;
      }
    }

    const blueskyMatches = allMatches.filter(m => m.bluesky_handle).length;
    const mastodonMatches = allMatches.filter(m => m.mastodon_id).length;

    console.log('📈 [MatchingService.getFollowableTargets] Statistiques finales:');
    console.log('  - Total following:', totalCount);
    console.log('  - Matched following:', allMatches.length);
    // console.log('  - Bluesky matches:', blueskyMatches);
    // console.log('  - Mastodon matches:', mastodonMatches);

    const result = {
      following: allMatches,
      stats: {
        total_following: totalCount,
        matched_following: allMatches.length,
        bluesky_matches: blueskyMatches,
        mastodon_matches: mastodonMatches
      }
    };
    
    // console.log('✅ [MatchingService.getFollowableTargets] Résultat final construit:', result);
    return result;
  }

  async getSourcesFromFollower(twitterId: string): Promise<MatchingResult> {
    
    // ÉTAPE 1: Récupérer les Twitter IDs depuis le repository
    const { data: basicData, error } = await this.repository.getSourcesFromFollower(twitterId);
    
    if (error) {
      logger.logError('[MatchingService] Error from repository:', error, "system");
      throw new Error(`Failed to fetch sources: ${error}`);
    }

    if (!basicData || basicData.length === 0) {
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


    // NOUVELLE LOGIQUE: Utiliser directement les données retournées par l'RPC
    // et ne plus dépendre de Redis pour filtrer ou enrichir les résultats.
    const normalizeBlueskyHandle = (value: any): string | null => {
      if (!value) return null;
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      // Nouveau format JSON: {"username":"...","id":"..."}
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          return parsed?.username ?? null;
        } catch {
          return null;
        }
      }
      // Legacy formats: plain handle like "fondationshoah.bsky.social" or pipe "username|id"
      if (trimmed.includes('|')) {
        const [username] = trimmed.split('|');
        return username || null;
      }
      return trimmed; // plain handle
    };

    const mappedFollowers: MatchedFollower[] = (basicData as any[]).map((item) => ({
      source_twitter_id: item.source_twitter_id?.toString?.() ?? String(item.source_twitter_id),
      bluesky_handle: normalizeBlueskyHandle(item.bluesky_handle),
      mastodon_id: item.mastodon_id ?? null,
      mastodon_username: item.mastodon_username ?? null,
      mastodon_instance: item.mastodon_instance ?? null,
      has_been_followed_on_bluesky: !!item.has_been_followed_on_bluesky,
      has_been_followed_on_mastodon: !!item.has_been_followed_on_mastodon,
    }));

    // ÉTAPE 3: Retourner le résultat au format MatchingResult
    const result = {
      following: mappedFollowers,
      stats: {
        total_following: basicData.length,
        matched_following: mappedFollowers.length,
        bluesky_matches: mappedFollowers.filter(f => f.bluesky_handle).length,
        mastodon_matches: mappedFollowers.filter(f => f.mastodon_id).length
      }
    };
    
    return result as unknown as MatchingResult;
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
      
      // Marquer comme unavailable si échec
      if (action.status !== 'success' && action.error) {
        await this.repository.markNodesAsUnavailableBatch([action.targetId], action.platform, action.error);
      }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to update follow status:', errorString, "system");
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
      console.log('updateFollowStatusBatch - success:', success, 'error:', error, 'targetIds.length:', targetIds.length);
      
      if (success) {
        console.log('Success path - refreshing user stats');
        await this.statsService.refreshUserStats(userId, true);
      }
      else if (!success && error && targetIds.length > 0) {
        console.log('Error path - marking nodes as unavailable');
        console.log('Marking nodes as unavailable', `Platform: ${platform}, Error: ${error}, TargetIds: ${JSON.stringify(targetIds)}`, "system");
        try {
          await this.repository.markNodesAsUnavailableBatch(targetIds, platform, error);
          console.log('Successfully marked nodes as unavailable', `Count: ${targetIds.length}`, "system");
          await this.statsService.refreshUserStats(userId, true);

        } catch (markError) {
          // Log l'erreur mais ne fait pas échouer toute l'opération
          const markErrorString = markError instanceof Error ? markError.message : String(markError);
          console.log('Failed to mark nodes as unavailable:', markErrorString, "system");
        }
      } else {
        console.log('No action taken - success:', success, 'error:', !!error, 'targetIds.length:', targetIds.length);
      }
  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    logger.logError('Failed to update follow status batch:', errorString, "system");
      throw new Error('Failed to update follow status batch');
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to update sources followers status:', errorString, "system");
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to update sources followers status:', errorString, "system");
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
}
import { redisClient } from './redisClient';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;


if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

export interface BlueskyMapping {
  twitter_id: string;
  bluesky_username: string;
}

export interface MastodonMapping {
  twitter_id: string;
  mastodon_id: string;
  mastodon_username: string;
  mastodon_instance: string;
}

export interface BatchUpdateResult {
  processed: number;
  updated: number;
  errors: number;
  duration: number;
}

export class SocialMappingService {
  private static readonly BATCH_SIZE = 1000;
  private static readonly BLUESKY_KEY_PREFIX = 'twitter_to_bluesky:';
  private static readonly MASTODON_KEY_PREFIX = 'twitter_to_mastodon:';

  /**
   * Migration initiale : Peupler Redis depuis PostgreSQL
   */
  async migrateFromDatabase(): Promise<{ bluesky: number; mastodon: number }> {
    console.log('[SocialMappingService] Starting migration from database to Redis');
    
    const startTime = Date.now();
    let blueskyCount = 0;
    let mastodonCount = 0;

    try {
      // Migration Bluesky
      console.log('[SocialMappingService] Migrating Bluesky mappings...');
      const { data: blueskyData, error: blueskyError } = await supabase
        .from('twitter_bluesky_users')
        .select('twitter_id, bluesky_username');

      if (blueskyError) {
        throw new Error(`Failed to fetch Bluesky data: ${blueskyError.message}`);
      }

      if (blueskyData && blueskyData.length > 0) {
        blueskyCount = await this.batchSetBlueskyMappings(blueskyData);
      }

      // Migration Mastodon
      console.log('[SocialMappingService] Migrating Mastodon mappings...');
      const { data: mastodonData, error: mastodonError } = await supabase
        .from('twitter_mastodon_users')
        .select('twitter_id, mastodon_id, mastodon_username, mastodon_instance');

      if (mastodonError) {
        throw new Error(`Failed to fetch Mastodon data: ${mastodonError.message}`);
      }

      if (mastodonData && mastodonData.length > 0) {
        mastodonCount = await this.batchSetMastodonMappings(mastodonData);
      }

      const duration = Date.now() - startTime;
      console.log(`[SocialMappingService] Migration completed in ${duration}ms - Bluesky: ${blueskyCount}, Mastodon: ${mastodonCount}`);

      return { bluesky: blueskyCount, mastodon: mastodonCount };

    } catch (error) {
      console.error('[SocialMappingService] Migration failed:', error);
      throw error;
    }
  }

  /**
   * Batch set pour les mappings Bluesky
   */
  private async batchSetBlueskyMappings(mappings: BlueskyMapping[]): Promise<number> {
    let totalSet = 0;
    
    for (let i = 0; i < mappings.length; i += SocialMappingService.BATCH_SIZE) {
      const batch = mappings.slice(i, i + SocialMappingService.BATCH_SIZE);
      
      try {
        const pipeline = redisClient.getClient().pipeline();
        
        for (const mapping of batch) {
          const key = `${SocialMappingService.BLUESKY_KEY_PREFIX}${mapping.twitter_id}`;
          pipeline.set(key, mapping.bluesky_username);
        }
        
        await pipeline.exec();
        totalSet += batch.length;
        
        console.log(`[SocialMappingService] Bluesky batch ${Math.floor(i / SocialMappingService.BATCH_SIZE) + 1}: ${batch.length} mappings set`);
        
      } catch (error) {
        console.error(`[SocialMappingService] Failed to set Bluesky batch starting at ${i}:`, error);
        throw error;
      }
    }
    
    return totalSet;
  }

  /**
   * Batch set pour les mappings Mastodon
   */
  private async batchSetMastodonMappings(mappings: MastodonMapping[]): Promise<number> {
    let totalSet = 0;
    
    for (let i = 0; i < mappings.length; i += SocialMappingService.BATCH_SIZE) {
      const batch = mappings.slice(i, i + SocialMappingService.BATCH_SIZE);
      
      try {
        const pipeline = redisClient.getClient().pipeline();
        
        for (const mapping of batch) {
          const key = `${SocialMappingService.MASTODON_KEY_PREFIX}${mapping.twitter_id}`;
          const value = JSON.stringify({
            id: mapping.mastodon_id,
            username: mapping.mastodon_username,
            instance: mapping.mastodon_instance
          });
          pipeline.set(key, value);
        }
        
        await pipeline.exec();
        totalSet += batch.length;
        
        console.log(`[SocialMappingService] Mastodon batch ${Math.floor(i / SocialMappingService.BATCH_SIZE) + 1}: ${batch.length} mappings set`);
        
      } catch (error) {
        console.error(`[SocialMappingService] Failed to set Mastodon batch starting at ${i}:`, error);
        throw error;
      }
    }
    
    return totalSet;
  }

  /**
   * Mise à jour batch des sources_targets depuis Redis
   */
  async batchUpdateSourcesTargets(twitterIds: string[]): Promise<BatchUpdateResult> {
    const startTime = Date.now();
    let processed = 0;
    let updated = 0;
    let errors = 0;

    console.log(`[SocialMappingService] Starting batch update for ${twitterIds.length} twitter IDs`);

    try {
      for (let i = 0; i < twitterIds.length; i += SocialMappingService.BATCH_SIZE) {
        const batch = twitterIds.slice(i, i + SocialMappingService.BATCH_SIZE);
        
        try {
          const batchResult = await this.processBatch(batch);
          processed += batchResult.processed;
          updated += batchResult.updated;
          errors += batchResult.errors;
          
          console.log(`[SocialMappingService] Batch ${Math.floor(i / SocialMappingService.BATCH_SIZE) + 1}: processed ${batchResult.processed}, updated ${batchResult.updated}, errors ${batchResult.errors}`);
          
        } catch (error) {
          console.error(`[SocialMappingService] Batch failed starting at ${i}:`, error);
          errors += batch.length;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[SocialMappingService] Batch update completed in ${duration}ms - Processed: ${processed}, Updated: ${updated}, Errors: ${errors}`);

      return { processed, updated, errors, duration };

    } catch (error) {
      console.error('[SocialMappingService] Batch update failed:', error);
      throw error;
    }
  }

  /**
   * Traitement d'un batch de twitter IDs
   */
  private async processBatch(twitterIds: string[]): Promise<{ processed: number; updated: number; errors: number }> {
    let processed = 0;
    let updated = 0;
    let errors = 0;

    try {
      // 1. Récupérer les mappings depuis Redis
      const mappings = await this.getMappingsFromRedis(twitterIds);
      
      // 2. Préparer les updates pour PostgreSQL
      const updates = this.prepareUpdates(mappings);
      
      // 3. Exécuter les updates en batch
      if (updates.length > 0) {
        const updateResult = await this.executeUpdates(updates);
        updated = updateResult;
      }
      
      processed = twitterIds.length;

    } catch (error) {
      console.error('[SocialMappingService] Batch processing error:', error);
      errors = twitterIds.length;
    }

    return { processed, updated, errors };
  }

  /**
   * Récupération des mappings depuis Redis avec fallback DB
   */
  private async getMappingsFromRedis(twitterIds: string[]): Promise<Map<string, { bluesky?: string; mastodon?: any }>> {
    const mappings = new Map();

    try {
      // Tentative Redis d'abord
      const pipeline = redisClient.getClient().pipeline();
      
      for (const twitterId of twitterIds) {
        pipeline.get(`${SocialMappingService.BLUESKY_KEY_PREFIX}${twitterId}`);
        pipeline.get(`${SocialMappingService.MASTODON_KEY_PREFIX}${twitterId}`);
      }
      
      const results = await pipeline.exec();
      
      // Traitement des résultats Redis
      for (let i = 0; i < twitterIds.length; i++) {
        const twitterId = twitterIds[i];
        const blueskyResult = results?.[i * 2];
        const mastodonResult = results?.[i * 2 + 1];
        
        const mapping: any = {};
        
        if (blueskyResult && blueskyResult[1]) {
          mapping.bluesky = blueskyResult[1];
        }
        
        if (mastodonResult && mastodonResult[1]) {
          try {
            mapping.mastodon = JSON.parse(mastodonResult[1] as string);
          } catch (e) {
            console.error(`[SocialMappingService] Failed to parse Mastodon data for ${twitterId}:`, e);
          }
        }
        
        if (mapping.bluesky || mapping.mastodon) {
          mappings.set(twitterId, mapping);
        }
      }
      
      console.log(`[SocialMappingService] Retrieved ${mappings.size} mappings from Redis for ${twitterIds.length} twitter IDs`);

    } catch (error) {
      console.error('[SocialMappingService] Redis lookup failed, falling back to database:', error);
      
      // Fallback vers la base de données
      return await this.getMappingsFromDatabase(twitterIds);
    }

    return mappings;
  }

  /**
   * Fallback : récupération depuis la base de données
   */
  private async getMappingsFromDatabase(twitterIds: string[]): Promise<Map<string, { bluesky?: string; mastodon?: any }>> {
    const mappings = new Map();

    try {
      // Récupérer Bluesky mappings
      const { data: blueskyData } = await supabase
        .from('twitter_bluesky_users')
        .select('twitter_id, bluesky_username')
        .in('twitter_id', twitterIds);

      // Récupérer Mastodon mappings
      const { data: mastodonData } = await supabase
        .from('twitter_mastodon_users')
        .select('twitter_id, mastodon_id, mastodon_username, mastodon_instance')
        .in('twitter_id', twitterIds);

      // Combiner les résultats
      for (const twitterId of twitterIds) {
        const mapping: any = {};
        
        const blueskyMatch = blueskyData?.find(b => b.twitter_id === twitterId);
        if (blueskyMatch) {
          mapping.bluesky = blueskyMatch.bluesky_username;
        }
        
        const mastodonMatch = mastodonData?.find(m => m.twitter_id === twitterId);
        if (mastodonMatch) {
          mapping.mastodon = {
            id: mastodonMatch.mastodon_id,
            username: mastodonMatch.mastodon_username,
            instance: mastodonMatch.mastodon_instance
          };
        }
        
        if (mapping.bluesky || mapping.mastodon) {
          mappings.set(twitterId, mapping);
        }
      }

      console.log(`[SocialMappingService] Retrieved ${mappings.size} mappings from database fallback for ${twitterIds.length} twitter IDs`);

    } catch (error) {
      console.error('[SocialMappingService] Database fallback failed:', error);
      throw error;
    }

    return mappings;
  }

  /**
   * Préparer les updates SQL
   */
  private prepareUpdates(mappings: Map<string, { bluesky?: string; mastodon?: any }>): Array<{
    twitter_id: string;
    bluesky_handle?: string;
    mastodon_id?: string;
    mastodon_username?: string;
    mastodon_instance?: string;
  }> {
    const updates = [];

    for (const [twitterId, mapping] of mappings) {
      const update: any = { twitter_id: twitterId };
      
      if (mapping.bluesky) {
        update.bluesky_handle = mapping.bluesky;
      }
      
      if (mapping.mastodon) {
        update.mastodon_id = mapping.mastodon.id;
        update.mastodon_username = mapping.mastodon.username;
        update.mastodon_instance = mapping.mastodon.instance;
      }
      
      updates.push(update);
    }

    return updates;
  }

  /**
   * Exécuter les updates en base
   */
  private async executeUpdates(updates: Array<any>): Promise<number> {
    let totalUpdated = 0;

    try {
      for (const update of updates) {
        const { twitter_id, ...fields } = update;
        
        const { error } = await supabase
          .from('sources_targets')
          .update(fields)
          .eq('target_twitter_id', twitter_id);

        if (error) {
          console.error(`[SocialMappingService] Failed to update ${twitter_id}:`, error);
        } else {
          totalUpdated++;
        }
      }

    } catch (error) {
      console.error('[SocialMappingService] Execute updates failed:', error);
      throw error;
    }

    return totalUpdated;
  }

  /**
   * Synchroniser un nouveau mapping (appelé lors de linking d'account)
   */
 
  async syncNewMapping(twitterId: string, platform: 'bluesky' | 'mastodon', data: any): Promise<void> {
    console.log(`[SocialMappingService] Syncing new ${platform} mapping for twitter ID: ${twitterId}`);
    
    try {
      if (platform === 'bluesky') {
        const key = `${SocialMappingService.BLUESKY_KEY_PREFIX}${twitterId}`;
        await redisClient.getClient().set(key, data.bluesky_username);
        console.log(`[SocialMappingService] Updated Redis key: ${key} = ${data.bluesky_username}`);
      } else if (platform === 'mastodon') {
        const key = `${SocialMappingService.MASTODON_KEY_PREFIX}${twitterId}`;
        const mastodonData = {
          id: data.mastodon_id,
          username: data.mastodon_username,
          instance: data.mastodon_instance
        };
        await redisClient.getClient().set(key, JSON.stringify(mastodonData));
        console.log(`[SocialMappingService] Updated Redis key: ${key} = ${JSON.stringify(mastodonData)}`);
      }
    } catch (error) {
      console.error(`[SocialMappingService] Failed to sync ${platform} mapping to Redis:`, error);
      // Ne pas faire échouer l'opération principale si Redis échoue
    }
  }

 

  /**
   * Invalider un mapping (appelé lors de unlinking d'account)
   */
  async invalidateMapping(twitterId: string, platform: 'bluesky' | 'mastodon'): Promise<void> {
    console.log(`[SocialMappingService] Invalidating ${platform} mapping for twitter ID: ${twitterId}`);
    
    try {
      const key = platform === 'bluesky' 
        ? `${SocialMappingService.BLUESKY_KEY_PREFIX}${twitterId}`
        : `${SocialMappingService.MASTODON_KEY_PREFIX}${twitterId}`;
        
        await redisClient.getClient().del(key);
        console.log(`[SocialMappingService] Deleted Redis key: ${key}`);
    } catch (error) {
      console.error(`[SocialMappingService] Failed to invalidate ${platform} mapping in Redis:`, error);
      // Ne pas faire échouer l'opération principale si Redis échoue
    }
  }

  /**
   * Synchroniser tous les mappings modifiés depuis une date donnée
   */
  async syncRecentMappings(sinceDate: Date): Promise<{ synced: number; errors: number }> {
    console.log(`[SocialMappingService] Syncing mappings modified since: ${sinceDate.toISOString()}`);
    
    let synced = 0;
    let errors = 0;

    try {
      // Récupérer les mappings Bluesky modifiés
      const { data: blueskyData, error: blueskyError } = await supabase
        .from('twitter_bluesky_users')
        .select('twitter_id, bluesky_username, updated_at')
        .gte('updated_at', sinceDate.toISOString());

      if (blueskyError) {
        console.error('[SocialMappingService] Error fetching recent Bluesky mappings:', blueskyError);
        errors++;
      } else if (blueskyData && blueskyData.length > 0) {
        const blueskyMappings = blueskyData.map(item => ({
          twitter_id: item.twitter_id,
          bluesky_username: item.bluesky_username
        }));
        await this.batchSetBlueskyMappings(blueskyMappings);
        synced += blueskyData.length;
        console.log(`[SocialMappingService] Synced ${blueskyData.length} recent Bluesky mappings`);
      }

      // Récupérer les mappings Mastodon modifiés
      const { data: mastodonData, error: mastodonError } = await supabase
        .from('twitter_mastodon_users')
        .select('twitter_id, mastodon_id, mastodon_username, mastodon_instance, updated_at')
        .gte('updated_at', sinceDate.toISOString());

      if (mastodonError) {
        console.error('[SocialMappingService] Error fetching recent Mastodon mappings:', mastodonError);
        errors++;
      } else if (mastodonData && mastodonData.length > 0) {
        const mastodonMappings = mastodonData.map(item => ({
          twitter_id: item.twitter_id,
          mastodon_id: item.mastodon_id,
          mastodon_username: item.mastodon_username,
          mastodon_instance: item.mastodon_instance
        }));
        await this.batchSetMastodonMappings(mastodonMappings);
        synced += mastodonData.length;
        console.log(`[SocialMappingService] Synced ${mastodonData.length} recent Mastodon mappings`);
      }

    } catch (error) {
      console.error('[SocialMappingService] Error syncing recent mappings:', error);
      errors++;
    }

    console.log(`[SocialMappingService] Recent sync completed: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  }

  /**
   * Vérifier la cohérence entre Redis et la base de données
   */
  async validateMappingsConsistency(sampleSize: number = 1000): Promise<{
    consistent: number;
    inconsistent: number;
    missing: number;
    details: Array<{ twitterId: string; issue: string; redis?: any; db?: any }>;
  }> {
    console.log(`[SocialMappingService] Validating mappings consistency with sample size: ${sampleSize}`);
    
    const result = {
      consistent: 0,
      inconsistent: 0,
      missing: 0,
      details: [] as Array<{ twitterId: string; issue: string; redis?: any; db?: any }>
    };

    try {
      // Échantillonner des twitter IDs depuis la base de données
      const { data: sampleIds, error } = await supabase
        .from('sources_targets')
        .select('target_twitter_id')
        .limit(sampleSize);

      if (error || !sampleIds) {
        throw new Error(`Failed to fetch sample IDs: ${error?.message}`);
      }

      const typedSampleIds = sampleIds as Array<{ target_twitter_id: string }>;
      const twitterIds: string[] = [...new Set(typedSampleIds.map(item => item.target_twitter_id))].slice(0, sampleSize);
      
      // Récupérer les mappings depuis Redis et DB
      const redisMappings = await this.getMappingsFromRedis(twitterIds);
      const dbMappings = await this.getMappingsFromDatabase(twitterIds);

      // Comparer les mappings
      for (const twitterId of twitterIds) {
        const redisMapping = redisMappings.get(twitterId);
        const dbMapping = dbMappings.get(twitterId);

        if (!redisMapping && !dbMapping) {
          // Pas de mapping dans les deux - normal
          continue;
        }

        if (!redisMapping && dbMapping) {
          result.missing++;
          result.details.push({
            twitterId,
            issue: 'Missing in Redis',
            db: dbMapping
          });
          continue;
        }

        if (redisMapping && !dbMapping) {
          result.inconsistent++;
          result.details.push({
            twitterId,
            issue: 'Extra in Redis',
            redis: redisMapping
          });
          continue;
        }

        // Comparer les valeurs (les deux existent)
        if (redisMapping && dbMapping) {
          let isConsistent = true;
          
          if (redisMapping.bluesky !== dbMapping.bluesky) {
            isConsistent = false;
          }
          
          if (JSON.stringify(redisMapping.mastodon) !== JSON.stringify(dbMapping.mastodon)) {
            isConsistent = false;
          }

          if (isConsistent) {
            result.consistent++;
          } else {
            result.inconsistent++;
            result.details.push({
              twitterId,
              issue: 'Data mismatch',
              redis: redisMapping,
              db: dbMapping
            });
          }
        }
      }

      console.log(`[SocialMappingService] Consistency validation completed:`, {
        consistent: result.consistent,
        inconsistent: result.inconsistent,
        missing: result.missing,
        totalChecked: twitterIds.length
      });

    } catch (error) {
      console.error('[SocialMappingService] Error validating consistency:', error);
    }

    return result;
  }

  /**
   * Obtenir des statistiques Redis
   */
  async getStats(): Promise<{ bluesky: number; mastodon: number; total: number }> {
    try {
      const blueskyKeys = await redisClient.getClient().keys(`${SocialMappingService.BLUESKY_KEY_PREFIX}*`);
      const mastodonKeys = await redisClient.getClient().keys(`${SocialMappingService.MASTODON_KEY_PREFIX}*`);
      
      const stats = {
        bluesky: blueskyKeys.length,
        mastodon: mastodonKeys.length,
        total: blueskyKeys.length + mastodonKeys.length
      };

      console.log('[SocialMappingService] Redis stats:', stats);
      return stats;

    } catch (error) {
      console.error('[SocialMappingService] Failed to get stats:', error);
      return { bluesky: 0, mastodon: 0, total: 0 };
    }
  }
}

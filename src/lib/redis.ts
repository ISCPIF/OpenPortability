import Redis from 'ioredis';
import { supabase } from '@/lib/supabase';
// import { console.log, console.log, console.log } from './log_utils.ts';

// Configuration Redis sécurisée et optimisée
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Sécurité et performance optimisées
  connectTimeout: 30000, // 30s au lieu de 10s
  lazyConnect: false, // Connexion immédiate
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  
  // Pool de connexions optimisé
  family: 4,
  keepAlive: true,
  
  // Timeouts plus longs pour éviter les déconnexions
  maxLoadingTimeout: 10000, // 10s au lieu de 5s
  
  // Nouvelles options pour stabilité
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    return err.message.includes(targetError);
  },
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: true, // Permettre les commandes en attente du ready state
};

class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis(redisConfig);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('Redis', 'Connected to Redis server', 'Connection established');
      // Ne pas mettre isConnected = true ici !
    });
    
    this.client.on('ready', () => {
      console.log('Redis', 'Redis client ready', 'Client ready for operations');
      this.isConnected = true; // ← Déplacer ici !
    });
    
    this.client.on('error', (error) => {
      console.log('Redis', 'Redis connection error', error, 'system');
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('Redis', 'Redis connection closed', 'Connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis', 'Reconnecting to Redis', 'Attempting reconnection');
    });
  }

  // Vérification et attente de la connexion Redis
  async ensureConnection(): Promise<void> {
    // Si pas connecté, attendre la connexion automatique
    if (!this.isConnected) {
      // Attendre jusqu'à 5 secondes pour la connexion
      for (let i = 0; i < 50; i++) {
        if (this.isConnected) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Redis connection not available after 5 seconds');
    }
  }

  // Méthodes sécurisées avec gestion d'erreurs
  async get(key: string): Promise<string | null> {
    try {
      await this.ensureConnection();
      return await this.client.get(key);
    } catch (error) {
      console.log('Redis', 'Failed to get key', error, 'system', { key });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.log('Redis', 'Failed to set key', error, 'system', { key, ttlSeconds });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.log('Redis', 'Failed to delete key', error, 'system', { key });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.log('Redis', 'Failed to check key existence', error, 'system', { key });
      return false;
    }
  }

  async incr(key: string): Promise<number | null> {
    try {
      await this.ensureConnection();
      return await this.client.incr(key);
    } catch (error) {
      console.log('Redis', 'Failed to increment key', error, 'system', { key });
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.log('Redis', 'Failed to set expiration', error, 'system', { key, seconds });
      return false;
    }
  }

  // Méthode pour les opérations de rate limiting
  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    try {
      await this.ensureConnection();
      
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      
      const results = await multi.exec();
      const count = results?.[0]?.[1] as number || 0;
      
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetTime = Date.now() + (windowSeconds * 1000);
      
      return { allowed, remaining, resetTime };
    } catch (error) {
      console.log('Redis', 'Rate limit check failed', error, 'system', { key, limit, windowSeconds });
      // En cas d'erreur Redis, on autorise la requête (fail-open)
      return { allowed: true, remaining: limit, resetTime: Date.now() + (windowSeconds * 1000) };
    }
  }

  // Méthode pour vérifier la santé de Redis
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.log('Redis', 'Redis health check failed', error, 'system');
      return false;
    }
  }

  // ===== MÉTHODES POUR LA GESTION DES JOBS =====

  /**
   * Ajouter un job à la queue Redis pour traitement par les workers
   */
  async enqueueJob(job: {
    id: string;
    user_id: string;
    status: string;
    total_items: number;
    job_type?: string;
    file_paths: string[];
    stats?: any;
    created_at?: string;
    updated_at?: string;
  }): Promise<boolean> {
    try {
      await this.ensureConnection();
      
      const jobData = JSON.stringify({
        ...job,
        enqueuedAt: new Date().toISOString()
      });

      // Ajouter le job à la queue pending
      await this.client.lpush('jobs:pending', jobData);

      // Publier une notification pour réveiller les workers
      await this.client.publish('jobs:notifications', JSON.stringify({
        type: 'new_job',
        jobId: job.id,
        timestamp: Date.now()
      }));

      console.log('Redis', 'Job enqueued successfully', `Job ${job.id} added to queue`, 'system', {
        jobId: job.id,
        userId: job.user_id,
        jobType: job.job_type
      });

      return true;
    } catch (error) {
      console.log('Redis', 'Failed to enqueue job', error, 'system', {
        jobId: job.id,
        userId: job.user_id
      });
      return false;
    }
  }

  /**
   * Récupérer les métriques de la queue des jobs
   */
  async getJobQueueMetrics(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } | null> {
    try {
      await this.ensureConnection();
      
      const [pending, processing, completed, failed] = await Promise.all([
        this.client.llen('jobs:pending'),
        this.client.llen('jobs:processing'),
        this.client.llen('jobs:completed'),
        this.client.llen('jobs:failed')
      ]);

      return { pending, processing, completed, failed };
    } catch (error) {
      console.log('Redis', 'Failed to get job queue metrics', error, 'system');
      return null;
    }
  }

  /**
   * Vérifier si un job spécifique existe dans une queue
   */
  async findJobInQueue(jobId: string, queueName: 'pending' | 'processing' | 'completed' | 'failed'): Promise<any | null> {
    try {
      await this.ensureConnection();
      
      const jobs = await this.client.lrange(`jobs:${queueName}`, 0, -1);
      
      for (const jobStr of jobs) {
        try {
          const job = JSON.parse(jobStr);
          if (job.id === jobId) {
            return job;
          }
        } catch (parseError) {
          // Ignorer les jobs malformés
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.log('Redis', 'Failed to find job in queue', error, 'system', {
        jobId,
        queueName
      });
      return null;
    }
  }

  /**
   * Nettoyer les anciens jobs terminés (maintenance)
   */
  async cleanupOldJobs(maxAgeHours: number = 24): Promise<boolean> {
    try {
      await this.ensureConnection();
      
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      let totalRemoved = 0;
      
      for (const queueName of ['jobs:completed', 'jobs:failed']) {
        const jobs = await this.client.lrange(queueName, 0, -1);
        
        for (const jobStr of jobs) {
          try {
            const job = JSON.parse(jobStr);
            const jobTime = new Date(job.completedAt || job.failedAt || job.enqueuedAt || 0).getTime();
            
            if (jobTime < cutoffTime) {
              await this.client.lrem(queueName, 1, jobStr);
              totalRemoved++;
            }
          } catch (parseError) {
            // Supprimer les jobs malformés
            await this.client.lrem(queueName, 1, jobStr);
            totalRemoved++;
          }
        }
      }
      
      if (totalRemoved > 0) {
        console.log('Redis', 'Cleaned up old jobs', `Removed ${totalRemoved} old jobs`, 'system', {
          removedCount: totalRemoved,
          maxAgeHours
        });
      }
      
      return true;
    } catch (error) {
      console.log('Redis', 'Failed to cleanup old jobs', error, 'system', { maxAgeHours });
      return false;
    }
  }

  // ===== MÉTHODES POUR LES MAPPINGS SOCIAUX =====

  /**
   * Accès direct au client Redis pour les opérations pipeline
   */
  get redisClient() {
    return this.client;
  }

  /**
   * Batch get pour les mappings sociaux
   */
  async batchGetSocialMappings(twitterIds: string[]): Promise<Map<string, { bluesky?: string; mastodon?: any }>> {
    try {
      await this.ensureConnection();
      
      const pipeline = this.client.pipeline();
      
      // Ajouter toutes les requêtes au pipeline
      for (const twitterId of twitterIds) {
        pipeline.get(`twitter_to_bluesky:${twitterId}`);
        pipeline.get(`twitter_to_mastodon:${twitterId}`);
      }
      
      const results = await pipeline.exec();
      const mappings = new Map();
      
      // Traiter les résultats
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
            console.log('Redis', 'Failed to parse Mastodon mapping', e, 'system', { twitterId });
          }
        }
        
        if (mapping.bluesky || mapping.mastodon) {
          mappings.set(twitterId, mapping);
        }
      }
      
      return mappings;
      
    } catch (error) {
      console.log('Redis', 'Batch get social mappings failed', error, 'system', { 
        twitterIdsCount: twitterIds.length 
      });
      throw error;
    }
  }

  /**
   * Batch set pour les mappings sociaux
   */
  async batchSetSocialMappings(mappings: Array<{
    twitter_id: string;
    platform: 'bluesky' | 'mastodon';
    data: any;
  }>): Promise<number> {
    try {
      await this.ensureConnection();
      
      const pipeline = this.client.pipeline();
      let setCount = 0;
      
      for (const mapping of mappings) {
        if (mapping.platform === 'bluesky') {
          const key = `twitter_to_bluesky:${mapping.twitter_id}`;
          pipeline.set(key, mapping.data.bluesky_username);
          setCount++;
          
        } else if (mapping.platform === 'mastodon') {
          const key = `twitter_to_mastodon:${mapping.twitter_id}`;
          const value = JSON.stringify({
            id: mapping.data.mastodon_id,
            username: mapping.data.mastodon_username,
            instance: mapping.data.mastodon_instance
          });
          pipeline.set(key, value);
          setCount++;
        }
      }
      
      if (setCount > 0) {
        await pipeline.exec();
      }
      
      return setCount;
      
    } catch (error) {
      console.log('Redis', 'Batch set social mappings failed', error, 'system', { 
        mappingsCount: mappings.length 
      });
      throw error;
    }
  }

  /**
   * Obtenir les statistiques des mappings sociaux
   */
  async getSocialMappingStats(): Promise<{ bluesky: number; mastodon: number; total: number }> {
    try {
      await this.ensureConnection();
      
      const blueskyKeys = await this.client.keys('twitter_to_bluesky:*');
      const mastodonKeys = await this.client.keys('twitter_to_mastodon:*');
      
      return {
        bluesky: blueskyKeys.length,
        mastodon: mastodonKeys.length,
        total: blueskyKeys.length + mastodonKeys.length
      };
      
    } catch (error) {
      console.log('Redis', 'Failed to get social mapping stats', error, 'system');
      return { bluesky: 0, mastodon: 0, total: 0 };
    }
  }

  /**
   * Supprimer un mapping social
   */
  async deleteSocialMapping(twitterId: string, platform?: 'bluesky' | 'mastodon'): Promise<number> {
    try {
      await this.ensureConnection();
      
      const keys = [];
      
      if (!platform || platform === 'bluesky') {
        keys.push(`twitter_to_bluesky:${twitterId}`);
      }
      
      if (!platform || platform === 'mastodon') {
        keys.push(`twitter_to_mastodon:${twitterId}`);
      }
      
      if (keys.length > 0) {
        return await this.client.del(...keys);
      }
      
      return 0;
      
    } catch (error) {
      console.log('Redis', 'Failed to delete social mapping', error, 'system', { 
        twitterId, 
        platform 
      });
      return 0;
    }
  }

  // Nettoyage des ressources
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      console.log('Redis', 'Redis client disconnected', 'Clean shutdown');
    } catch (error) {
      console.log('Redis', 'Error during Redis disconnect', error, 'system');
    }
  }

  // Exposer la méthode pipeline du client ioredis
  pipeline() {
    return this.client.pipeline();
  }

  // Exposer la méthode ping du client ioredis
  async ping(): Promise<string> {
    return await this.client.ping();
  }
  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  // Méthodes pour les queues de tâches
  async lpush(key: string, value: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.lpush(key, value);
    } catch (error) {
      console.log('Redis', 'Failed to lpush', error, 'system', { key });
      return 0;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    try {
      await this.ensureConnection();
      return await this.client.setex(key, seconds, value);
    } catch (error) {
      console.log('Redis', 'Failed to setex', error, 'system', { key, seconds });
      return 'ERROR';
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      await this.ensureConnection();
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      console.log('Redis', 'Failed to lrange', error, 'system', { key, start, stop });
      return [];
    }
  }

  async llen(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.llen(key);
    } catch (error) {
      console.log('Redis', 'Failed to llen', error, 'system', { key });
      return 0;
    }
  }

  // async del(...keys: string[]): Promise<number> {
  //   try {
  //     await this.ensureConnection();
  //     return await this.client.del(...keys);
  //   } catch (error) {
  //     console.log('Redis', 'Failed to del', error, 'system', { keys });
  //     return 0;
  //   }
  // }

  async lrem(key: string, count: number, value: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.lrem(key, count, value);
    } catch (error) {
      console.log('Redis', 'Failed to lrem', error, 'system', { key, count });
      return 0;
    }
  }
}

// Instance singleton
export const redis = new RedisClient();

// Export du client brut pour les cas avancés (avec précaution)
export const rawRedisClient = redis;

/**
 * Charger tous les mappings depuis PostgreSQL vers Redis au démarrage
 * Cette fonction est appelée une seule fois au démarrage du serveur
 */
export async function loadInitialMappingsToRedis(): Promise<void> {
  try {
    console.log('🔄 Loading initial mappings from PostgreSQL to Redis...');
    
    // Attendre que Redis soit prêt
    await redis.ensureConnection();

    // Vérifier si Redis contient déjà des mappings
    const existingBlueskyKeys = await redis.keys('twitter_to_bluesky:*');
    const existingMastodonKeys = await redis.keys('twitter_to_mastodon:*');
    
    if (existingBlueskyKeys.length > 0 || existingMastodonKeys.length > 0) {
      console.log(`📋 Redis already contains mappings: ${existingBlueskyKeys.length} Bluesky + ${existingMastodonKeys.length} Mastodon mappings`);
      console.log('⏭️ Skipping initial loading from PostgreSQL');
      return;
    }

    console.log('🔍 No existing mappings found in Redis, loading from PostgreSQL...');

    // 1. Charger les correspondances Bluesky avec pagination
    let blueskyTotal = 0;
    let blueskyPage = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: blueskyUsers, error: blueskyError } = await supabase
        .from('twitter_bluesky_users')
        .select('twitter_id, bluesky_username, bluesky_id')
        .range(blueskyPage * pageSize, (blueskyPage + 1) * pageSize - 1);

      if (blueskyError) {
        console.error('❌ Error loading Bluesky mappings:', blueskyError);
        break;
      }
      
      if (!blueskyUsers || blueskyUsers.length === 0) {
        break; // Plus de données
      }

      const blueskyPipeline = redis.pipeline();
      
      for (const user of blueskyUsers) {
        if (user.twitter_id && user.bluesky_username && user.bluesky_id) {
          const key = `twitter_to_bluesky:${user.twitter_id}`;
          const value = `${user.bluesky_username}|${user.bluesky_id}`;
          blueskyPipeline.set(key, value);
        }
      }
      
      await blueskyPipeline.exec();
      blueskyTotal += blueskyUsers.length;
      blueskyPage++;
      
      console.log(`✅ Loaded page ${blueskyPage}: ${blueskyUsers.length} Bluesky mappings (total: ${blueskyTotal})`);
      
      if (blueskyUsers.length < pageSize) {
        break; // Dernière page
      }
    }

    // 2. Charger les correspondances Mastodon avec pagination
    let mastodonTotal = 0;
    let mastodonPage = 0;
    
    while (true) {
      const { data: mastodonUsers, error: mastodonError } = await supabase
        .from('twitter_mastodon_users')
        .select('twitter_id, mastodon_id, mastodon_username, mastodon_instance')
        .range(mastodonPage * pageSize, (mastodonPage + 1) * pageSize - 1);

      if (mastodonError) {
        console.error('❌ Error loading Mastodon mappings:', mastodonError);
        break;
      }
      
      if (!mastodonUsers || mastodonUsers.length === 0) {
        break; // Plus de données
      }

      const mastodonPipeline = redis.pipeline();
      
      for (const user of mastodonUsers) {
        if (user.twitter_id && user.mastodon_id && user.mastodon_username && user.mastodon_instance) {
          const key = `twitter_to_mastodon:${user.twitter_id}`;
          const value = `${user.mastodon_id}|${user.mastodon_username}|${user.mastodon_instance}`;
          mastodonPipeline.set(key, value);
        }
      }
      
      await mastodonPipeline.exec();
      mastodonTotal += mastodonUsers.length;
      mastodonPage++;
      
      console.log(`✅ Loaded page ${mastodonPage}: ${mastodonUsers.length} Mastodon mappings (total: ${mastodonTotal})`);
      
      if (mastodonUsers.length < pageSize) {
        break; // Dernière page
      }
    }

    console.log(`🎉 Initial mappings loading completed successfully! Total: ${blueskyTotal} Bluesky + ${mastodonTotal} Mastodon mappings`);

  } catch (error) {
    console.error('❌ Failed to load initial mappings to Redis:', error);
    // Ne pas faire échouer le démarrage du serveur si Redis n'est pas disponible
    // Le fallback SQL fonctionnera toujours
  }
}

// NE PAS charger automatiquement les mappings au démarrage du module
// Cette fonction doit être appelée explicitement au démarrage du serveur
// loadInitialMappingsToRedis();

export default redis;

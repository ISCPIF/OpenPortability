import Redis from 'ioredis';
import logger from './log_utils';

// ============================================================================
// SINGLETON PATTERN POUR NEXT.JS
// ============================================================================
// En Next.js, les modules peuvent être rechargés (hot reload en dev, ou 
// différentes invocations serverless en prod). Sans globalThis, chaque reload
// crée une NOUVELLE connexion Redis sans fermer l'ancienne → accumulation de
// connexions → logs "Connected to Redis" répétés → overhead serveur.
//
// globalThis persiste entre les reloads du module.
// ============================================================================

// Déclaration du type global pour TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __redisClient: RedisClient | undefined
}

// Configuration Redis sécurisée et optimisée
const redisConfig = {
  host: process.env.REDIS_HOST || 'openportability_redis',
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
  // Enable TCP keep-alive with an initial delay (ms)
  keepAlive: 10000,
  
  // Timeouts plus longs pour éviter les déconnexions
  maxLoadingTimeout: 10000, // 10s au lieu de 5s
  
  // Nouvelles options pour stabilité
  reconnectOnError: (err: Error) => {
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
      logger.logInfo('Redis', 'Connected to Redis server', 'Connection established');
      // Ne pas mettre isConnected = true ici !
    });
    
    this.client.on('ready', () => {
      logger.logInfo('Redis', 'Redis client ready', 'Client ready for operations');
      this.isConnected = true; // ← Déplacer ici !
    });
    
    this.client.on('error', (error: any) => {
      logger.logError('Redis', 'Redis connection error', error, 'system');
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.logInfo('Redis', 'Redis connection closed', 'Connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.logInfo('Redis', 'Reconnecting to Redis', 'Attempting reconnection');
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to get key', errorString, 'system', { key });
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to set key', errorString, 'system', { key, ttlSeconds });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to delete key', errorString, 'system', { key });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to check key existence', errorString, 'system', { key });
      return false;
    }
  }

  // ===== Set helpers =====
  async sadd(key: string, members: string[] | string): Promise<number> {
    try {
      await this.ensureConnection();
      const args = Array.isArray(members) ? members : [members];
      return await this.client.sadd(key, ...args);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to SADD', errorString, 'system', { key, membersCount: Array.isArray(members) ? members.length : 1 });
      return 0;
    }
  }

  async srem(key: string, members: string[] | string): Promise<number> {
    try {
      await this.ensureConnection();
      const args = Array.isArray(members) ? members : [members];
      return await this.client.srem(key, ...args);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to SREM', errorString, 'system', { key, membersCount: Array.isArray(members) ? members.length : 1 });
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      await this.ensureConnection();
      return await this.client.smembers(key);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to SMEMBERS', errorString, 'system', { key });
      return [];
    }
  }

  async scard(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.scard(key);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to SCARD', errorString, 'system', { key });
      return 0;
    }
  }

  async sunion(keys: string[]): Promise<string[]> {
    try {
      await this.ensureConnection();
      if (keys.length === 0) return [];
      return await this.client.sunion(...keys);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to SUNION', errorString, 'system', { keysCount: keys.length });
      return [];
    }
  }

  async incr(key: string): Promise<number | null> {
    try {
      await this.ensureConnection();
      return await this.client.incr(key);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to increment key', errorString, 'system', { key });
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error); 
      logger.logError('Redis', 'Failed to set expiration', errorString, 'system', { key, seconds });
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Rate limit check failed', errorString, 'system', { key, limit, windowSeconds });
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Redis health check failed', errorString, 'system');
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


      return true;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to enqueue job', errorString, 'system', {
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to get job queue metrics', errorString, 'system');
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to find job in queue', errorString, 'system', {
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
    
      
      return true;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to cleanup old jobs', errorString, 'system', { maxAgeHours });
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
          const raw = blueskyResult[1] as string;
          // Support formats:
          // - JSON string: {"username":"...","id":"..."}
          // - Pipe format: "username|id"
          // - Legacy handle: "fondationshoah.bsky.social"
          let normalized: string | null = null;
          if (raw && raw.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(raw);
              normalized = parsed?.username ?? null;
            } catch {
              normalized = null;
            }
          } else if (raw.includes('|')) {
            const [username] = raw.split('|');
            normalized = username || null;
          } else {
            normalized = raw || null;
          }
          if (normalized) {
            mapping.bluesky = normalized;
          }
        }
        
        if (mastodonResult && mastodonResult[1]) {
          try {
            mapping.mastodon = JSON.parse(mastodonResult[1] as string);
          } catch (e) {
            const errorString = e instanceof Error ? e.message : String(e);
            logger.logError('Redis', 'Failed to parse Mastodon mapping', errorString, 'system', { twitterId });
          }
        }
        
        if (mapping.bluesky || mapping.mastodon) {
          mappings.set(twitterId, mapping);
        }
      }
      
      return mappings;
      
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Batch get social mappings failed', errorString, 'system', { 
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Batch set social mappings failed', errorString, 'system', { 
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to get social mapping stats', errorString, 'system');
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to delete social mapping', errorString, 'system', { 
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
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Error during Redis disconnect', errorString, 'system');
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to lpush', errorString, 'system', { key });
      return 0;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    try {
      await this.ensureConnection();
      return await this.client.setex(key, seconds, value);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to setex', errorString, 'system', { key, seconds });
      return 'ERROR';
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      await this.ensureConnection();
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to lrange', errorString, 'system', { key, start, stop });
      return [];
    }
  }

  async llen(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.llen(key);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to llen', errorString, 'system', { key });
      return 0;
    }
  }


  async lrem(key: string, count: number, value: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.lrem(key, count, value);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to lrem', errorString, 'system', { key, count });
      return 0;
    }
  }

  // ===== SSE Pub/Sub Methods =====
  
  /**
   * Publish a message to a Redis channel for SSE broadcasting
   * @param channel - The channel name (e.g., 'sse:graph:updates')
   * @param message - The message to publish (will be JSON stringified if object)
   */
  async publish(channel: string, message: string | object): Promise<number> {
    try {
      await this.ensureConnection();
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.client.publish(channel, messageStr);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to publish', errorString, 'system', { channel });
      return 0;
    }
  }

  /**
   * Create a new Redis client for subscribing to channels.
   * IMPORTANT: ioredis requires a dedicated client for subscriptions
   * because the client enters "subscriber mode" and can't execute other commands.
   * The caller is responsible for managing the lifecycle of this client.
   */
  createSubscriber(): Redis {
    return new Redis(redisConfig);
  }

  /**
   * Get multiple keys at once (for cache version checking)
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    try {
      await this.ensureConnection();
      return await this.client.mget(...keys);
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Redis', 'Failed to mget', errorString, 'system', { keysCount: keys.length });
      return keys.map(() => null);
    }
  }
}

// Fonction pour obtenir le singleton Redis via globalThis
function getRedisClient(): RedisClient {
  if (!globalThis.__redisClient) {
    logger.logInfo('Redis', 'Creating Redis singleton', 'New RedisClient instance created via globalThis');
    globalThis.__redisClient = new RedisClient();
  }
  return globalThis.__redisClient;
}

// Export du singleton via getter (pour compatibilité avec le code existant)
export const redis = new Proxy({} as RedisClient, {
  get(_, prop) {
    const client = getRedisClient();
    const value = (client as any)[prop];
    // Bind les méthodes au client pour conserver le contexte
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Export du client brut pour les cas avancés (avec précaution)
export const rawRedisClient = redis;

// NE PAS charger automatiquement les mappings au démarrage du module
// Cette fonction doit être appelée explicitement au démarrage du serveur
// loadInitialMappingsToRedis();

export default redis;

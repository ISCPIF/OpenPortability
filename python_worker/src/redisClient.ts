import Redis from 'ioredis';

interface SocialMapping {
  bluesky?: string;
  mastodon?: {
    id: string;
    username: string;
    instance: string;
  };
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  connectTimeout?: number;
  maxLoadingTimeout?: number;
}

class RedisClientManager {
  private static instance: RedisClientManager;
  private redis: Redis;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;

  private constructor() {
    const config: RedisConfig = {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 30000,
      maxLoadingTimeout: 10000
    };

    this.redis = new Redis(config);
    this.setupEventHandlers();
  }

  public static getInstance(): RedisClientManager {
    if (!RedisClientManager.instance) {
      RedisClientManager.instance = new RedisClientManager();
    }
    return RedisClientManager.instance;
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      this.isConnecting = false;
      console.log('✅ Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      this.isConnecting = false;
      console.log('❌ Redis connection error:', error instanceof Error ? error.message : String(error));
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.isConnecting = false;
      console.log('⚠️ Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.isConnecting = true;
      console.log('🔄 Attempting to reconnect to Redis');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.isConnecting = false;
      console.log('🚀 Redis client ready');
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    try {
      this.isConnecting = true;
      await this.redis.connect();
      console.log('✅ Redis client connected successfully');
    } catch (error: unknown) {
      this.isConnected = false;
      this.isConnecting = false;
      console.log('❌ Failed to connect to Redis:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.disconnect();
        this.isConnected = false;
        this.isConnecting = false;
        console.log('👋 Redis client disconnected');
      }
    } catch (error: unknown) {
      console.log('⚠️ Error disconnecting from Redis:', error instanceof Error ? error.message : String(error));
    }
  }

  public getClient(): Redis {
    return this.redis;
  }

  public isRedisConnected(): boolean {
    return this.isConnected && this.redis.status === 'ready';
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error: unknown) {
      console.log('❌ Redis health check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  public async ensureConnection(): Promise<void> {
    if (!this.isRedisConnected() && !this.isConnecting) {
      await this.connect();
    }
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!this.isRedisConnected() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.isRedisConnected()) {
      throw new Error('Failed to establish Redis connection within timeout');
    }
  }

  public async brpop(queueKey: string, timeoutSeconds: number): Promise<[string, string] | null> {
    try {
      await this.ensureConnection();
      const result = await this.redis.brpop(queueKey, timeoutSeconds);
      return result;
    } catch (error: unknown) {
      console.log(`❌ [Redis] BRPOP error on ${queueKey}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  public async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      await this.ensureConnection();
      return await this.redis.lrange(key, start, stop);
    } catch (error: unknown) {
      console.log(`❌ [Redis] LRANGE error on ${key}:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  public async llen(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.redis.llen(key);
    } catch (error: unknown) {
      console.log(`❌ [Redis] LLEN error on ${key}:`, error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  public async lrem(key: string, count: number, value: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.redis.lrem(key, count, value);
    } catch (error: unknown) {
      console.log(`❌ [Redis] LREM error on ${key}:`, error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  public async lpush(key: string, value: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.redis.lpush(key, value);
    } catch (error: unknown) {
      console.log(`❌ [Redis] LPUSH error on ${key}:`, error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    try {
      await this.ensureConnection();
      return await this.redis.keys(pattern);
    } catch (error: unknown) {
      console.log(`❌ [Redis] KEYS error with pattern ${pattern}:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      await this.ensureConnection();
      return await this.redis.get(key);
    } catch (error: unknown) {
      console.log(`❌ [Redis] GET error on ${key}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, value);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (error: unknown) {
      console.log(`❌ [Redis] SET error on ${key}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  public async batchGetSocialMappings(twitterIds: string[]): Promise<Map<string, SocialMapping>> {
    try {
      await this.ensureConnection();
      
      if (twitterIds.length === 0) {
        return new Map();
      }

      const pipeline = this.redis.pipeline();
      const mappings = new Map<string, SocialMapping>();

      // Ajouter toutes les clés au pipeline
      twitterIds.forEach(twitterId => {
        pipeline.get(`twitter_to_bluesky:${twitterId}`);
        pipeline.get(`twitter_to_mastodon:${twitterId}`);
      });

      const results = await pipeline.exec();
      
      if (!results) {
        return mappings;
      }

      // Parser les résultats (2 résultats par twitterId)
      for (let i = 0; i < twitterIds.length; i++) {
        const twitterId = twitterIds[i];
        const blueskyResult = results[i * 2];
        const mastodonResult = results[i * 2 + 1];

        const mapping: SocialMapping = {};

        // Parser Bluesky (format: string simple)
        if (blueskyResult && blueskyResult[1]) {
          mapping.bluesky = blueskyResult[1] as string;
        }

        // Parser Mastodon (format: JSON)
        if (mastodonResult && mastodonResult[1]) {
          try {
            mapping.mastodon = JSON.parse(mastodonResult[1] as string);
          } catch (parseError: unknown) {
            console.warn(`⚠️ [Redis] Failed to parse Mastodon mapping for ${twitterId}`);
          }
        }

        // Ajouter à la map seulement si au moins une correspondance existe
        if (mapping.bluesky || mapping.mastodon) {
          mappings.set(twitterId, mapping);
        }
      }

      return mappings;

    } catch (error: unknown) {
      console.log('❌ [Redis] batchGetSocialMappings error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// Export singleton instance
export const redisClient = RedisClientManager.getInstance();
export default redisClient;

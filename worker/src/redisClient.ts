// worker/src/redisClient.ts
import Redis from 'ioredis';
// import logger from './log_utils';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

export class RedisClientManager {
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
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
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
      console.log('❌ Redis connection error:', error.message);
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
    // Si déjà connecté ou en cours de connexion, ne rien faire
    if (this.isConnected || this.isConnecting) {
      return;
    }

    try {
      this.isConnecting = true;
      await this.redis.connect();
      console.log('✅ Redis client connected successfully');
    } catch (error) {
      this.isConnected = false;
      this.isConnecting = false;
      console.log('❌ Failed to connect to Redis:', error instanceof Error ? error.message : 'Unknown error');
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
    } catch (error) {
      console.log('⚠️ Error disconnecting from Redis:', error instanceof Error ? error.message : 'Unknown error');
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
    } catch (error) {
      console.log('❌ Redis health check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  public async ensureConnection(): Promise<void> {
    if (!this.isRedisConnected() && !this.isConnecting) {
      await this.connect();
    }
    
    // Attendre que la connexion soit établie
    let attempts = 0;
    const maxAttempts = 30; // 3 secondes max
    
    while (!this.isRedisConnected() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.isRedisConnected()) {
      throw new Error('Failed to establish Redis connection within timeout');
    }
  }
}

// Export singleton instance
export const redisClient = RedisClientManager.getInstance();

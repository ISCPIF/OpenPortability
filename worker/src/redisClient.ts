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
      host: process.env.REDIS_HOST || 'openportability_redis',
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

// SSE Channel name (must match the Next.js app)
const SSE_CHANNEL = 'sse:graph:updates';

/**
 * Publish an SSE event to notify connected clients about job progress.
 * This allows real-time updates instead of polling.
 */
export async function publishJobSSEEvent(
  jobId: string,
  userId: string,
  status: string,
  stats: RedisJobStats,
  meta?: RedisJobMeta
): Promise<boolean> {
  try {
    await redisClient.ensureConnection();
    const redis = redisClient.getClient();
    
    const event = {
      type: 'importJob',
      data: {
        jobId,
        status,
        progress: stats.processed,
        totalItems: stats.total,
        stats,
        phase: meta?.phase,
        phase_progress: meta?.phase_progress,
        nodes_total: meta?.nodes_total,
        nodes_processed: meta?.nodes_processed,
        edges_total: meta?.edges_total,
        edges_processed: meta?.edges_processed,
      },
      userId, // Target specific user
      timestamp: Date.now(),
    };
    
    const result = await redis.publish(SSE_CHANNEL, JSON.stringify(event));
    
    if (result > 0) {
      console.log(`📡 [SSE] Published importJob event for job ${jobId} (${result} subscribers)`);
    }
    
    return result > 0;
  } catch (error) {
    console.log(`⚠️ [SSE] Failed to publish importJob event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// Job stats interface matching the API format
export interface RedisJobStats {
  total: number;
  progress: number;
  followers: number;    // ← nombre simple (processed count)
  following: number;    // ← nombre simple (processed count)
  processed: number;
}

// Optional Redis-only metadata to drive frontend visual phases
export type RedisJobPhase = 'pending' | 'nodes' | 'edges' | 'completed' | 'failed';

export interface RedisJobMeta {
  phase?: RedisJobPhase;
  phase_progress?: number; // 0-100 for current phase
  nodes_total?: number;
  nodes_processed?: number;
  edges_total?: number;
  edges_processed?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed'; // Job status for SSE
}

// Function to update job stats in Redis and publish SSE event
export async function updateJobStats(
  jobId: string,
  stats: RedisJobStats,
  workerId?: string,
  meta?: RedisJobMeta
): Promise<{ success: boolean; error?: string }> {
  try {
    await redisClient.ensureConnection();
    const redis = redisClient.getClient();
    
    const jobKey = `job:${jobId}`;
    
    // Get existing job data
    const existingJobData = await redis.get(jobKey);
    let jobData: any = {};
    
    if (existingJobData) {
      try {
        jobData = JSON.parse(existingJobData);
      } catch (parseError) {
        console.log(`[Worker ${workerId || 'unknown'}] ⚠️ Failed to parse existing job data, creating new`);
      }
    }
    
    // Update stats
    jobData.stats = stats;
    // Merge optional phase/meta fields without breaking older readers
    if (meta && typeof meta === 'object') {
      // Extract status separately to update jobData.status
      const { status: metaStatus, ...restMeta } = meta;
      if (metaStatus) {
        jobData.status = metaStatus;
      }
      jobData = { ...jobData, ...restMeta };
    }
    jobData.updated_at = new Date().toISOString();
    
    // Save back to Redis with TTL of 24 hours
    await redis.setex(jobKey, 86400, JSON.stringify(jobData));
    
    if (workerId) {
      console.log(`[Worker ${workerId}] 📊 Updated job stats: ${stats.processed}/${stats.total} (${Math.round((stats.processed/stats.total)*100)}%)`);
    }

    // Publish SSE event to notify connected clients in real-time
    // Only publish if we have a user_id to target
    if (jobData.user_id) {
      await publishJobSSEEvent(
        jobId,
        jobData.user_id,
        jobData.status || 'processing',
        stats,
        meta
      );
    }
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';
    if (workerId) {
      console.log(`[Worker ${workerId}] ❌ Failed to update job stats: ${errorMessage}`);
    }
    return { success: false, error: errorMessage };
  }
}

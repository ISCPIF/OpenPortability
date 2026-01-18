import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Client, Notification } from 'pg';
import Redis from 'ioredis';
import { once } from 'events';

// Type for Redis message handler
type RedisMessageHandler = (channel: string, message: string) => void;

/**
 * Integration Tests: PostgreSQL NOTIFY → Redis → SSE Pipeline
 * 
 * These tests verify the complete flow:
 * 1. PostgreSQL trigger fires pg_notify
 * 2. Node.js listener receives notification
 * 3. Event is published to Redis
 * 4. SSE clients receive the update
 * 
 * Prerequisites:
 * - PostgreSQL running with the updated trigger
 * - Redis running
 * - POSTGRES_DIRECT_PORT env var set (default: 5432)
 */

// Direct PostgreSQL connection config (bypassing PgBouncer)
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_DIRECT_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'nexus',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
};

// Redis config
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
};

const SSE_CHANNEL = 'sse:graph:updates';

describe('PostgreSQL NOTIFY → Redis → SSE Integration', () => {
  let pgClient: Client;
  let pgListener: Client;
  let redisSubscriber: Redis;
  let redisPublisher: Redis;

  async function waitForRedisReady(client: Redis, name: string) {
    if ((client as any).status === 'ready') return;
    try {
      await once(client, 'ready');
    } catch (error) {
      throw new Error(`Redis client ${name} failed to become ready: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  beforeAll(async () => {
    // Create PostgreSQL clients
    pgClient = new Client(pgConfig);
    pgListener = new Client(pgConfig);
    
    // Create Redis clients
    // NOTE: Redis is password-protected in this environment.
    // Ensure REDIS_PASSWORD is set, otherwise tests will fail with NOAUTH.
    redisSubscriber = new Redis(redisConfig);
    redisPublisher = new Redis(redisConfig);

    // Avoid unhandled ioredis error events that crash vitest.
    redisSubscriber.on('error', (err: Error) => {
      // keep as console.* because logger isn't available in tests by default
      console.error('[Redis subscriber error]', err.message);
    });
    redisPublisher.on('error', (err: Error) => {
      console.error('[Redis publisher error]', err.message);
    });

    // Connect all clients
    await Promise.all([
      pgClient.connect(),
      pgListener.connect(),
    ]);

    await Promise.all([
      waitForRedisReady(redisSubscriber, 'subscriber'),
      waitForRedisReady(redisPublisher, 'publisher'),
    ]);

    console.log('✅ All clients connected');
  });

  afterAll(async () => {
    // Cleanup
    await pgClient?.end();
    await pgListener?.end();
    await redisSubscriber?.quit();
    await redisPublisher?.quit();
  });

  describe('PostgreSQL pg_notify', () => {
    it('should send and receive NOTIFY on cache_invalidation channel', async () => {
      const receivedNotifications: any[] = [];
      
      // Setup listener
      pgListener.on('notification', (msg: Notification) => {
        receivedNotifications.push(msg);
      });
      
      await pgListener.query('LISTEN cache_invalidation');

      // Send test notification
      const testPayload = {
        operation: 'TEST',
        twitter_id: '123456789',
        consent_level: 'full',
        user_id: 'test-uuid-1234',
        timestamp: Date.now() / 1000,
      };

      await pgClient.query(
        `NOTIFY cache_invalidation, '${JSON.stringify(testPayload).replace(/'/g, "''")}'`
      );

      // Wait for notification
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedNotifications.length).toBeGreaterThan(0);
      expect(receivedNotifications[0].channel).toBe('cache_invalidation');
      
      const payload = JSON.parse(receivedNotifications[0].payload);
      expect(payload.operation).toBe('TEST');
      expect(payload.twitter_id).toBe('123456789');
    });

    it('should handle JSON payloads with special characters', async () => {
      const receivedNotifications: any[] = [];
      
      pgListener.removeAllListeners('notification');
      pgListener.on('notification', (msg: Notification) => {
        receivedNotifications.push(msg);
      });

      // Payload with special characters
      const testPayload = {
        operation: 'UPDATE',
        twitter_id: '987654321',
        consent_level: "user's \"special\" name",
        user_id: 'uuid-with-dashes',
        timestamp: Date.now() / 1000,
      };

      // Escape single quotes for PostgreSQL
      const escapedPayload = JSON.stringify(testPayload).replace(/'/g, "''");
      await pgClient.query(`NOTIFY cache_invalidation, '${escapedPayload}'`);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedNotifications.length).toBeGreaterThan(0);
      const payload = JSON.parse(receivedNotifications[0].payload);
      expect(payload.consent_level).toBe("user's \"special\" name");
    });
  });

  describe('Redis Pub/Sub', () => {
    it('should publish and receive messages on SSE channel', async () => {
      const receivedMessages: any[] = [];

      // Subscribe to SSE channel
      await redisSubscriber.subscribe(SSE_CHANNEL);
      
      redisSubscriber.on('message', ((channel: string, message: string) => {
        if (channel === SSE_CHANNEL) {
          receivedMessages.push(JSON.parse(message));
        }
      }) as RedisMessageHandler);

      // Publish test event
      const testEvent = {
        type: 'labels',
        data: {
          incremental: true,
          change: {
            twitter_id: '123456789',
            action: 'add',
            consent_level: 'full',
          },
        },
        userId: null,
        timestamp: Date.now(),
      };

      await redisPublisher.publish(SSE_CHANNEL, JSON.stringify(testEvent));

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages.length).toBeGreaterThan(0);
      expect(receivedMessages[0].type).toBe('labels');
      expect(receivedMessages[0].data.incremental).toBe(true);
    });

    it('should handle multiple event types', async () => {
      const receivedMessages: any[] = [];

      redisSubscriber.removeAllListeners('message');
      redisSubscriber.on('message', ((channel: string, message: string) => {
        if (channel === SSE_CHANNEL) {
          receivedMessages.push(JSON.parse(message));
        }
      }) as RedisMessageHandler);

      // Publish different event types
      const events = [
        { type: 'labels', data: { version: 1 }, userId: null, timestamp: Date.now() },
        { type: 'nodeTypes', data: { changes: [] }, userId: null, timestamp: Date.now() },
        { type: 'stats:global', data: { users: 100 }, userId: null, timestamp: Date.now() },
      ];

      for (const event of events) {
        await redisPublisher.publish(SSE_CHANNEL, JSON.stringify(event));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(receivedMessages.length).toBe(3);
      expect(receivedMessages.map(m => m.type)).toEqual(['labels', 'nodeTypes', 'stats:global']);
    });
  });

  describe('End-to-End Flow Simulation', () => {
    it('should simulate complete pg_notify → Redis flow', async () => {
      const pgNotifications: any[] = [];
      const redisMessages: any[] = [];

      // Setup PostgreSQL listener
      pgListener.removeAllListeners('notification');
      pgListener.on('notification', async (msg: Notification) => {
        pgNotifications.push(msg);
        
        // Simulate what pg-notify-listener.ts does
        if (msg.channel === 'cache_invalidation' && msg.payload) {
          const payload = JSON.parse(msg.payload);
          
          // Forward to Redis (simulating the listener behavior)
          const sseEvent = {
            type: 'labels',
            data: {
              incremental: true,
              change: {
                twitter_id: payload.twitter_id,
                action: payload.operation === 'DELETE' ? 'remove' : 'add',
                consent_level: payload.consent_level,
              },
            },
            userId: null,
            timestamp: payload.timestamp * 1000,
          };
          
          await redisPublisher.publish(SSE_CHANNEL, JSON.stringify(sseEvent));
        }
      });

      // Setup Redis subscriber
      redisSubscriber.removeAllListeners('message');
      await redisSubscriber.subscribe(SSE_CHANNEL);
      redisSubscriber.on('message', ((channel: string, message: string) => {
        if (channel === SSE_CHANNEL) {
          redisMessages.push(JSON.parse(message));
        }
      }) as RedisMessageHandler);

      // Trigger the flow with a pg_notify
      const testPayload = {
        operation: 'INSERT',
        twitter_id: '555555555',
        consent_level: 'partial',
        user_id: 'e2e-test-uuid',
        timestamp: Date.now() / 1000,
      };

      await pgClient.query(
        `NOTIFY cache_invalidation, '${JSON.stringify(testPayload).replace(/'/g, "''")}'`
      );

      // Wait for the complete flow
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify PostgreSQL notification was received
      expect(pgNotifications.length).toBe(1);
      expect(pgNotifications[0].channel).toBe('cache_invalidation');

      // Verify Redis message was published
      expect(redisMessages.length).toBe(1);
      expect(redisMessages[0].type).toBe('labels');
      expect(redisMessages[0].data.change.twitter_id).toBe('555555555');
      expect(redisMessages[0].data.change.action).toBe('add');
    });

    it('should handle DELETE operations correctly', async () => {
      const redisMessages: any[] = [];

      pgListener.removeAllListeners('notification');
      pgListener.on('notification', async (msg: Notification) => {
        if (msg.channel === 'cache_invalidation' && msg.payload) {
          const payload = JSON.parse(msg.payload);
          
          const sseEvent = {
            type: 'labels',
            data: {
              incremental: true,
              change: {
                twitter_id: payload.twitter_id,
                action: payload.operation === 'DELETE' ? 'remove' : 'add',
              },
            },
            userId: null,
            timestamp: Date.now(),
          };
          
          await redisPublisher.publish(SSE_CHANNEL, JSON.stringify(sseEvent));
        }
      });

      redisSubscriber.removeAllListeners('message');
      redisSubscriber.on('message', ((channel: string, message: string) => {
        if (channel === SSE_CHANNEL) {
          redisMessages.push(JSON.parse(message));
        }
      }) as RedisMessageHandler);

      // Simulate DELETE operation
      const deletePayload = {
        operation: 'DELETE',
        twitter_id: '999999999',
        consent_level: null,
        user_id: 'delete-test-uuid',
        timestamp: Date.now() / 1000,
      };

      await pgClient.query(
        `NOTIFY cache_invalidation, '${JSON.stringify(deletePayload).replace(/'/g, "''")}'`
      );

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(redisMessages.length).toBe(1);
      expect(redisMessages[0].data.change.action).toBe('remove');
    });
  });

  describe('Performance', () => {
    it('should handle rapid notifications', async () => {
      const receivedCount = { pg: 0, redis: 0 };
      const BATCH_SIZE = 50;

      pgListener.removeAllListeners('notification');
      pgListener.on('notification', async (msg: Notification) => {
        receivedCount.pg++;
        if (msg.payload) {
          await redisPublisher.publish(SSE_CHANNEL, JSON.stringify({
            type: 'labels',
            data: JSON.parse(msg.payload),
            timestamp: Date.now(),
          }));
        }
      });

      redisSubscriber.removeAllListeners('message');
      redisSubscriber.on('message', (() => {
        receivedCount.redis++;
      }) as RedisMessageHandler);

      // Send batch of notifications
      const startTime = Date.now();
      
      for (let i = 0; i < BATCH_SIZE; i++) {
        const payload = {
          operation: 'UPDATE',
          twitter_id: `batch-${i}`,
          consent_level: 'full',
          user_id: `batch-user-${i}`,
          timestamp: Date.now() / 1000,
        };
        
        await pgClient.query(
          `NOTIFY cache_invalidation, '${JSON.stringify(payload).replace(/'/g, "''")}'`
        );
      }

      // Wait for all to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      const duration = Date.now() - startTime;

      console.log(`📊 Performance: ${BATCH_SIZE} notifications in ${duration}ms`);
      console.log(`   PostgreSQL received: ${receivedCount.pg}`);
      console.log(`   Redis received: ${receivedCount.redis}`);

      expect(receivedCount.pg).toBe(BATCH_SIZE);
      expect(receivedCount.redis).toBe(BATCH_SIZE);
    });
  });
});

describe('Trigger Integration (requires migration applied)', () => {
  let pgClient: Client;

  beforeAll(async () => {
    pgClient = new Client(pgConfig);
    await pgClient.connect();
  });

  afterAll(async () => {
    await pgClient?.end();
  });

  it('should verify trigger function exists', async () => {
    const result = await pgClient.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'sync_member_node_on_consent_change'
    `);

    expect(result.rows.length).toBe(1);
    
    // Check if pg_notify is in the function source
    const functionSource = result.rows[0].prosrc;
    expect(functionSource).toContain('pg_notify');
  });

  it('should verify trigger is attached to users_with_name_consent', async () => {
    const result = await pgClient.query(`
      SELECT tgname, tgtype 
      FROM pg_trigger 
      WHERE tgrelid = 'users_with_name_consent'::regclass
      AND tgname = 'sync_member_node_trigger'
    `);

    expect(result.rows.length).toBe(1);
  });
});

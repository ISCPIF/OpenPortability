import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import Redis from 'ioredis';
import { once } from 'events';
import {
  startPgNotifyListener,
  stopPgNotifyListener,
  isPgNotifyListenerRunning,
} from '@/lib/pg-notify-listener';

const pgDirectConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_DIRECT_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'nexus',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
};

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
};

async function waitForRedisReady(client: Redis) {
  if ((client as any).status === 'ready') return;
  await once(client, 'ready');
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForCondition(fn: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

describe('Sync users → Redis mappings (pg_notify → Node listener → Redis)', () => {
  let pg: Client;
  let redis: Redis;

  const testUserId = `00000000-0000-0000-0000-${String(Date.now()).slice(-12).padStart(12, '0')}`;
  const twitterId = String(900000000000 + (Date.now() % 100000000000));

  beforeAll(async () => {
    if (!process.env.REDIS_PASSWORD) {
      throw new Error('REDIS_PASSWORD must be set to run this integration test');
    }

    pg = new Client(pgDirectConfig);
    await pg.connect();

    redis = new Redis(redisConfig);
    redis.on('error', (err: Error) => {
      console.error('[Redis error]', err.message);
    });
    await waitForRedisReady(redis);

    await startPgNotifyListener();

    if (!isPgNotifyListenerRunning()) {
      throw new Error('PgNotify listener did not start');
    }

    // Ensure clean keys
    await redis.del(`twitter_to_bluesky:${twitterId}`);
    await redis.del(`twitter_to_mastodon:${twitterId}`);

    // Create user with required fields
    await pg.query(
      `INSERT INTO "next-auth".users (id, name, created_at, updated_at, has_onboarded, hqx_newsletter, oep_accepted, research_accepted, have_seen_newsletter, automatic_reconnect, twitter_id, twitter_username)
       VALUES ($1, $2, now(), now(), false, false, false, false, false, false, $3::bigint, $4)
       ON CONFLICT (id) DO NOTHING`,
      [testUserId, 'test-sync-redis-mapping', twitterId, `test_${twitterId}`]
    );
  });

  afterAll(async () => {
    await stopPgNotifyListener();

    try {
      await pg.query('DELETE FROM "next-auth".users WHERE id = $1', [testUserId]);
    } catch {
      // ignore
    }

    await pg.end();
    await redis.quit();
  });

  it('should upsert/delete bluesky mapping in Redis when next-auth.users changes', async () => {
    const key = `twitter_to_bluesky:${twitterId}`;

    // Set bluesky fields (should upsert)
    await pg.query(
      `UPDATE "next-auth".users
       SET bluesky_id = $2, bluesky_username = $3, updated_at = now()
       WHERE id = $1`,
      [testUserId, `did:plc:${twitterId}`, `bsky_${twitterId}`]
    );

    await waitForCondition(async () => {
      const val = await redis.get(key);
      return val === `bsky_${twitterId}`;
    }, 8000, 200);

    // Clear bluesky_id (should delete)
    await pg.query(
      `UPDATE "next-auth".users
       SET bluesky_id = NULL, bluesky_username = NULL, updated_at = now()
       WHERE id = $1`,
      [testUserId]
    );

    await waitForCondition(async () => {
      const val = await redis.get(key);
      return val === null;
    }, 8000, 200);
  }, 20000);

  it('should upsert/delete mastodon mapping in Redis when next-auth.users changes', async () => {
    const key = `twitter_to_mastodon:${twitterId}`;

    // Set mastodon fields (should upsert)
    await pg.query(
      `UPDATE "next-auth".users
       SET mastodon_id = $2, mastodon_username = $3, mastodon_instance = $4, updated_at = now()
       WHERE id = $1`,
      [testUserId, `mastodon_${twitterId}`, `m_${twitterId}`, 'example.social']
    );

    await waitForCondition(async () => {
      const val = await redis.get(key);
      if (!val) return false;
      try {
        const parsed = JSON.parse(val);
        return parsed?.id === `mastodon_${twitterId}` && parsed?.username === `m_${twitterId}` && parsed?.instance === 'example.social';
      } catch {
        return false;
      }
    }, 8000, 200);

    // Clear mastodon_id (should delete)
    await pg.query(
      `UPDATE "next-auth".users
       SET mastodon_id = NULL, mastodon_username = NULL, mastodon_instance = NULL, updated_at = now()
       WHERE id = $1`,
      [testUserId]
    );

    await waitForCondition(async () => {
      const val = await redis.get(key);
      return val === null;
    }, 8000, 200);
  }, 20000);

  it('should verify triggers exist on next-auth.users', async () => {
    const result = await pg.query(`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = '"next-auth".users'::regclass
        AND tgname IN ('sync_twitter_bluesky_users_trigger', 'sync_twitter_mastodon_users_trigger')
    `);

    const names = result.rows.map((r) => r.tgname);
    expect(names).toContain('sync_twitter_bluesky_users_trigger');
    expect(names).toContain('sync_twitter_mastodon_users_trigger');
  });
});

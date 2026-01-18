import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import Redis from 'ioredis';
import { once } from 'events';
import {
  startPgNotifyListener,
  stopPgNotifyListener,
  isPgNotifyListenerRunning,
} from '@/lib/pg-notify-listener';

// Direct PostgreSQL connection config (bypassing PgBouncer) for LISTEN/NOTIFY
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

describe('Mastodon instances cache invalidation (pg_notify → Node listener → Redis)', () => {
  let pg: Client;
  let redis: Redis;

  const testInstance = `test-${Date.now()}.social`;

  beforeAll(async () => {
    if (!process.env.REDIS_PASSWORD) {
      throw new Error('REDIS_PASSWORD must be set to run this integration test');
    }

    pg = new Client(pgDirectConfig);
    await pg.connect();

    redis = new Redis(redisConfig);
    redis.on('error', (err: Error) => {
      // Prevent vitest unhandled errors
      console.error('[Redis error]', err.message);
    });
    await waitForRedisReady(redis);

    // Start the Node listener in-process for this test run.
    await startPgNotifyListener();

    if (!isPgNotifyListenerRunning()) {
      throw new Error('PgNotify listener did not start');
    }
  });

  afterAll(async () => {
    await stopPgNotifyListener();

    // Clean-up test row if it still exists
    try {
      await pg.query('DELETE FROM public.mastodon_instances WHERE instance = $1', [testInstance]);
    } catch {
      // ignore
    }

    await pg.end();
    await redis.quit();
  });

  it('should refresh Redis key mastodon:instances when mastodon_instances changes', async () => {
    // Ensure clean slate
    await pg.query('DELETE FROM public.mastodon_instances WHERE instance = $1', [testInstance]);

    // Trigger INSERT (statement-level trigger will fire)
    await pg.query(
      `INSERT INTO public.mastodon_instances (id, instance, client_id, client_secret)
       VALUES (extensions.uuid_generate_v4(), $1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [testInstance, 'client_id_test', 'client_secret_test']
    );

    // The listener should rebuild the full list and write it to Redis.
    await waitForCondition(async () => {
      const raw = await redis.get('mastodon:instances');
      if (!raw) return false;
      try {
        const list = JSON.parse(raw);
        return Array.isArray(list) && list.includes(testInstance);
      } catch {
        return false;
      }
    }, 8000, 200);

    // Now DELETE and ensure it disappears
    await pg.query('DELETE FROM public.mastodon_instances WHERE instance = $1', [testInstance]);

    await waitForCondition(async () => {
      const raw = await redis.get('mastodon:instances');
      if (!raw) return false;
      try {
        const list = JSON.parse(raw);
        return Array.isArray(list) && !list.includes(testInstance);
      } catch {
        return false;
      }
    }, 8000, 200);
  }, 20000);

  it('should verify trigger function uses pg_notify (migration applied)', async () => {
    const result = await pg.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'refresh_mastodon_cache_trigger'
    `);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].prosrc).toContain('pg_notify');
  });

  it('should verify trigger exists on public.mastodon_instances', async () => {
    const result = await pg.query(`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'public.mastodon_instances'::regclass
        AND tgname = 'refresh_mastodon_cache_on_change'
    `);

    expect(result.rows.length).toBe(1);
  });
});

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

describe('Global stats cache invalidation (pg_notify → Node listener → Redis)', () => {
  let pg: Client;
  let redis: Redis;

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
  });

  afterAll(async () => {
    await stopPgNotifyListener();
    await pg.end();
    await redis.quit();
  });

  it('should write stats:global in Redis after UPDATE on global_stats_cache (migration applied)', async () => {
    const stats = {
      users: 123,
      connections: 456,
      updated_at: new Date().toISOString(),
    };

    await pg.query(
      `INSERT INTO public.global_stats_cache (id, stats)
       VALUES (true, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET stats = EXCLUDED.stats, updated_at = now()`,
      [JSON.stringify(stats)]
    );

    await waitForCondition(async () => {
      const raw = await redis.get('stats:global');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return parsed?.users === 123 && parsed?.connections === 456;
      } catch {
        return false;
      }
    }, 8000, 200);
  }, 20000);

  it('should verify trigger function uses pg_notify (migration applied)', async () => {
    const result = await pg.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'notify_global_stats_cache_change'
    `);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].prosrc).toContain('pg_notify');
    expect(result.rows[0].prosrc).toContain('global_stats_cache_invalidation');
  });

  it('should verify triggers exist on public.global_stats_cache', async () => {
    const result = await pg.query(`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'public.global_stats_cache'::regclass
        AND tgname IN ('trg_notify_global_stats_cache_change_ins', 'trg_notify_global_stats_cache_change_upd')
    `);

    const names = result.rows.map((r) => r.tgname);
    expect(names).toContain('trg_notify_global_stats_cache_change_ins');
    expect(names).toContain('trg_notify_global_stats_cache_change_upd');
  });
});

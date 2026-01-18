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

describe('User stats cache invalidation (pg_notify → Node listener → Redis)', () => {
  let pg: Client;
  let redis: Redis;

  const testUserId = `00000000-0000-0000-0000-${String(Date.now()).slice(-12).padStart(12, '0')}`;

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

    // Ensure user exists for FK
    await pg.query(
      `INSERT INTO "next-auth".users (id, name, created_at, updated_at, has_onboarded, hqx_newsletter, oep_accepted, research_accepted, have_seen_newsletter, automatic_reconnect)
       VALUES ($1, $2, now(), now(), false, false, false, false, false, false)
       ON CONFLICT (id) DO NOTHING`,
      [testUserId, 'test-user-stats-cache']
    );

    // Ensure clean redis key
    await redis.del(`user:stats:${testUserId}`);
  });

  afterAll(async () => {
    await stopPgNotifyListener();

    try {
      await pg.query('DELETE FROM public.user_stats_cache WHERE user_id = $1', [testUserId]);
      await pg.query('DELETE FROM "next-auth".users WHERE id = $1', [testUserId]);
    } catch {
      // ignore
    }

    await pg.end();
    await redis.quit();
  });

  it('should write user:stats:<user_id> in Redis after INSERT/UPDATE on user_stats_cache (migration applied)', async () => {
    const cacheKey = `user:stats:${testUserId}`;

    const stats1 = {
      connections: { followers: 1, following: 2, totalEffectiveFollowers: 3 },
      matches: {
        bluesky: { total: 1, hasFollowed: 0, notFollowed: 1 },
        mastodon: { total: 2, hasFollowed: 1, notFollowed: 1 },
      },
    };

    await pg.query(
      `INSERT INTO public.user_stats_cache (user_id, stats)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET stats = EXCLUDED.stats, updated_at = now()`,
      [testUserId, JSON.stringify(stats1)]
    );

    await waitForCondition(async () => {
      const raw = await redis.get(cacheKey);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return parsed?.connections?.followers === 1;
      } catch {
        return false;
      }
    }, 8000, 200);

    const stats2 = {
      connections: { followers: 4, following: 5, totalEffectiveFollowers: 6 },
      matches: stats1.matches,
    };

    await pg.query(
      `UPDATE public.user_stats_cache
       SET stats = $2::jsonb, updated_at = now()
       WHERE user_id = $1`,
      [testUserId, JSON.stringify(stats2)]
    );

    await waitForCondition(async () => {
      const raw = await redis.get(cacheKey);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return parsed?.connections?.followers === 4;
      } catch {
        return false;
      }
    }, 8000, 200);
  }, 20000);

  it('should verify trigger function uses pg_notify (migration applied)', async () => {
    const result = await pg.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'notify_user_stats_cache_change'
    `);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].prosrc).toContain('pg_notify');
    expect(result.rows[0].prosrc).toContain('user_stats_cache_invalidation');
  });

  it('should verify triggers exist on public.user_stats_cache', async () => {
    const result = await pg.query(`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'public.user_stats_cache'::regclass
        AND tgname IN ('trg_notify_user_stats_cache_change_ins', 'trg_notify_user_stats_cache_change_upd')
    `);

    const names = result.rows.map((r) => r.tgname);
    expect(names).toContain('trg_notify_user_stats_cache_change_ins');
    expect(names).toContain('trg_notify_user_stats_cache_change_upd');
  });
});

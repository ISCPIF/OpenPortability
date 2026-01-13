import Redis from 'ioredis';

// ============================================================================
// SINGLETON PATTERN POUR NEXT.JS
// ============================================================================
// Utilise globalThis pour persister la connexion Redis entre les reloads
// de modules Next.js (hot reload en dev, invocations serverless en prod).
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitRedisClient: Redis | undefined
}

export function getRedis(): Redis {
  if (globalThis.__rateLimitRedisClient) return globalThis.__rateLimitRedisClient;

  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
  const password = process.env.REDIS_PASSWORD;

  let client: Redis;

  if (url) {
    client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  } else if (host && port) {
    client = new Redis({
      host,
      port,
      password,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  } else {
    // Fallback to localhost defaults (useful in dev/docker-compose)
    client = new Redis({
      host: 'redis',
      port: 6379,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  client.on('error', (err) => {
    console.warn('[Redis] client error', { message: err?.message });
  });

  // Store in globalThis for persistence across module reloads
  globalThis.__rateLimitRedisClient = client;

  return client;
}

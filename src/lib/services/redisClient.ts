import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;

  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
  const password = process.env.REDIS_PASSWORD;

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

  client.on('connect', () => {
  });

  return client;
}

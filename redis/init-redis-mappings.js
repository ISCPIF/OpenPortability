#!/usr/bin/env node

/**
 * Script d'initialisation des mappings Redis
 * Exécuté au démarrage pour charger les mappings sociaux depuis PostgreSQL vers Redis
 */

const { createClient: createRedisClient } = require('redis');
const { Pool } = require('pg');

// Configuration Redis
const REDIS_CONFIG = {
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    connectTimeout: 30000,
    lazyConnect: false
  },
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB || '0')
};

// Configuration PostgreSQL via PgBouncer
const pgPool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
  host: process.env.PGBOUNCER_HOST || 'pgbouncer',  // ← utilise le hostname
  port: parseInt(process.env.PGBOUNCER_PORT || '6432'),
  database: process.env.POSTGRES_DB || 'nexus',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

async function waitForRedis(redisClient, maxRetries = 30, delay = 2000) {
  console.log('🔄 Waiting for Redis to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await redisClient.ping();
      console.log('✅ Redis is ready!');
      return true;
    } catch (error) {
      console.log(`⏳ Redis not ready yet (attempt ${i + 1}/${maxRetries}), retrying in ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Redis not available after ${maxRetries} attempts`);
}

async function waitForPostgres(pgPool, maxRetries = 10, delay = 2000) {
  console.log('🔄 Waiting for PostgreSQL to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await pgPool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ PostgreSQL is ready!');
      return true;
    } catch (error) {
      console.log(`⏳ PostgreSQL not ready yet (attempt ${i + 1}/${maxRetries}), retrying in ${delay/1000}s...`);
      console.log('Error details:', error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`PostgreSQL not available after ${maxRetries} attempts`);
}

async function loadInitialMappingsToRedis() {
  let redisClient;

  try {
    console.log('🚀 Starting Redis mappings initialization...');

    // Connexion Redis
    redisClient = createRedisClient(REDIS_CONFIG);
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    await redisClient.connect();
    await waitForRedis(redisClient);

    // Vérification PostgreSQL
    await waitForPostgres(pgPool);

    console.log('📊 Loading Bluesky mappings from twitter_bluesky_users...');
    
    // ÉTAPE 1: Charger les mappings Bluesky depuis twitter_bluesky_users
    let blueskyTotal = 0;
    let blueskyPage = 0;
    const pageSize = 1000;
    let lastTwitterId = null; // keyset pagination cursor

    while (true) {
      let query = `
        SELECT twitter_id::text, bluesky_username, bluesky_id
        FROM twitter_bluesky_users
        WHERE twitter_id IS NOT NULL
          AND bluesky_username IS NOT NULL
          AND bluesky_id IS NOT NULL
      `;
      
      if (lastTwitterId !== null) {
        query += ` AND twitter_id > $1`;
      }
      
      query += ` ORDER BY twitter_id ASC LIMIT $${lastTwitterId !== null ? '2' : '1'}`;
      
      const params = lastTwitterId !== null ? [lastTwitterId, pageSize] : [pageSize];
      const result = await pgPool.query(query, params);
      const blueskyUsers = result.rows;
      
      if (!blueskyUsers || blueskyUsers.length === 0) {
        break;
      }

      // Batch insert avec pipeline Redis
      const blueskyPipeline = redisClient.multi();
      
      for (const user of blueskyUsers) {
        if (user.twitter_id && user.bluesky_username && user.bluesky_id) {
          const key = `twitter_to_bluesky:${user.twitter_id}`;
          // Store as JSON to mirror Mastodon format
          const value = JSON.stringify({
            username: user.bluesky_username,
            id: user.bluesky_id
          });
          blueskyPipeline.set(key, value);
        }
      }
      
      await blueskyPipeline.exec();
      blueskyTotal += blueskyUsers.length;
      blueskyPage++;
      lastTwitterId = blueskyUsers[blueskyUsers.length - 1].twitter_id; // advance cursor
      
      console.log(`✅ Loaded Bluesky page ${blueskyPage}: ${blueskyUsers.length} users (total: ${blueskyTotal})`);
      
      if (blueskyUsers.length < pageSize) {
        break;
      }
    }

    console.log(`✅ Loaded ${blueskyTotal} Bluesky mappings from twitter_bluesky_users`);

    console.log('📊 Loading Mastodon mappings from twitter_mastodon_users...');
    
    // ÉTAPE 2: Charger les mappings Mastodon depuis twitter_mastodon_users
    let mastodonTotal = 0;
    let mastodonPage = 0;
    let lastMastodonTwitterId = null;

    while (true) {
      let query = `
        SELECT twitter_id::text, mastodon_id, mastodon_username, mastodon_instance
        FROM twitter_mastodon_users
        WHERE twitter_id IS NOT NULL
          AND mastodon_id IS NOT NULL
          AND mastodon_username IS NOT NULL
          AND mastodon_instance IS NOT NULL
      `;
      
      if (lastMastodonTwitterId !== null) {
        query += ` AND twitter_id > $1`;
      }
      
      query += ` ORDER BY twitter_id ASC LIMIT $${lastMastodonTwitterId !== null ? '2' : '1'}`;
      
      const params = lastMastodonTwitterId !== null ? [lastMastodonTwitterId, pageSize] : [pageSize];
      const result = await pgPool.query(query, params);
      const mastodonUsers = result.rows;
      
      if (!mastodonUsers || mastodonUsers.length === 0) {
        break;
      }

      // Batch insert avec pipeline Redis
      const mastodonPipeline = redisClient.multi();
      
      for (const user of mastodonUsers) {
        if (user.twitter_id && user.mastodon_id && user.mastodon_username && user.mastodon_instance) {
          const key = `twitter_to_mastodon:${user.twitter_id}`;
          const value = JSON.stringify({
            id: user.mastodon_id,
            username: user.mastodon_username,
            instance: user.mastodon_instance
          });
          mastodonPipeline.set(key, value);
        }
      }
      
      await mastodonPipeline.exec();
      mastodonTotal += mastodonUsers.length;
      mastodonPage++;
      lastMastodonTwitterId = mastodonUsers[mastodonUsers.length - 1].twitter_id; // advance cursor
      
      console.log(`✅ Loaded Mastodon page ${mastodonPage}: ${mastodonUsers.length} users (total: ${mastodonTotal})`);
      
      if (mastodonUsers.length < pageSize) {
        break;
      }
    }

    console.log(`✅ Loaded ${mastodonTotal} Mastodon mappings from twitter_mastodon_users`);

    console.log(`🎉 Initial mappings loading completed successfully! Total: ${blueskyTotal} Bluesky + ${mastodonTotal} Mastodon mappings`);

  } catch (error) {
    console.error('❌ Failed to load initial mappings to Redis:', error);
    throw error;
  } finally {
    if (redisClient) {
      try {
        await redisClient.quit();
        console.log('✅ Redis connection closed');
      } catch (error) {
        console.error('❌ Error closing Redis connection:', error);
      }
    }
    
    if (pgPool) {
      try {
        await pgPool.end();
        console.log('✅ PostgreSQL connection pool closed');
      } catch (error) {
        console.error('❌ Error closing PostgreSQL connection pool:', error);
      }
    }
  }
}

// Exécution du script
if (require.main === module) {
  loadInitialMappingsToRedis()
    .then(() => {
      console.log('✅ Redis mappings initialization completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Redis mappings initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { loadInitialMappingsToRedis };

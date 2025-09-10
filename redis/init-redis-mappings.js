#!/usr/bin/env node

/**
 * Script d'initialisation des mappings Redis
 * Exécuté au démarrage pour charger les mappings sociaux depuis PostgreSQL vers Redis
 */

const { createClient: createRedisClient } = require('redis');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

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

// Configuration Supabase
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });
      },
    }
  }
);

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

async function waitForSupabase(supabase, maxRetries = 10, delay = 2000) {
  console.log('🔄 Waiting for Supabase to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Simple test with nodes table - just check if we can access it
      const { data, error } = await supabase.from('nodes').select('twitter_id').limit(1);
      if (!error) {
        console.log('✅ Supabase is ready!');
        return true;
      }
      console.log('Supabase error:', error);
      throw error;
    } catch (error) {
      console.log(`⏳ Supabase not ready yet (attempt ${i + 1}/${maxRetries}), retrying in ${delay/1000}s...`);
      console.log('Error details:', error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Supabase not available after ${maxRetries} attempts`);
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

    // Vérification Supabase
    await waitForSupabase(supabase);

    console.log('📊 Loading Bluesky mappings from twitter_bluesky_users...');
    
    // ÉTAPE 1: Charger les mappings Bluesky depuis twitter_bluesky_users
    let blueskyTotal = 0;
    let blueskyPage = 0;
    const pageSize = 1000;
    let lastTwitterId = null; // keyset pagination cursor

    while (true) {
      let blueskyQuery = supabase
        .from('twitter_bluesky_users')
        .select('twitter_id, twitter_id::text, bluesky_username, bluesky_id')
        .not('twitter_id', 'is', null)
        .not('bluesky_username', 'is', null)
        .not('bluesky_id', 'is', null)
        .order('twitter_id', { ascending: true })
        .limit(pageSize);

      if (lastTwitterId !== null) {
        blueskyQuery = blueskyQuery.gt('twitter_id', lastTwitterId);
      }

      const { data: blueskyUsers, error: blueskyError } = await blueskyQuery;
      
      if (blueskyError) {
        throw new Error(`Failed to fetch Bluesky users: ${blueskyError.message}`);
      }
      
      if (!blueskyUsers || blueskyUsers.length === 0) {
        break;
      }

      // Batch insert avec pipeline Redis
      const blueskyPipeline = redisClient.multi();
      
      for (const user of blueskyUsers) {
        const idText = user.twitter_id_text ?? (user.twitter_id != null ? String(user.twitter_id) : null);
        if (idText && user.bluesky_username && user.bluesky_id) {
          const key = `twitter_to_bluesky:${idText}`;
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

    while (true) {
      const { data: mastodonUsers, error: mastodonError } = await supabase
        .from('twitter_mastodon_users')
        .select('twitter_id::text, mastodon_id, mastodon_username, mastodon_instance')
        .not('twitter_id', 'is', null)
        .not('mastodon_id', 'is', null)
        .not('mastodon_username', 'is', null)
        .not('mastodon_instance', 'is', null)
        .order('twitter_id')
        .range(mastodonPage * pageSize, (mastodonPage + 1) * pageSize - 1);
      
      if (mastodonError) {
        throw new Error(`Failed to fetch Mastodon users: ${mastodonError.message}`);
      }
      
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

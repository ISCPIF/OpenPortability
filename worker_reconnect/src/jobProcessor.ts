// worker_reconnect/src/jobProcessor.ts
import { createClient } from '@supabase/supabase-js';
import { BskyAgent } from '@atproto/api';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = 500;  // Taille du batch augmentée à 500
const BASE_INTERVAL = 3600;  // 1 heure en secondes
const MAX_INTERVAL = 28800; // 8 heures en secondes
const BACKOFF_MULTIPLIER = 2;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface ReconnectJob {
  id: string;
  user_id: string;
  job_type: 'initial_sync' | 'realtime_sync';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  last_attempt: Date;
  next_attempt: Date;
  attempt_count: number;
  error_log?: string;
  stats?: {
    processed: number;
    successful: number;
    failed: number;
  };
  interval_seconds: number;
  max_interval_seconds: number;
  backoff_multiplier: number;
}

async function processJob(job: ReconnectJob, workerId: string) {
  console.log(`🚀 [Worker ${workerId}] Starting bluesky mappings verification`);
  let offset = 0;
  const stats = { processed: 0, successful: 0, failed: 0 };

  try {
    const agent = new BskyAgent({ service: 'https://bsky.social' });

    while (true) {
      const { data: mappings, error: mappingsError, count } = await supabase
        .from('bluesky_mappings')
        .select('*', { count: 'exact' })
        .range(offset, offset + BATCH_SIZE - 1);

      if (mappingsError) {
        console.error(`❌ Error fetching mappings:`, mappingsError);
        throw new Error('Failed to fetch bluesky mappings');
      }

      if (!mappings || mappings.length === 0) {
        console.log(`✨ No more mappings to process`);
        break;
      }

      console.log(`\n📦 Processing batch of ${mappings.length} mappings (offset: ${offset}, total: ${count})`);

      for (const mapping of mappings) {
        console.log(`🔍 Verifying ${mapping.bluesky_handle} (Twitter ID: ${mapping.twitter_id})`);
        
        try {
          const profile = await agent.getProfile({ actor: mapping.bluesky_handle });
          if (!profile.success) {
            throw new Error(`Failed to resolve profile for ${mapping.bluesky_handle}`);
          }
          stats.successful++;
          console.log(`✅ ${mapping.bluesky_handle} is valid`);
        } catch (error: any) {
          stats.failed++;
          const errorMessage = error.message || 'Unknown error';
          console.error(`❌ Error with ${mapping.bluesky_handle}:`, errorMessage);
          
          if (
            errorMessage.includes('Account has been suspended') ||
            errorMessage.includes('Profile not found') ||
            errorMessage.includes('Failed to resolve profile')
          ) {
            console.log(`🗑️ Removing invalid mapping ${mapping.bluesky_handle}`);
            const { error: deleteError } = await supabase
              .from('bluesky_mappings')
              .delete()
              .eq('twitter_id', mapping.twitter_id);

            if (deleteError) {
              console.error(`❌ Failed to delete mapping:`, deleteError);
            }
          }
        }
        
        stats.processed++;
      }

      offset += BATCH_SIZE;
      console.log(`📊 Batch progress - Processed: ${stats.processed}, Success: ${stats.successful}, Failed: ${stats.failed}`);
    }

    console.log(`\n✨ Verification completed - Final stats:`, stats);

  } catch (error) {
    console.error(`❌ Verification failed:`, error);
  }
}

export { processJob, ReconnectJob };
// worker_reconnect/src/jobProcessor.ts
import { createClient } from '@supabase/supabase-js';
import { BskyAgent } from '@atproto/api';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = 100;
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

const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: "next-auth"
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

interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  url: string;
}

async function followOnMastodon(accessToken: string, userInstance: string, targetUsername: string, targetInstance: string) {
  const cleanUserInstance = userInstance.replace('https://', '');
  const cleanTargetInstance = targetInstance.replace('https://', '');
  const cleanUsername = targetUsername.split('@')[0];
  
  console.log(' [mastodon_follow] Attempting to follow account:', { 
    userInstance: cleanUserInstance, 
    targetUsername: cleanUsername,
    targetInstance: cleanTargetInstance 
  });
  
  try {
    const searchResponse = await fetch(
      `https://${cleanUserInstance}/api/v1/accounts/search?q=${cleanUsername}@${cleanTargetInstance}&resolve=true&limit=1`, 
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search account');
    }

    const accounts = await searchResponse.json() as MastodonAccount[];
    const accountToFollow = accounts.find(acc => 
      acc.acct === `${cleanUsername}@${cleanTargetInstance}` || 
      (acc.username === cleanUsername && acc.url.includes(cleanTargetInstance))
    );

    if (!accountToFollow) {
      throw new Error('No exact match found');
    }

    const followResponse = await fetch(
      `https://${cleanUserInstance}/api/v1/accounts/${accountToFollow.id}/follow`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!followResponse.ok) {
      throw new Error(`Failed to follow on Mastodon: ${followResponse.statusText}`);
    }

    return await followResponse.json();
  } catch (error) {
    console.error(' [mastodon_follow] Error following on Mastodon:', error);
    throw error;
  }
}

function calculateNextAttempt(job: ReconnectJob): Date | null {
  if (job.job_type === 'initial_sync') {
    return null;
  }

  const now = new Date();
  if (job.status === 'failed') {
    const backoffSeconds = Math.min(
      job.interval_seconds * Math.pow(job.backoff_multiplier, job.attempt_count),
      job.max_interval_seconds
    );
    return new Date(now.getTime() + backoffSeconds * 1000);
  }

  return new Date(now.getTime() + job.interval_seconds * 1000);
}

async function updateJobProgress(
  jobId: string,
  stats: { processed: number; successful: number; failed: number },
  workerId: string,
  status: 'processing' | 'completed' | 'failed' = 'processing',
  errorLog?: string
) {
  const update: any = {
    status,
    stats,
    updated_at: new Date().toISOString()
  };

  if (errorLog) {
    update.error_log = errorLog;
  }

  const { error } = await supabase
    .from('reconnect_jobs')
    .update(update)
    .eq('id', jobId);

  if (error) {
    console.error(`❌ [Worker ${workerId}] Failed to update job progress:`, error);
  }
}

async function processSourceTargets(
  userId: string,
  jobType: 'initial_sync' | 'realtime_sync'
) {
  const query = supabase
    .from('sources_targets')
    .select('*')
    .eq('source_id', userId);

  if (jobType === 'realtime_sync') {
    query
      .or('has_follow_bluesky.eq.false,has_follow_mastodon.eq.false')
      .not('bluesky_handle', 'is', null)
      .not('mastodon_username', 'is', null);
  }

  const { data: targets, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch targets: ${error.message}`);
  }

  return targets || [];
}

async function processJob(job: ReconnectJob, workerId: string) {
  console.log(`🚀 [Worker ${workerId}] Starting ${job.job_type} job ${job.id} for user ${job.user_id}`);

  try {
    console.log(`📊 [Worker ${workerId}] Initializing job stats...`);
    await updateJobProgress(
      job.id,
      { processed: 0, successful: 0, failed: 0 },
      workerId,
      'processing'
    );

    // Get both Bluesky and Mastodon credentials
    console.log(`🔑 [Worker ${workerId}] Fetching social credentials for user ${job.user_id}...`);
    const { data: accountsData, error: accountsError } = await supabaseAuth
      .from('accounts')
      .select('access_token, refresh_token, provider_account_id, provider')
      .eq('user_id', job.user_id)
      .in('provider', ['bluesky', 'mastodon'])
      .eq('type', 'oauth');

    if (accountsError || !accountsData) {
      console.error(`❌ [Worker ${workerId}] Failed to fetch social credentials:`, accountsError);
      throw new Error('Social credentials not found');
    }

    const blueskyAccount = accountsData.find(acc => acc.provider === 'bluesky');
    const mastodonAccount = accountsData.find(acc => acc.provider === 'mastodon');
    
    console.log(`ℹ️ [Worker ${workerId}] Found credentials:`, {
      hasBluesky: !!blueskyAccount,
      hasMastodon: !!mastodonAccount
    });

    // Get user info for Mastodon instance
    console.log(`👤 [Worker ${workerId}] Fetching Mastodon user data...`);
    const { data: userData, error: userError } = await supabaseAuth
      .from('users')
      .select('mastodon_id, mastodon_username, mastodon_instance')
      .eq('id', job.user_id)
      .single();

    if (userError) {
      console.error(`❌ [Worker ${workerId}] Failed to fetch user data:`, userError);
      throw new Error('Failed to fetch user data');
    }

    console.log(`🎯 [Worker ${workerId}] Fetching targets for ${job.job_type}...`);
    const targets = await processSourceTargets(job.user_id, job.job_type);
    console.log(`📋 [Worker ${workerId}] Found ${targets.length} total targets`);
    
    const stats = { processed: 0, successful: 0, failed: 0 };

    // Process in batches
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    console.log(`📦 [Worker ${workerId}] Processing ${totalBatches} batches of ${BATCH_SIZE} targets`);

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`\n🔄 [Worker ${workerId}] Processing batch ${batchNumber}/${totalBatches}`);
      
      const batch = targets.slice(i, i + BATCH_SIZE);
      
      // Process Bluesky follows
      const blueskyFollows = batch.filter(acc => acc.bluesky_handle && !acc.has_follow_bluesky);
      console.log(`🦋 [Worker ${workerId}] Found ${blueskyFollows.length} Bluesky follows in this batch`);

      if (blueskyAccount && blueskyFollows.length > 0) {
        console.log(`🔌 [Worker ${workerId}] Initializing Bluesky agent...`);
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        await agent.resumeSession({
          accessJwt: blueskyAccount.access_token,
          refreshJwt: blueskyAccount.refresh_token,
          handle: blueskyAccount.provider_account_id,
          did: blueskyAccount.provider_account_id,
          active: true
        });

        for (const account of blueskyFollows) {
          console.log(`👤 [Worker ${workerId}] Processing Bluesky follow: ${account.bluesky_handle}`);
          try {
            const profile = await agent.getProfile({ actor: account.bluesky_handle });
            if (!profile.success) {
              throw new Error(`Failed to resolve profile for ${account.bluesky_handle}`);
            }
            
            await agent.follow(profile.data.did);
            await supabase
              .from('sources_targets')
              .update({ has_follow_bluesky: true })
              .eq('source_id', job.user_id)
              .eq('target_twitter_id', account.twitter_id);

            console.log(`✅ [Worker ${workerId}] Successfully followed ${account.bluesky_handle} on Bluesky`);
            stats.successful++;
          } catch (error) {
            console.error(`❌ [Worker ${workerId}] Failed to follow ${account.bluesky_handle} on Bluesky:`, error);
            stats.failed++;
          }
          stats.processed++;
          await updateJobProgress(job.id, stats, workerId, 'processing');
        }
      }

      // Process Mastodon follows
      const mastodonFollows = batch.filter(acc => 
        acc.mastodon_username && 
        acc.mastodon_instance && 
        !acc.has_follow_mastodon
      );
      console.log(`🐘 [Worker ${workerId}] Found ${mastodonFollows.length} Mastodon follows in this batch`);

      if (mastodonAccount && mastodonFollows.length > 0 && userData.mastodon_instance) {
        for (const account of mastodonFollows) {
          console.log(`👤 [Worker ${workerId}] Processing Mastodon follow: ${account.mastodon_username}@${account.mastodon_instance}`);
          try {
            await followOnMastodon(
              mastodonAccount.access_token,
              userData.mastodon_instance,
              account.mastodon_username!,
              account.mastodon_instance!
            );
            await supabase
              .from('sources_targets')
              .update({ has_follow_mastodon: true })
              .eq('source_id', job.user_id)
              .eq('target_twitter_id', account.twitter_id);

            console.log(`✅ [Worker ${workerId}] Successfully followed ${account.mastodon_username}@${account.mastodon_instance} on Mastodon`);
            stats.successful++;
          } catch (error) {
            console.error(`❌ [Worker ${workerId}] Failed to follow ${account.mastodon_username}@${account.mastodon_instance} on Mastodon:`, error);
            stats.failed++;
          }
          stats.processed++;
          await updateJobProgress(job.id, stats, workerId, 'processing');
        }
      }
    }

    console.log(`\n📊 [Worker ${workerId}] Job completed with stats:`, stats);

    // Calculate next attempt and update job
    const nextAttempt = calculateNextAttempt(job);
    console.log(`⏰ [Worker ${workerId}] Calculated next attempt:`, nextAttempt);

    const finalUpdate: any = {
      status: 'completed',
      stats,
      last_attempt: new Date().toISOString(),
      attempt_count: 0
    };

    if (nextAttempt) {
      finalUpdate.next_attempt = nextAttempt.toISOString();
      
      // Create next realtime_sync job
      console.log(`📝 [Worker ${workerId}] Creating next realtime_sync job for:`, nextAttempt);
      await supabase
        .from('reconnect_jobs')
        .insert({
          user_id: job.user_id,
          job_type: 'realtime_sync',
          status: 'pending',
          next_attempt: nextAttempt.toISOString(),
          interval_seconds: BASE_INTERVAL,
          max_interval_seconds: MAX_INTERVAL,
          backoff_multiplier: BACKOFF_MULTIPLIER
        });
    }

    await supabase
      .from('reconnect_jobs')
      .update(finalUpdate)
      .eq('id', job.id);

    console.log(`✨ [Worker ${workerId}] Job ${job.id} completed successfully`);

  } catch (error) {
    console.error(`❌ [Worker ${workerId}] Job failed with error:`, error);

    const nextAttempt = calculateNextAttempt({
      ...job,
      attempt_count: (job.attempt_count || 0) + 1,
      status: 'failed'
    });

    console.log(`⏰ [Worker ${workerId}] Next attempt after failure:`, nextAttempt);

    const update: any = {
      status: 'failed',
      error_log: error.message,
      last_attempt: new Date().toISOString(),
      attempt_count: (job.attempt_count || 0) + 1
    };

    if (nextAttempt) {
      update.next_attempt = nextAttempt.toISOString();
    }

    await supabase
      .from('reconnect_jobs')
      .update(update)
      .eq('id', job.id);
  }
}

export { processJob, ReconnectJob };
// worker_reconnect/src/index.ts
import { createClient } from '@supabase/supabase-js';
import { processJob } from './jobProcessor';
import * as dotenv from 'dotenv';

dotenv.config();

const WORKER_ID = process.env.WORKER_ID || 'reconnect_worker1';
const POLL_INTERVAL = 5000; // 5 secondes

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

console.log(`🚀 [Worker ${WORKER_ID}] Starting...`);

async function pollJobs() {
  try {
    console.log(`🔍 [Worker ${WORKER_ID}] Looking for pending jobs...`);
    // Get next job to process
    const { data: jobs, error } = await supabase
      .from('reconnect_jobs')
      .select('*')
      .or('status.eq.pending,status.eq.failed')
      .lte('next_attempt', new Date().toISOString())
      .order('next_attempt', { ascending: true })
      .limit(1);

    if (error) {
      console.error(`❌ [Worker ${WORKER_ID}] Error fetching jobs:`, error);
      return;
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      console.log(`✨ [Worker ${WORKER_ID}] Found job to process:`, {
        jobId: job.id,
        userId: job.user_id,
        type: job.job_type,
        status: job.status
      });
      await processJob(job, WORKER_ID);
    } else {
      console.log(`💤 [Worker ${WORKER_ID}] No pending jobs found, waiting ${POLL_INTERVAL/1000}s...`);
    }
  } catch (error) {
    console.error(`❌ [Worker ${WORKER_ID}] Error in poll loop:`, error);
  }
}

// Start polling loop
async function startPolling() {
  while (true) {
    await pollJobs();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

startPolling().catch(error => {
  console.error(`❌ [Worker ${WORKER_ID}] Fatal error:`, error);
  process.exit(1);
});
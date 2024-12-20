// worker/src/index.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { processJob } from './jobProcessor';

// Charger les variables d'environnement au tout début
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const POLLING_INTERVAL = 5000; // 5 secondes

async function checkForPendingJobs() {
  console.log('🔍 [Worker] Checking for pending jobs...');
  
  const { data: jobs, error } = await supabase
    .from('import_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .order('created_at')
    .limit(1);

  if (error) {
    console.error('❌ [Worker] Error fetching jobs:', error);
    return;
  }

  if (jobs && jobs.length > 0) {
    const job = jobs[0];
    console.log(`✨ [Worker] Processing job: ${job.id}`);
    
    try {
      await processJob(job);
    } catch (error) {
      console.error(`❌ [Worker] Error processing job ${job.id}:`, error);
    }
  }
}

async function startWorker() {
  console.log('🚀 [Worker] Starting import worker...');
  
  while (true) {
    try {
      await checkForPendingJobs();
    } catch (error) {
      console.error('💥 [Worker] Unexpected error:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
  }
}

process.on('SIGTERM', () => {
  console.log('👋 [Worker] Shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 [Worker] Shutting down...');
  process.exit(0);
});

startWorker().catch(error => {
  console.error('💥 [Worker] Fatal error:', error);
  process.exit(1);
});
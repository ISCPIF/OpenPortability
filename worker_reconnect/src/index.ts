// worker_reconnect/src/index.ts
import { createClient } from '@supabase/supabase-js';
import { processJob, ReconnectJob } from './jobProcessor';
import * as dotenv from 'dotenv';

dotenv.config();

const WORKER_ID = 'bluesky_verify_worker';

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

// Créer un job fictif pour la vérification
const verificationJob: ReconnectJob = {
  id: 'verify_job',
  user_id: 'b1160921-81f1-4e00-9d51-65220e2ddfa6',
  job_type: 'initial_sync',
  status: 'processing',
  last_attempt: new Date(),
  next_attempt: new Date(),
  attempt_count: 0,
  interval_seconds: 3600,
  max_interval_seconds: 28800,
  backoff_multiplier: 2
};

// Lancer la vérification une seule fois
processJob(verificationJob, WORKER_ID).catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
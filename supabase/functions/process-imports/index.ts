import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 1000;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface ImportJob {
  id: string;
  user_id: string;
  storage_path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_batch: number;
  total_items: number;
  error_log?: string;
}

async function processJob(job: ImportJob) {
  try {
    // 1. Mettre à jour le statut
    await supabase
      .from('import_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // 2. Récupérer les fichiers du storage
    const storagePaths = JSON.parse(job.storage_path);
    const fileContents = await Promise.all(
      storagePaths.map(async (path: string) => {
        const { data, error } = await supabase.storage
          .from('twitter-imports')
          .download(path);
        
        if (error) throw error;
        const text = await data.text();
        return parseTwitterFile(text); // votre fonction de parsing existante
      })
    );

    // 3. Traiter les données par lots
    const allData = fileContents.flat();
    const totalBatches = Math.ceil(allData.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = start + BATCH_SIZE;
      const batch = allData.slice(start, end);

      // Traiter les followers
      const followers = batch.filter(item => item.follower).map(item => ({
        source_id: job.user_id,
        target_id: item.follower!.accountId,
        target_username: item.follower!.username || '',
        target_name: item.follower!.name || '',
        target_link: item.follower!.userLink
      }));

      // Traiter les following
      const following = batch.filter(item => item.following).map(item => ({
        source_id: job.user_id,
        target_id: item.following!.accountId,
        target_username: item.following!.username || '',
        target_name: item.following!.name || '',
        target_link: item.following!.userLink
      }));

      // Insérer les données
      if (followers.length > 0) {
        const { error: followersError } = await supabase
          .from('followers')
          .upsert(followers);
        if (followersError) throw followersError;
      }

      if (following.length > 0) {
        const { error: followingError } = await supabase
          .from('following')
          .upsert(following);
        if (followingError) throw followingError;
      }

      // Mettre à jour la progression
      await supabase
        .from('import_jobs')
        .update({ 
          current_batch: batchIndex + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      // Petit délai entre les lots pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 4. Marquer comme terminé
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // 5. Nettoyer les fichiers du storage
    await Promise.all(
      storagePaths.map(path => 
        supabase.storage
          .from('twitter-imports')
          .remove([path])
      )
    );

  } catch (error) {
    console.error('Error processing job:', error);
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'failed',
        error_log: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);
  }
}

// Point d'entrée principal
Deno.serve(async (req) => {
  try {
    // Vérifier l'authentification (à implémenter selon vos besoins)
    
    // Récupérer un job en attente
    const { data: jobs, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at')
      .limit(1);

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Traiter le job
    await processJob(jobs[0]);

    return new Response(
      JSON.stringify({ message: 'Job processed successfully' }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
})
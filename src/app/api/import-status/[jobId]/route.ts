import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"
import { redis } from '@/lib/redis'

// Schéma vide car les paramètres sont dans l'URL, pas dans le body
const EmptySchema = z.object({}).strict()

async function getImportStatus(request: NextRequest, _data: z.infer<typeof EmptySchema>, session: any) {
  try {
    // Récupérer le jobId depuis l'URL
    const jobId = request.nextUrl.pathname.split('/').pop();
    
    if (!session?.user?.id) {
      logger.logWarning('API', 'GET /api/import-status/[jobId]', 'Unauthorized access attempt');
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    try {
      const redisKey = `job:${jobId}`;
      const cachedJob = await redis.get(redisKey);
      
      if (cachedJob) {
        const job = JSON.parse(cachedJob);
        
        // Vérifier que le job appartient à l'utilisateur
        if (job.user_id !== session.user.id) {
          logger.logWarning('API', 'GET /api/import-status/[jobId]', 'Job access denied', session.user.id, { jobId });
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const stats = job.stats || {
          total: job.total_items || 0,
          progress: 0,
          followers: { total: 0, processed: 0 },
          following: { total: 0, processed: 0 },
          processed: 0
        };

        const normalizedStats = (() => {
          const s: any = stats;
          const isFlat = typeof s?.followers === 'number' || typeof s?.following === 'number';
          if (!isFlat) return s;
          return {
            total: typeof s.total === 'number' ? s.total : job.total_items || 0,
            progress: typeof s.progress === 'number' ? s.progress : 0,
            processed: typeof s.processed === 'number' ? s.processed : (typeof s.followers === 'number' && typeof s.following === 'number' ? s.followers + s.following : 0),
            followers: {
              processed: typeof s.followers === 'number' ? s.followers : 0,
              total: typeof s.followers_total === 'number' ? s.followers_total : 0
            },
            following: {
              processed: typeof s.following === 'number' ? s.following : 0,
              total: typeof s.following_total === 'number' ? s.following_total : 0
            }
          };
        })();

        // Optional Redis-only meta fields for richer frontend UX
        const phase = (job.phase as ('pending'|'nodes'|'edges'|'completed'|'failed'|undefined)) ?? 'pending';
        const phase_progress = typeof job.phase_progress === 'number' ? job.phase_progress : undefined;
        const nodes_total = typeof job.nodes_total === 'number' ? job.nodes_total : undefined;
        const nodes_processed = typeof job.nodes_processed === 'number' ? job.nodes_processed : undefined;
        const edges_total = typeof job.edges_total === 'number' ? job.edges_total : undefined;
        const edges_processed = typeof job.edges_processed === 'number' ? job.edges_processed : undefined;

        logger.logInfo('API', 'GET /api/import-status/[jobId]', 'Job status retrieved from Redis', session.user.id, {
          jobId: job.id,
          status: job.status,
          progress: `${normalizedStats.processed}/${normalizedStats.total} items`,
          totalItems: job.total_items,
          stats: normalizedStats,
          phase,
          phase_progress

        });

        return NextResponse.json({
          id: job.id,
          status: job.status,
          progress: normalizedStats.processed,
          totalItems: job.total_items || stats.total,
          stats: normalizedStats,
          error: job.error_log,
          phase,
          phase_progress,
          nodes_total,
          nodes_processed,
          edges_total,
          edges_processed,
        });
      }
    } catch (redisError) {
      logger.logWarning('API', 'GET /api/import-status/[jobId]', 'Redis unavailable, fallback to DB', session.user.id, {
        jobId,
        error: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
      });
    }

    // 2. Fallback vers DB si Redis indisponible
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', session.user.id)
      .single();

    if (jobError) {
      logger.logError('API', 'GET /api/import-status/[jobId]', new Error(jobError.message), session.user.id, { 
        jobId,
        context: 'Database query error'
      });
      return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
    }

    if (!job) {
      logger.logWarning('API', 'GET /api/import-status/[jobId]', 'Job not found', session.user.id, { jobId });
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const stats = job.stats || {
      followers: 0,
      following: 0,
      total: job.total_items || 0,
      processed: 0
    };

    logger.logInfo('API', 'GET /api/import-status/[jobId]', 'Job status retrieved', session.user.id, {
      jobId: job.id,
      status: job.status,
      progress: `${stats.processed}/${stats.total} items`,
      totalItems: stats.total,
      stats
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: stats.processed,
      totalItems: stats.total,
      stats,
      error: job.error_log,
      // Provide a default phase when coming from DB fallback
      phase: 'pending' as const,
      phase_progress: undefined
    });

  } catch (error) {
    const userId = session?.user?.id || 'unknown';
    logger.logError('API', 'GET /api/import-status/[jobId]', error, userId, { 
      context: 'Unexpected error in import status check'
    });
    return NextResponse.json(
      { error: 'Failed to check import status' },
      { status: 500 }
    );
  }
}

// Configuration du middleware de validation
export const GET = withValidation(
  EmptySchema,
  getImportStatus,
  {
    requireAuth: true,
    applySecurityChecks: false, // Pas de données à valider dans le body
    skipRateLimit: true,
  }
)
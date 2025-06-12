import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'
import logger from '@/lib/log_utils';
import { withValidation } from "@/lib/validation/middleware"
import { z } from "zod"

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

    // Récupérer le statut du job
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
      return NextResponse.json(
        { error: 'Failed to fetch job status' },
        { status: 500 }
      );
    }

    if (!job) {
      logger.logWarning('API', 'GET /api/import-status/[jobId]', 'Job not found', session.user.id, { jobId });
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
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
      error: job.error_log
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
    skipRateLimit: false
  }
)
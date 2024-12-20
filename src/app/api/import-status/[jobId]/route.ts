import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from "@/app/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Récupérer et attendre les paramètres
    const jobId = request.nextUrl.pathname.split('/').pop();
    console.log(`📡 [Import Status API] Fetching status for job: ${jobId}`);

    const session = await auth();
    console.log('[Import Status] Session check:', { 
      userId: session?.user?.id,
      hasSession: !!session 
    });

    if (!session?.user?.id) {
      console.log('❌ [Import Status API] Unauthorized access attempt');
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Récupérer le statut du job
    console.log('[Import Status] Fetching job details');
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', session.user.id)
      .single();

    if (jobError) {
      console.error('❌ [Import Status API] Database error:', jobError);
      return NextResponse.json(
        { error: 'Failed to fetch job status' },
        { status: 500 }
      );
    }

    if (!job) {
      console.log(`❌ [Import Status API] Job ${jobId} not found`);
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

    console.log('✅ [Import Status API] Job status retrieved:', {
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
    console.error('❌ [Import Status API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to check import status' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'
import { auth } from "@/app/auth";
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import logger, { withLogging } from '@/lib/log_utils';

const TEMP_UPLOAD_DIR = join(process.cwd(), 'tmp', 'uploads');

async function ensureUserTempDir(userId: string) {
  const userDir = join(TEMP_UPLOAD_DIR, userId);
  await mkdir(userDir, { recursive: true });
  return userDir;
}

async function largeFilesUploadHandler(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.has_onboarded) {
      logger.logWarning('API', 'POST /api/upload/large-files', 'Unauthorized access attempt', session?.user?.id || 'unknown');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Vérifier si l'utilisateur a déjà un job en cours
    const { data: existingJobs, error: jobCheckError } = await supabase
      .from('import_jobs')
      .select('id, status')
      .eq('user_id', session.user.id)
      .in('status', ['pending', 'processing']);

    if (jobCheckError) {
      logger.logError('API', 'POST /api/upload/large-files', jobCheckError, session.user.id, {
        context: 'Checking existing jobs'
      });
      return NextResponse.json(
        { error: 'Failed to verify existing jobs' },
        { status: 500 }
      );
    }

    if (existingJobs && existingJobs.length > 0) {
      logger.logWarning('API', 'POST /api/upload/large-files', 'User has pending or processing jobs', session.user.id);
      return NextResponse.json(
        { error: 'You already have a file upload in progress' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files');

    if (!files.length) {
      logger.logWarning('API', 'POST /api/upload/large-files', 'No files provided in request', session.user.id);
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Créer le dossier temporaire pour l'utilisateur
    const userDir = await ensureUserTempDir(session.user.id);

    // Sauvegarder les fichiers
    for (const file of files) {
      try {
        const fileName = file.name.toLowerCase().includes('following') ? 'following.js' : 'follower.js';
        const filePath = join(userDir, fileName);
        
        // Vérifier si le fichier a la méthode arrayBuffer
        if (typeof file.arrayBuffer !== 'function') {
          logger.logWarning('API', 'POST /api/upload/large-files', `Invalid file object for ${fileName}`, session.user.id);
          continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
      } catch (error) {
        logger.logError('API', 'POST /api/upload/large-files', error, session.user.id, {
          context: `Saving file ${file.name}`
        });
      }
    }

    // Créer le job pour le traitement asynchrone
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        user_id: session.user.id,
        status: 'pending',
        total_items: 0,
        created_at: new Date().toISOString(),
        job_type: 'large_file_import',
        file_paths: [
          join(userDir, 'following.js'),
          join(userDir, 'follower.js')
        ]
      })
      .select()
      .single();

    if (jobError) {
      logger.logError('API', 'POST /api/upload/large-files', jobError, session.user.id, {
        context: 'Creating import job'
      });
      throw jobError;
    }

    return NextResponse.json({ 
      jobId: job.id,
      message: 'Files uploaded successfully and queued for processing'
    });

  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/upload/large-files', error, userId, {
      context: 'Processing upload'
    });
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

export const POST = withLogging(largeFilesUploadHandler);
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'
import { auth } from "@/app/auth";
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import logger from '@/lib/log_utils';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';

const TEMP_UPLOAD_DIR = join(process.cwd(), 'tmp', 'uploads');

// Schéma Zod pour la validation des fichiers
// Comme les fichiers sont traités via FormData et non JSON,
// nous utilisons un schéma vide pour la validation du body
const LargeFilesUploadSchema = z.object({});

async function ensureUserTempDir(userId: string) {
  const userDir = join(TEMP_UPLOAD_DIR, userId);
  await mkdir(userDir, { recursive: true });
  return userDir;
}

async function largeFilesUploadHandler(request: Request, _validatedData: z.infer<typeof LargeFilesUploadSchema>, session: any) {
  try {
    // Vérifier la session manuellement pour s'assurer qu'elle est valide
    // Le middleware a déjà vérifié l'authentification, mais nous voulons des vérifications supplémentaires
    const session = await auth();
    const user = session.user;
    if (!session || !user || user.has_onboarded) {
      console.log('API', 'POST /api/upload/large-files', 'Unauthorized access attempt', user?.id || 'unknown');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Vérifier si l'utilisateur a déjà un job en cours
    const { data: existingJobs, error: jobCheckError } = await supabase
      .from('import_jobs')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing']);

    if (jobCheckError) {
      console.log('API', 'POST /api/upload/large-files', jobCheckError, user.id, {
        context: 'Checking existing jobs'
      });
      return NextResponse.json(
        { error: 'Failed to verify existing jobs' },
        { status: 500 }
      );
    }

    if (existingJobs && existingJobs.length > 0) {
      console.log('API', 'POST /api/upload/large-files', 'User has pending or processing jobs', user.id);
      return NextResponse.json(
        { error: 'You already have a file upload in progress' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    if (!formData)
    {
      console.log('API', 'POST /api/upload/large-files', 'No form data provided in request', user.id);
      return NextResponse.json(
        { error: 'No form data provided' },
        { status: 400 }
      );
    }
    const files = formData.getAll('files');

    if (!files.length) {
      console.log('API', 'POST /api/upload/large-files', 'No files provided in request', user.id);
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Vérifier le type et la taille des fichiers
    for (const file of files) {
      if (!(file instanceof File)) {
        console.log('API', 'POST /api/upload/large-files', 'Invalid file object', user.id);
        return NextResponse.json(
          { error: 'Invalid file format' },
          { status: 400 }
        );
      }

      // Vérification de la taille du fichier (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        console.log('API', 'POST /api/upload/large-files', `File too large: ${file.size} bytes`, user.id);
        return NextResponse.json(
          { error: 'File too large (max 100MB)' },
          { status: 400 }
        );
      }

      // Vérification du type MIME
      const validMimeTypes = ['application/javascript', 'text/javascript', 'application/json', 'text/plain'];
      if (!validMimeTypes.includes(file.type)) {
        console.log('API', 'POST /api/upload/large-files', `Invalid file type: ${file.type}`, user.id);
        return NextResponse.json(
          { error: 'Invalid file type. Only JS and JSON files are allowed.' },
          { status: 400 }
        );
      }
    }

    // Créer le dossier temporaire pour l'utilisateur
    const userDir = await ensureUserTempDir(user.id);

    // Sauvegarder les fichiers
    for (const file of files) {
      try {
        const fileName = file.name.toLowerCase().includes('following') ? 'following.js' : 'follower.js';
        const filePath = join(userDir, fileName);
        
        // Vérifier si le fichier a la méthode arrayBuffer
        if (typeof file.arrayBuffer !== 'function') {
          console.log('API', 'POST /api/upload/large-files', `Invalid file object for ${fileName}`, user.id);
          continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
      } catch (error) {
        console.log('API', 'POST /api/upload/large-files', error, user.id, {
          context: `Saving file ${file.name}`
        });
      }
    }

    // Créer le job pour le traitement asynchrone
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        user_id: user.id,
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
      console.log('API', 'POST /api/upload/large-files', jobError, user.id, {
        context: 'Creating import job'
      });
      throw jobError;
    }

    return NextResponse.json({ 
      jobId: job.id,
      message: 'Files uploaded successfully and queued for processing'
    });

  } catch (error) {
    // En cas d'erreur, essayer de récupérer l'ID utilisateur si possible
    const userId = session?.user?.id || 'unknown';
    console.log('API', 'POST /api/upload/large-files', error, userId, {
      context: 'Processing upload'
    });
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

export const POST = withValidation(
  LargeFilesUploadSchema,
  largeFilesUploadHandler,
  {
    requireAuth: true,
    applySecurityChecks: true,
    customRateLimit: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10,
      identifier: 'userId'
    }
  }
);
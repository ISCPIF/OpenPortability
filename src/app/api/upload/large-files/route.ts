import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from "@/app/auth";
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const TEMP_UPLOAD_DIR = join(process.cwd(), 'tmp', 'uploads');

async function ensureUserTempDir(userId: string) {
  const userDir = join(TEMP_UPLOAD_DIR, userId);
  await mkdir(userDir, { recursive: true });
  return userDir;
}

export async function POST(request: Request) {
  try {
    console.log(' [Large Files API] Starting file upload process');
    
    const session = await auth();
    if (!session?.user || session.user.has_onboarded) {
      console.log(' [Large Files API] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Vérifier si l'utilisateur a déjà complété son onboarding
    // const { data: userData, error: userError } = await supabase
    //   .from('users')
    //   .select('has_onboarded')
    //   .eq('id', session.user.id)
    //   .single();

    // if (session.user.has_onboarded) {
    //   console.log(' [Large Files API] User has already completed onboarding');
    //   return NextResponse.json(
    //     { error: 'User has already completed onboarding' },
    //     { status: 400 }
    //   );
    // }

    // 2. Vérifier si l'utilisateur a déjà un job en cours
    const { data: existingJobs, error: jobCheckError } = await supabase
      .from('import_jobs')
      .select('id, status')
      .eq('user_id', session.user.id)
      .in('status', ['pending', 'processing']);

    if (jobCheckError) {
      console.error(' [Large Files API] Error checking existing jobs:', jobCheckError);
      return NextResponse.json(
        { error: 'Failed to verify existing jobs' },
        { status: 500 }
      );
    }

    if (existingJobs && existingJobs.length > 0) {
      console.log(' [Large Files API] User has pending or processing jobs');
      return NextResponse.json(
        { error: 'You already have a file upload in progress' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files');

    console.log(` [Large Files API] Received ${files.length} files for user ${session.user.id}`);

    if (!files.length) {
      console.log(' [Large Files API] No files provided in request');
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Créer le dossier temporaire pour l'utilisateur
    const userDir = await ensureUserTempDir(session.user.id);
    console.log(` [Large Files API] Created/ensured temp directory: ${userDir}`);

    // Sauvegarder les fichiers
    for (const file of files) {
      try {
        const fileName = file.name.toLowerCase().includes('following') ? 'following.js' : 'follower.js';
        const filePath = join(userDir, fileName);
        
        // Vérifier si le fichier a la méthode arrayBuffer
        if (typeof file.arrayBuffer !== 'function') {
          console.log(` [Large Files API] Invalid file object for ${fileName}`);
          continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
        console.log(` [Large Files API] Saved ${fileName} (${buffer.length} bytes)`);
      } catch (error) {
        console.error(` [Large Files API] Error saving file ${fileName}:`, error);
      }
    }

    // Créer le job pour le traitement asynchrone
    console.log(' [Large Files API] Creating import job');
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
      console.error(' [Large Files API] Failed to create job:', jobError);
      throw jobError;
    }

    console.log(` [Large Files API] Job created successfully: ${job.id}`);
    return NextResponse.json({ 
      jobId: job.id,
      message: 'Files uploaded successfully and queued for processing'
    });

  } catch (error) {
    console.error(' [Large Files API] Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
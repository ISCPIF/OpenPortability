import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import logger from '@/lib/log_utils';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import { secureFileContentExtended, type FileContentData } from '@/lib/security-utils';
import { redis } from '@/lib/redis';

// Répertoire temporaire pour les uploads - doit être accessible aux workers
const TEMP_UPLOAD_DIR = process.env.TEMP_UPLOAD_DIR || '/app/tmp';

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
    // Le middleware withValidation a déjà vérifié l'authentification
    const user = session.user;
    if (!user) {
      console.log('API', 'POST /api/upload/large-files', 'Unauthorized access attempt', 'unknown');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.has_onboarded) {
      console.log('API', 'POST /api/upload/large-files', 'User already onboarded', user.id);
      return NextResponse.json({ error: 'Operation not allowed for onboarded users' }, { status: 403 });
    }

    // 2. Vérifier si l'utilisateur a déjà un job en cours
    const { data: existingJobs, error: jobCheckError } = await supabase
      .from('import_jobs')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing']);

    if (jobCheckError) {
      console.log('API', 'POST /api/upload/large-files', jobCheckError as string, user.id, {
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

    // Vérifier la sécurité des fichiers avec la fonction centralisée
    for (const fileEntry of files) {
      // Vérifier que l'entrée est bien un objet File
      if (!(fileEntry instanceof File)) {
        console.log('API', 'POST /api/upload/large-files', 'Invalid file object', user.id);
        return NextResponse.json(
          { error: 'Invalid file format' },
          { status: 400 }
        );
      }
      
      // Maintenant que nous savons que c'est un File, nous pouvons l'utiliser en toute sécurité
      const file = fileEntry;
      
      try {
        const fileContent = await file.text();
        
        // Vérification supplémentaire pour les patterns XSS dans les noms de fichiers
        // const fileNameXssResult = detectXssPatterns(file.name);
        // if (fileNameXssResult.detected) {
        //   console.log('Security', 'XSS pattern detected in filename', user.id, {
        //     fileName: file.name,
        //     patterns: fileNameXssResult.patterns
        //   });
          
        //   return NextResponse.json(
        //     { 
        //       error: 'Potentially malicious content detected in filename',
        //       securityReport: {
        //         securityLevel: 'high',
        //         suspiciousPatterns: fileNameXssResult.patterns
        //       }
        //     },
        //     { status: 400 }
        //   );
        // }
        
        // Utiliser la fonction secureFileContentExtended pour toutes les vérifications
        const fileData: FileContentData = {
          content: fileContent,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileObject: file
        };
        
        const securityResult = secureFileContentExtended(fileData, user.id);
        
        if (!securityResult.isSecure) {
          // Construire un message d'erreur approprié selon le type de problème détecté
          let errorMessage = 'Potentially malicious content detected in file';
          
          if (securityResult.securityReport.invalidFileType) {
            errorMessage = `Invalid file type: ${file.type}. Only JS and JSON files are allowed.`;
          } else if (securityResult.securityReport.fileTooLarge) {
            errorMessage = 'File too large (max 100MB)';
          } else if (securityResult.securityReport.sqlInjectionDetected) {
            errorMessage = 'SQL injection pattern detected in file';
          } else if (securityResult.securityReport.dangerousJsPatterns) {
            errorMessage = 'Dangerous JavaScript patterns detected in file';
          } else if (securityResult.securityReport.tamperingDetected) {
            errorMessage = 'File tampering detected';
          }
          
          console.log('Security', errorMessage, user.id, {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            securityLevel: securityResult.securityReport.securityLevel
          });
          
          return NextResponse.json(
            { 
              error: errorMessage, 
              securityReport: {
                securityLevel: securityResult.securityReport.securityLevel,
                suspiciousPatterns: securityResult.securityReport.suspiciousPatterns
              }
            },
            { status: 400 }
          );
        }
      } catch (securityError) {
        console.log('Security', 'Error analyzing file content', securityError as string, user.id, {
          context: 'File upload security check',
          fileName: file.name
        });
        
        return NextResponse.json(
          { error: 'Failed to analyze file content for security threats' },
          { status: 500 }
        );
      }
    }

    // Créer le dossier temporaire pour l'utilisateur
    const userDir = await ensureUserTempDir(user.id);

    // Sauvegarder les fichiers
    const savedFilePaths = [];
    for (const fileEntry of files) {
      try {
        const file = fileEntry as File;
        const fileName = file.name.toLowerCase().includes('following') ? 'following.js' : 'follower.js';
        const filePath = join(userDir, fileName);
        
        // Vérifier si le fichier a la méthode arrayBuffer
        if (typeof file.arrayBuffer !== 'function') {
          console.log('API', 'POST /api/upload/large-files', `Invalid file object for ${fileName}`, user.id);
          continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
        savedFilePaths.push(filePath);
        
        console.log('API', 'POST /api/upload/large-files', `File saved: ${fileName}`, user.id, {
          filePath,
          fileSize: file.size
        });
      } catch (error) {
        console.log('API', 'POST /api/upload/large-files', error as string, user.id, {
          context: `Saving file ${(fileEntry as File).name}`
        });
        
        return NextResponse.json(
          { error: 'Failed to save uploaded file' },
          { status: 500 }
        );
      }
    }

    // Vérifier que nous avons bien sauvegardé des fichiers
    if (savedFilePaths.length === 0) {
      console.log('API', 'POST /api/upload/large-files', 'No files were successfully saved', user.id);
      return NextResponse.json(
        { error: 'Failed to save any uploaded files' },
        { status: 500 }
      );
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
        file_paths: savedFilePaths
      })
      .select()
      .single();

    if (jobError) {
      console.log('API', 'POST /api/upload/large-files', jobError as string, user.id, {
        context: 'Creating import job'
      });
      return NextResponse.json(
        { error: 'Failed to create processing job' },
        { status: 500 }
      );
    }

    // Ajouter le job à la queue Redis pour traitement immédiat
    const redisSuccess = await redis.enqueueJob({
      id: job.id,
      user_id: job.user_id,
      status: job.status,
      total_items: job.total_items || 0,
      job_type: job.job_type,
      file_paths: job.file_paths || [],
      stats: job.stats,
      created_at: job.created_at,
      updated_at: job.updated_at
    });

    if (!redisSuccess) {
      // Si Redis échoue, le job reste dans Supabase et sera traité par le système de synchronisation
      console.log('API', 'POST /api/upload/large-files', 'Failed to enqueue job to Redis, will be processed via sync', user.id, {
        jobId: job.id,
        context: 'Redis enqueue failed - fallback to sync'
      });
    }

    console.log('API', 'POST /api/upload/large-files', 'Files uploaded successfully', user.id, {
      jobId: job.id,
      fileCount: savedFilePaths.length,
      redisEnqueued: redisSuccess
    });

    return NextResponse.json({ 
      jobId: job.id,
      message: 'Files uploaded successfully and queued for processing'
    });

  } catch (error) {
    // En cas d'erreur, essayer de récupérer l'ID utilisateur si possible
    const userId = session?.user?.id || 'unknown';
    console.log('API', 'POST /api/upload/large-files', error as string, userId, {
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
    expectedContentType: 'multipart/form-data',
    skipRateLimit: false
  }
);
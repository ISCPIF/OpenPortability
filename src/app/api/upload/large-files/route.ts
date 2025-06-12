import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'
import { auth } from "@/app/auth";
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import logger from '@/lib/log_utils';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import { secureFileContentExtended, type FileContentData } from '@/lib/security-utils';

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
      logger.logWarning('API', 'POST /api/upload/large-files', 'No form data provided in request', user.id);
      return NextResponse.json(
        { error: 'No form data provided' },
        { status: 400 }
      );
    }
    const files = formData.getAll('files');

    if (!files.length) {
      logger.logWarning('API', 'POST /api/upload/large-files', 'No files provided in request', user.id);
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Vérifier la sécurité des fichiers avec la fonction centralisée
    for (const fileEntry of files) {
      // Vérifier que l'entrée est bien un objet File
      if (!(fileEntry instanceof File)) {
        logger.logWarning('API', 'POST /api/upload/large-files', 'Invalid file object', user.id);
        return NextResponse.json(
          { error: 'Invalid file format' },
          { status: 400 }
        );
      }
      
      // Maintenant que nous savons que c'est un File, nous pouvons l'utiliser en toute sécurité
      const file = fileEntry;
      
      try {
        const fileContent = await file.text();
        
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
        logger.logError('Security', 'Error analyzing file content', securityError as string, user.id, {
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
    expectedContentType: 'multipart/form-data',
    customRateLimit: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10,
      identifier: 'userId'
    }
  }
);
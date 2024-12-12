'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import ErrorModal from "../_components/ErrorModal";
import ConsentModal from "../_components/ConsentModal";
import Header from '../_components/Header';
import * as zip from '@zip.js/zip.js';
import { validateTwitterData, extractTargetFiles } from '../_components/UploadButton';

const UploadButton = dynamic(() => import('../_components/UploadButton'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-12 w-48 rounded-lg"></div>,
  ssr: false
});

interface UploadStats {
  following: number;
  // followers: number;
}

interface ExtractedFile {
  name: string;
  content: Uint8Array;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      console.log("⛔️ No session found, redirecting to /auth/signin");
      router.replace("/auth/signin");
    }
    if (session?.user?.has_onboarded) {
      console.log("✅ User already onboarded, redirecting to /dashboard");
      router.replace("/dashboard");
    }
    if (status !== "loading") {
      setIsLoading(false);
    }
  }, [status, router, session]);

  useEffect(() => {
    console.log('État actuel:', {
      showConsent,
      hasPendingFiles: !!pendingFiles,
      pendingFilesLength: pendingFiles?.length,
      isUploading,
    });
  }, [showConsent, pendingFiles, isUploading]);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 50MB limit';
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['.zip', '.js'].includes(extension)) {
      return 'Invalid file type. Please upload either a ZIP file or following.js and follower.js files';
    }

    return null;
  };

  const validateFiles = (files: FileList): string | null => {
    if (files.length === 0) {
      return 'No files selected';
    }

    // Check if it's a single ZIP file
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      return validateFile(files[0]);
    }

    // Check if they are JS files
    if (files.length === 2) {
      const fileNames = Array.from(files).map(f => f.name.toLowerCase());
      
      // Check if both files are .js
      if (!fileNames.every(name => name.endsWith('.js'))) {
        return 'When uploading individual files, both must be .js files';
      }

      // Check if we have both following.js and follower.js
      const hasFollowing = fileNames.some(name => name === 'following.js');
      const hasFollower = fileNames.some(name => name === 'follower.js');

      if (!hasFollowing || !hasFollower) {
        return 'Please upload both following.js and follower.js files';
      }

      // Check file sizes
      for (const file of files) {
        const sizeError = validateFile(file);
        if (sizeError) return sizeError;
      }

      return null;
    }

    return 'Please upload either a ZIP file or both following.js and follower.js files';
  };

  const processFiles = async (files: FileList) => {
    try {
      console.log('🔄 Début du traitement des fichiers', {
        filesLength: files.length,
        firstFile: files[0] ? {
          name: files[0].name,
          type: files[0].type,
          size: files[0].size
        } : null
      });

      // Validation initiale des fichiers
      const validationError = validateFiles(files);
      if (validationError) {
        throw new Error(validationError);
      }

      let processedFiles: ExtractedFile[] = [];

      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        console.log('📦 Traitement du fichier ZIP:', files[0].name);
        processedFiles = await extractTargetFiles(files[0]);
      } else {
        console.log('📑 Traitement des fichiers JS directs');
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          processedFiles.push({
            name: file.name,
            content: new Uint8Array(arrayBuffer)
          });
        }
      }

      console.log('📦 Fichiers traités:', processedFiles.map(f => f.name));

      // Validation du contenu des fichiers
      const formData = new FormData();
      for (const { name, content } of processedFiles) {
        const textContent = new TextDecoder().decode(content);
        const type = name.toLowerCase().includes('following') ? 'following' : 'follower';
        
        const validationError = validateTwitterData(textContent, type);
        if (validationError) {
          throw new Error(validationError);
        }
        
        console.log(`✅ ${name} validation successful`);
        const file = new File([content], name, {
          type: 'application/javascript'
        });
        formData.append('file', file);
      }

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Envoi au serveur avec le bon endpoint
      const response = await fetch(`/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      console.log('✅ Upload successful');
      const result = await response.json();
      handleUploadComplete(result.stats);
    } catch (error) {
      console.error('❌ Error processing files:', error);
      handleUploadError(error instanceof Error ? error.message : 'Failed to process files');
    }
  };

  const handleUploadComplete = async (stats: UploadStats) => {
    console.log('✅ Upload terminé avec succès:', stats);
    router.push('/dashboard');
  };

  const handleUploadError = (errorMessage: string) => {
    console.log('❌ Erreur durant l\'upload:', errorMessage);
    setError(errorMessage);
    setIsUploading(false);
  };

  const handleCloseError = () => {
    console.log('🔄 Fermeture de l\'erreur');
    setError(null);
  };

  const handleFilesSelected = (files: FileList) => {
    // Convertir FileList en Array pour le stocker correctement
    const filesArray = Array.from(files);
    console.log('📁 Fichiers sélectionnés:', {
      numberOfFiles: filesArray.length,
      firstFileName: filesArray[0]?.name,
      firstFileType: filesArray[0]?.type,
      firstFileSize: filesArray[0]?.size
    });

    // Créer un nouveau FileList à partir de l'array
    const dataTransfer = new DataTransfer();
    filesArray.forEach(file => dataTransfer.items.add(file));
    
    setShowConsent(true);
    setPendingFiles(dataTransfer.files);
  };

  const handleConsentDecline = () => {
    console.log('❌ Consentement refusé');
    setShowConsent(false);
    setPendingFiles(null);
  };

  const handleConsentAccept = async () => {
    console.log('✅ Consentement accepté, début du traitement');
    
    if (!pendingFiles || pendingFiles.length === 0) {
      console.log('❌ Pas de fichiers à traiter:', pendingFiles);
      handleUploadError('No files to process');
      return;
    }

    console.log('📦 Fichiers en attente:', {
      length: pendingFiles.length,
      files: Array.from(pendingFiles).map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      }))
    });

    setShowConsent(false);
    setIsUploading(true);
    await processFiles(pendingFiles);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-500 to-pink-400">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="relative max-w-2xl mx-auto p-8 rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-pink-900"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] opacity-70"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.1),transparent)] opacity-50"></div>
          
          <div className="relative space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-white">
                Importez vos données Twitter
              </h2>
            </div>
            
            <div className="space-y-6">
              <p className="text-lg text-white/90 text-center font-medium">
                Téléchargez votre archive Twitter au format ZIP ou les fichiers following.js et follower.js
              </p>

              <div className="flex items-center justify-center">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 w-full max-w-md">
                  <UploadButton
                    onUploadComplete={handleUploadComplete}
                    onError={handleUploadError}
                    onFilesSelected={handleFilesSelected}
                  />
                </div>
              </div>
                
              {isUploading && (
                <div className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-pink-200 border-t-transparent"></div>
                    <span className="text-white/90 font-medium">
                      Traitement en cours...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ErrorModal
            isOpen={!!error}
            onClose={() => setError(null)}
            message={error || ''}
          />

          <ConsentModal
            isOpen={showConsent}
            onAccept={handleConsentAccept}
            onDecline={handleConsentDecline}
          />
        </div>
      </main>
    </div>
  );
}
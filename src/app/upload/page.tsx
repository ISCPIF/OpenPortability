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
import Image from 'next/image';
import seaBackground from '../../../public/sea.svg'
import { plex } from '../fonts/plex';
import logoHQX from '../../../public/BannerHQX-rose_FR.svg'
import { motion } from 'framer-motion';
import boat1 from '../../../public/boats/boat-1.svg'
// import progress0 from '../../../public/progress/progress-0.svg'

const UploadButton = dynamic(() => import('../_components/UploadButton'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-12 w-48 rounded-lg"></div>,
  ssr: false
});

interface UploadStats {
  following: number;
  followers: number;
}

interface ExtractedFile {
  name: string;
  content: Uint8Array;
}

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 50MB

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {

    console.log("hello par ici")
    if (status === "unauthenticated") {
      console.log("⛔️ No session found, redirecting to /auth/signin");
      router.replace("/auth/signin");
    }
    if (session?.user?.has_onboarded) {
      console.log("✅ User already onboarded, redirecting to /dashboard");
      // update()
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
        try {
          processedFiles = await extractTargetFiles(files[0]);
          if (processedFiles.length === 0) {
            throw new Error('No valid files found in the ZIP archive. Please make sure it contains follower.js and/or following.js');
          }
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Failed to process ZIP file: ${error.message}`);
          }
          throw new Error('Failed to process ZIP file');
        }
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

        try {
          const validationError = validateTwitterData(textContent, type);
          if (validationError) {
            throw new Error(validationError);
          }
        } catch (error) {
          throw new Error(`Invalid content in ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log(`✅ ${name} validation successful`);
        
        // Parser le JSON pour l'ajouter à notre objet de données
        const cleanedContent = textContent.replace(/window\.YTD\.[a-zA-Z]+\.part0 = /, '');
        const jsonData = JSON.parse(cleanedContent);
        if (name.includes('follower')) {
          formData.append('followers', JSON.stringify(jsonData));
        } else {
          formData.append('following', JSON.stringify(jsonData));
        }
      }

      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Créer l'objet final à envoyer
      const dataToSend = {
        userId: session.user.id,
        followers: formData.get('followers') ? JSON.parse(formData.get('followers') as string) : [],
        following: formData.get('following') ? JSON.parse(formData.get('following') as string) : []
      };

      if (dataToSend.followers.length === 0 && dataToSend.following.length === 0) {
        throw new Error('No valid data found in the files. Please make sure they contain follower or following information.');
      }

      console.log("Données à envoyer:", dataToSend);
      
      // Envoi au serveur avec le bon endpoint
      const response = await fetch(`/api/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      console.log('✅ Upload successful');
      const result = await response.json();
      handleUploadComplete(result.stats);
    } catch (error) {
      // console.error('❌ Error processing files:', error);
      handleUploadError(error instanceof Error ? error.message : 'Failed to process files');
      setIsUploading(false);
    }
  };

  const handleUploadComplete = async (stats: UploadStats) => {
    console.log('✅ Upload terminé avec succès:', stats);
    setUploadStats(stats);
    setShowStats(true);
    setIsUploading(false);
  };

  const handleUploadError = (errorMessage: string) => {
    console.log('❌ Erreur durant l\'upload:', errorMessage);
    setError(errorMessage);
    setIsUploading(false);
    setPendingFiles(null);
    setShowConsent(false);
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
    <div className="bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <Header />
      <div className="absolute top-0 w-full h-[35rem]">
        <Image src={seaBackground} fill alt="" className="object-cover"></Image>
        <Image
          src={logoHQX}
          alt="HelloQuitteX Logo"
          width={306}
          height={125}
          className="mx-auto lg:mt-8 relative"
        />
        <div className="container flex flex-col mx-auto text-center gap-y-4 px-6 lg:gap-y-8 text-[#282729] relative my-8 lg:my-14 max-w-[50rem]">
          <h1 className={`${plex.className} text-2xl lg:text-3xl font-light`}>Bienvenue à bord d’HelloQuitX !</h1>
          <p className={`${plex.className} text-lg lg:text-xl font-normal`}>Effectuez les étapes suivantes pour voguer vers de nouveaux horizons et enfin QUITTER X !</p>
        </div>
        <motion.div className="absolute top-[65%] left-[46.5%]" style={{ originX: 0.5, originY: 1 }}
          transition={{
            repeatType: 'reverse',
            repeat: Infinity,
            duration: 2,
            ease: "linear"
          }}
          initial={{ rotateZ: "-5deg" }}
          animate={{ rotateZ: "5deg" }}
          exit={{ rotateZ: 0 }}
        >
          <Image src={boat1} width={110} height={88} alt="" className=""></Image>
        </motion.div>
        {/* <Image src={progress0} width={80} height={82} alt="" className="absolute top-[87%] left-[48%]"></Image> */}
      </div>

      <div className="mx-auto px-4 my-[35rem] h-screen">
        <div className="relative max-w-2xl mx-auto p-8 rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-pink-900"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] opacity-70"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(236,72,153,0.1),transparent)] opacity-50"></div>

          <div className="relative space-y-8">
            <div className="text-center">
              <h2 className={`text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-white ${plex.className}`}>
                Importez vos données Twitter
              </h2>
            </div>

            <div className="space-y-6">
              <p className={`text-lg text-white/90 text-center font-medium ${plex.className}`}>
              Déposez votre fichier .zip (si sa taille ne dépasse pas 300 Mo) ou, si vous l'avez déjà décompressé, téléversez vos fichiers data/following.js et data/follower.js
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

              {isUploading ? (
                <div className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-pink-200 border-t-transparent"></div>
                    <span className={`text-white/90 font-medium ${plex.className}`}>
                      Traitement en cours...
                    </span>
                  </div>
                </div>
              ) : uploadStats && (
                <div className={`text-center mb-6 p-4 bg-pink-50 rounded-lg ${plex.className}`}>
                  <h2 className="text-xl font-semibold text-pink-800 mb-2">Traitement terminé</h2>
                  <p className="text-pink-700">
                    Vous avez importés {uploadStats.following} followings et {uploadStats.followers} followers.
                  </p>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white rounded-lg transition-colors"
                  >
                    Retourner au tableau de bord pour la prochaine étape
                  </button>
                </div>
              )}
            </div>
          </div>

          <ErrorModal
            isOpen={!!error}
            message={error || ''}
            onClose={handleCloseError}
          />

          <ConsentModal
            isOpen={showConsent}
            onAccept={handleConsentAccept}
            onDecline={handleConsentDecline}
          />
        </div>
      </div>
    </div>
  );
}

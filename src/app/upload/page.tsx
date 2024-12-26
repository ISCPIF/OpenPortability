'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import logoHQX from '../../../public/logoxHQX/HQX-rose-FR.svg'
import { motion } from 'framer-motion';
import boat1 from '../../../public/boats/boat-1.svg'
import Footer from "@/app/_components/Footer";

const UploadButton = dynamic(() => import('../_components/UploadButton'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-12 w-48 rounded-lg"></div>,
  ssr: false
});

interface ExtractedFile {
  name: string;
  content: Uint8Array;
}

const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      // console.log("⛔️ No session found, redirecting to /auth/signin");
      router.replace("/auth/signin");
    }
    if (session?.user?.has_onboarded) {
      // console.log("✅ User already onboarded, redirecting to /dashboard");
      router.replace("/dashboard");
    }
    if (status !== "loading") {
      setIsLoading(false);
    }
  }, [status, router, session]);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 1GB limit';
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['.zip', '.js'].includes(extension)) {
      return 'Invalid file type. Please upload either a ZIP file or following.js and follower.js files';
    }

    return null;
  };

  const validateFiles = (files: FileList): string | null => {
    console.log('🔍 Validating files...', {
      numberOfFiles: files.length,
      fileNames: Array.from(files).map(f => f.name)
    });

    if (files.length === 0) {
      return 'No files selected';
    }

    // Check if it's a single ZIP file
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      console.log('📦 ZIP file detected');
      return validateFile(files[0]);
    }

    const fileArray = Array.from(files);
    const fileNames = fileArray.map(f => f.name.toLowerCase());

    // Check if all files are .js
    if (!fileNames.every(name => name.endsWith('.js'))) {
      return 'All files must be .js files';
    }

    console.log('📄 Analyzing JS files:', fileNames);

    // Case 1: Standard case (following.js + follower.js)
    const hasStandardFollowing = fileNames.includes('following.js');
    const hasStandardFollower = fileNames.includes('follower.js');
    
    // Case 2: Split files case
    const followerParts = fileArray.filter(f => /follower-part\d+\.js/.test(f.name.toLowerCase()));
    const followingParts = fileArray.filter(f => /following-part\d+\.js/.test(f.name.toLowerCase()));
    const hasSplitFollower = followerParts.length > 0;
    const hasSplitFollowing = followingParts.length > 0;

    console.log('📊 Files status:', {
      hasStandardFollowing,
      hasStandardFollower,
      followerParts: followerParts.length > 0 ? followerParts.map(f => f.name) : 'none',
      followingParts: followingParts.length > 0 ? followingParts.map(f => f.name) : 'none'
    });

    // Check file sizes in all cases
    for (const file of files) {
      const sizeError = validateFile(file);
      if (sizeError) return sizeError;
    }

    // Validate combinations
    if (hasStandardFollowing && hasStandardFollower && files.length === 2) {
      console.log('✅ Standard case validated');
      return null;
    } else if (hasSplitFollower && hasSplitFollowing) {
      console.log('✅ Split files case validated (both)');
      return null;
    } else if (hasStandardFollowing && hasSplitFollower) {
      console.log('✅ Split files case validated (follower only)');
      return null;
    } else if (hasSplitFollowing && hasStandardFollower) {
      console.log('✅ Split files case validated (following only)');
      return null;
    }

    console.log('❌ Invalid file combination');
    return 'Please upload either a ZIP file, following.js + follower.js, or their split versions (following-part*.js/follower-part*.js)';
  };

  const validateFileType = (file: File): boolean => {
    const validTypes = ['application/javascript', 'text/javascript', 'application/zip'];
    return validTypes.includes(file.type);
  };

  const sanitizeContent = (content: Uint8Array): Uint8Array => {
    const text = new TextDecoder().decode(content);
    const sanitized = text
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/['"]\s*javascript\s*['"]/i, '');
    return new TextEncoder().encode(sanitized);
  };

  const mergePartFiles = (files: ExtractedFile[], type: 'follower' | 'following'): { content: Uint8Array; count: number } => {
    console.log(`🔄 Fusion des fichiers ${type}:`, files.map(f => f.name));
    
    // Trier les fichiers par numéro de part
    const sortedFiles = files.sort((a, b) => {
      const numA = parseInt(a.name.match(/part(\d+)/)?.[1] || '0');
      const numB = parseInt(b.name.match(/part(\d+)/)?.[1] || '0');
      return numA - numB;
    });

    console.log('📋 Ordre de traitement:', sortedFiles.map(f => f.name));

    // Extraire et fusionner les données
    let mergedContent = '';
    let totalCount = 0;

    sortedFiles.forEach((file, index) => {
      const isLast = index === sortedFiles.length - 1;
      const text = new TextDecoder().decode(file.content);
      console.log(`📖 Traitement de ${file.name}...`);
      
      // Trouver les indices de début et fin
      const startBracket = text.indexOf('[');
      if (startBracket === -1) {
        throw new Error(`Format invalide dans ${file.name}: "[" non trouvé`);
      }

      // Extraire le contenu entre [ et ]
      let content = text.substring(startBracket + 1);
      if (!isLast) {
        // Pour tous les fichiers sauf le dernier, on enlève le ] final
        const endBracket = content.lastIndexOf(']');
        if (endBracket === -1) {
          throw new Error(`Format invalide dans ${file.name}: "]" non trouvé`);
        }
        content = content.substring(0, endBracket);
      }

      // Compter les objets dans ce fichier
      const objectCount = (content.match(/"follower"\s*:/g) || []).length;
      console.log(`📊 ${file.name}: ${objectCount} objets trouvés`);
      totalCount += objectCount;

      // Ajouter une virgule entre les fichiers (sauf pour le premier morceau)
      if (index > 0 && content.trim()) {
        mergedContent += ',';
      }
      
      mergedContent += content;
    });

    console.log(`📊 Total ${type}: ${totalCount} entrées`);
    
    // Recréer le contenu avec le bon préfixe
    const finalContent = `window.YTD.${type}.part0 = [${mergedContent}`;
    return {
      content: new TextEncoder().encode(finalContent),
      count: totalCount
    };
  };

  const processFiles = async (files: FileList) => {
    try {
      console.log('🔄 Starting file processing', {
        numberOfFiles: files.length,
        files: Array.from(files).map(f => ({ name: f.name, size: f.size }))
      });

      // Validation initiale...
      const validationError = validateFiles(files);
      if (validationError) throw new Error(validationError);
      
      // Vérification MIME...
      for (const file of Array.from(files)) {
        if (!validateFileType(file)) {
          throw new Error(`Invalid file type for ${file.name}`);
        }
      }

      let processedFiles: ExtractedFile[] = [];
      const formData = new FormData();
      const fileCounts = { follower: 0, following: 0 };
      
      // Traitement ZIP ou fichiers directs...
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        processedFiles = await extractTargetFiles(files[0]);
        if (processedFiles.length === 0) {
          throw new Error('No valid files found in ZIP archive');
        }
      } else {
        processedFiles = await Promise.all(
          Array.from(files).map(async (file) => ({
            name: file.name,
            content: new Uint8Array(await file.arrayBuffer())
          }))
        );
      }

      // Détecter les fichiers en parties
      const followerParts = processedFiles.filter(f => f.name.toLowerCase().includes('follower-part'));
      const followingParts = processedFiles.filter(f => f.name.toLowerCase().includes('following-part'));
      
      // Traiter les fichiers followers
      if (followerParts.length > 0) {
        console.log('🔄 Fusion des fichiers follower...');
        const { content, count } = mergePartFiles(followerParts, 'follower');
        
        // Valider le contenu fusionné
        const textContent = new TextDecoder().decode(content);
        const validationError = validateTwitterData(textContent, 'follower');
        if (validationError) {
          throw new Error(`Invalid follower data: ${validationError}`);
        }
        
        formData.append('files', new Blob([content], { type: 'application/javascript' }), 'follower.js');
        fileCounts.follower = count;
      } else {
        // Chercher le fichier follower.js standard
        const followerFile = processedFiles.find(f => f.name.toLowerCase() === 'follower.js');
        if (followerFile) {
          const textContent = new TextDecoder().decode(followerFile.content);
          const validationError = validateTwitterData(textContent, 'follower');
          if (validationError) {
            throw new Error(`Invalid follower data: ${validationError}`);
          }
          formData.append('files', new Blob([followerFile.content], { type: 'application/javascript' }), 'follower.js');
          fileCounts.follower = (textContent.match(/"follower"\s*:/g) || []).length;
        }
      }

      // Traiter les fichiers following (même logique)
      if (followingParts.length > 0) {
        console.log('� Fusion des fichiers following...');
        const { content, count } = mergePartFiles(followingParts, 'following');
        
        const textContent = new TextDecoder().decode(content);
        const validationError = validateTwitterData(textContent, 'following');
        if (validationError) {
          throw new Error(`Invalid following data: ${validationError}`);
        }
        
        formData.append('files', new Blob([content], { type: 'application/javascript' }), 'following.js');
        fileCounts.following = count;
      } else {
        const followingFile = processedFiles.find(f => f.name.toLowerCase() === 'following.js');
        if (followingFile) {
          const textContent = new TextDecoder().decode(followingFile.content);
          const validationError = validateTwitterData(textContent, 'following');
          if (validationError) {
            throw new Error(`Invalid following data: ${validationError}`);
          }
          formData.append('files', new Blob([followingFile.content], { type: 'application/javascript' }), 'following.js');
          fileCounts.following = (textContent.match(/"following"\s*:/g) || []).length;
        }
      }

      // Envoi au serveur...
      console.log('📤 Envoi au serveur...', {
        followerCount: fileCounts.follower,
        followingCount: fileCounts.following
      });

      const response = await fetch('/api/upload/large-files', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload files');
      }

      const { jobId } = await response.json();
      router.push(`/upload/large-files?jobId=${jobId}&followerCount=${fileCounts.follower}&followingCount=${fileCounts.following}`);

    } catch (error) {
      handleUploadError(error instanceof Error ? error.message : 'Failed to process files');
    }
  };

  const handleUploadError = (errorMessage: string) => {
    console.log('❌ Upload error:', errorMessage);
    setError(errorMessage);
    setIsUploading(false);
    setPendingFiles(null);
    setShowConsent(false);
  };

  const handleCloseError = () => {
    console.log('🔄 Closing error');
    setError(null);
  };

  const handleFilesSelected = (files: FileList) => {
    console.log('📁 Files selected:', {
      numberOfFiles: files.length,
      firstFileName: files[0]?.name,
      firstFileType: files[0]?.type,
      firstFileSize: files[0]?.size
    });

    // Stocker les fichiers et afficher la modale de consentement
    setPendingFiles(files);
    setShowConsent(true);
  };

  const handleConsentDecline = () => {
    console.log('❌ Consent declined');
    setPendingFiles(null);
    setShowConsent(false);
  };

  const handleConsentAccept = async () => {
    console.log('✅ Consent accepted, starting processing');

    if (!pendingFiles || pendingFiles.length === 0) {
      console.log('❌ No files to process');
      handleUploadError('No files to process');
      return;
    }

    setShowConsent(false);
    setIsUploading(true);
    
    try {
      await processFiles(pendingFiles);
    } catch (error) {
      handleUploadError(error instanceof Error ? error.message : 'Failed to process files');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <Header />
      <div className="flex justify-center mt-8 mb-8">
        <Image
          src={logoHQX}
          alt="HelloQuitteX Logo"
          width={306}
          height={125}
          className="mx-auto"
          priority
        />
      </div>
      <div className="flex justify-center items-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-xl rounded-xl border border-black/10 shadow-xl p-8 max-w-2xl w-full mx-auto relative"
          >
            {/* Bouton d'aide */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-200"
              aria-label="Aide pour obtenir votre archive Twitter"
            >
              ?
            </button>
            
            <div className="text-center text-white">
              <h2 className={`${plex.className} text-2xl font-bold mb-6`}>
                Importez votre archive Twitter pour poursuivre votre 
              </h2>
              
              <div className="space-y-4">
                <p className="text-white/80">
                Déposez votre fichier .zip (si sa taille ne dépasse pas 300 Mo) ou, si vous l'avez déjà décompressé, téléversez vos fichiers data/following.js et data/follower.js
                </p>
                
                {!isUploading && (
                  <div className="mt-8">
                    <UploadButton onFilesSelected={handleFilesSelected} onError={handleUploadError} />
                  </div>
                )}
                
                {isUploading && (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    <span>Vos fichiers sont en cours de traitement, veuillez rester sur la page jusqu'à la redirection.</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
      </div> 

      {/* Modals */}
      <ErrorModal
        message={error || ''}
        onClose={handleCloseError}
        isOpen={!!error}
      />
      
      <ConsentModal
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        isOpen={showConsent}
      />

      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl mx-4 relative">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <h3 className="text-2xl font-bold mb-4">Comment obtenir votre archive Twitter ?</h3>
            <div className="space-y-4 text-gray-600">
              <p>Pour obtenir votre archive Twitter, suivez ces étapes :</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Connectez-vous à votre compte Twitter</li>
                <li>Allez dans "Plus" dans le menu de gauche</li>
                <li>Cliquez sur "Paramètres et support" puis "Paramètres et confidentialité"</li>
                <li>Dans "Votre compte", sélectionnez "Télécharger une archive de vos données"</li>
                <li>Confirmez votre mot de passe si demandé</li>
                <li>Cliquez sur "Demander l'archive"</li>
                <li>Twitter vous enverra un e-mail lorsque votre archive sera prête à être téléchargée</li>
                <li>Une fois téléchargée, vous pourrez importer le fichier .zip ici</li>
              </ol>
              <p className="mt-4 text-sm text-gray-500">Note : La préparation de l'archive par Twitter peut prendre jusqu'à 24 heures.</p>
            </div>
          </div>
        </div>
      )}
     <Footer />
    </div>
  );
}

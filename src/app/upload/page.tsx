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

  const validateJsonFormat = (content: string, type: 'follower' | 'following'): boolean => {
    try {
      console.log(`🔍 Validating ${type}.js content structure`);
      
      // Vérifier le préfixe attendu
      const expectedPrefix = `window.YTD.${type}.part0 = `;
      if (!content.trim().startsWith(expectedPrefix)) {
        console.log(`❌ Invalid prefix for ${type}.js`);
        console.log(`Expected: "${expectedPrefix}"`);
        console.log(`Actual: "${content.trim().substring(0, 50)}..."`);
        return false;
      }
      console.log(`✅ Valid prefix found for ${type}.js`);

      // Nettoyer et parser le JSON
      const cleanedContent = content.replace(expectedPrefix, '');
      console.log(`🧹 Cleaned content length: ${cleanedContent.length} characters`);
      console.log(`🧹 First 100 characters of cleaned content:`, cleanedContent.substring(0, 100));
      
      const data = JSON.parse(cleanedContent);
      console.log(`📦 Parsed JSON data:`, {
        type: typeof data,
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A',
        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : null
      });
      
      if (!Array.isArray(data)) {
        console.log(`❌ Content is not an array in ${type}.js`);
        console.log(`Type received: ${typeof data}`);
        return false;
      }
      
      // Vérifier la structure des données
      let invalidItems = [];
      const isValid = data.every((item, index) => {
        // Extraire les données imbriquées
        const userData = item[type];
        
        // Log de la structure de l'item
        console.log(`📝 Checking item ${index} structure:`, {
          hasTypeKey: type in item,
          userData,
          actualKeys: userData ? Object.keys(userData) : []
        });

        const itemValid = (
          typeof item === 'object' &&
          item !== null &&
          type in item &&
          typeof userData === 'object' &&
          userData !== null &&
          typeof userData.accountId === 'string' &&
          typeof userData.userLink === 'string'
        );
        
        if (!itemValid) {
          invalidItems.push({
            index,
            item,
            issues: {
              notObject: typeof item !== 'object',
              isNull: item === null,
              missingTypeKey: !(type in item),
              invalidUserData: !userData || typeof userData !== 'object',
              invalidAccountId: userData && typeof userData.accountId !== 'string',
              invalidUserLink: userData && typeof userData.userLink !== 'string'
            }
          });
        }
        return itemValid;
      });

      if (!isValid) {
        console.log(`❌ Invalid data structure in ${type}.js`);
        console.log('Detailed issues with invalid items:', invalidItems);
      } else {
        console.log(`✅ All ${data.length} items in ${type}.js are valid`);
      }

      return isValid;
    } catch (error) {
      console.log(`❌ JSON parsing error in ${type}.js:`, error);
      console.log('Content causing error:', content.substring(0, 200));
      return false;
    }
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

  const processFiles = async (files: FileList) => {
    try {
      console.log('🔄 Starting file processing', {
        numberOfFiles: files.length,
        files: Array.from(files).map(f => ({
          name: f.name,
          type: f.type,
          size: f.size
        }))
      });

      // 1. Validation initiale des fichiers
      console.log('🔍 Validating files...');
      const validationError = validateFiles(files);
      if (validationError) {
        console.log('❌ File validation failed:', validationError);
        throw new Error(validationError);
      }
      console.log('✅ Initial file validation passed');

      // 2. Vérification du type MIME
      console.log('🔍 Checking MIME types...');
      for (const file of Array.from(files)) {
        if (!validateFileType(file)) {
          console.log('❌ Invalid MIME type:', file.type, 'for file:', file.name);
          throw new Error(`Invalid file type for ${file.name}. Only .js and .zip files are allowed.`);
        }
      }
      console.log('✅ MIME type validation passed');

      let processedFiles: ExtractedFile[] = [];
      let fileCounts = {
        follower: 0,
        following: 0
      };

      // 3. Traitement des fichiers
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        console.log('📦 Processing ZIP file:', files[0].name);
        processedFiles = await extractTargetFiles(files[0]);
        console.log('📂 Extracted files:', processedFiles.map(f => f.name));
        
        if (processedFiles.length === 0) {
          console.log('❌ No valid files found in ZIP archive');
          throw new Error('No valid files found in ZIP archive');
        }
      } else {
        console.log('📑 Processing direct JS files');
        processedFiles = await Promise.all(
          Array.from(files).map(async (file) => {
            console.log(`📄 Processing ${file.name}...`);
            return {
              name: file.name,
              content: new Uint8Array(await file.arrayBuffer())
            };
          })
        );
      }

      // 4. Validation et sanitisation du contenu
      console.log('🔍 Validating file contents...');
      const formData = new FormData();
      for (const { name, content } of processedFiles) {
        console.log(`\n📄 Processing ${name}...`);
        const textContent = new TextDecoder().decode(content);
        const type = name.toLowerCase().includes('following') ? 'following' : 'follower';
        
        console.log(`🔍 Validating Twitter data format for ${name}`);
        const validationError = validateTwitterData(textContent, type);
        if (validationError) {
          console.log('❌ Twitter data validation failed:', validationError);
          throw new Error(`Invalid Twitter data in ${name}: ${validationError}`);
        }
        console.log(`✅ Twitter data validation passed for ${name}`);

        // Compter le nombre d'objets
        const cleanedContent = textContent.replace(`window.YTD.${type}.part0 = `, '');
        const data = JSON.parse(cleanedContent);
        fileCounts[type] = data.length;
        console.log(`📊 Found ${data.length} items in ${name}`);

        console.log(`🧹 Sanitizing content for ${name}`);
        const sanitizedContent = sanitizeContent(content);
        console.log(`✅ Content sanitized for ${name}`);

        const fileName = type === 'following' ? 'following.js' : 'follower.js';
        formData.append('files', new Blob([sanitizedContent], { 
          type: 'application/javascript' 
        }), fileName);
        
        // Ajouter les comptages au FormData
        formData.append(`${type}Count`, data.length.toString());
        console.log(`✅ File ${fileName} added to FormData with ${data.length} items`);
      }

      // 5. Envoi au serveur
      console.log('📤 Sending files to server...');
      const response = await fetch('/api/upload/large-files', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ Server response error:', errorData);
        throw new Error(errorData.error || 'Failed to upload files');
      }

      const { jobId } = await response.json();
      console.log('✅ Upload successful, job ID:', jobId);
      router.push(`/upload/large-files?jobId=${jobId}&followerCount=${fileCounts.follower}&followingCount=${fileCounts.following}`);

    } catch (error) {
      // console.error('❌ Error processing files:', error);
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

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import seaBackground from '../../../../public/sea-wave.svg';
import ErrorModal from "../../_components/modales/ErrorModal";
import ConsentModal from "../../_components/modales/ConsentModal";
import Header from '../../_components/layouts/Header';
import * as zip from '@zip.js/zip.js';
import { validateTwitterData, extractTargetFiles } from '../../_components/uploads/UploadButton';
import Image from 'next/image';
// import seaBackground from '../../../public/sea.svg'
import { plex } from '../../fonts/plex';
import { motion } from 'framer-motion';
import { AlertCircle, Play } from 'lucide-react';
import boat1 from '../../../public/boats/boat-1.svg'
import Footer from "@/app/_components/layouts/Footer";
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import SupportModal from '../../_components/modales/SupportModale';
import logo from '../../../../public/logo/logo-openport-blanc.svg';

const UploadButton = dynamic(() => import('../../_components/uploads/UploadButton'), {
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
  const params = useParams();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const t = useTranslations('upload');
  const tuto = useTranslations('dashboard.tutorial');
  const tSupport = useTranslations('support');

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
      return t('errors.fileSize');
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['.zip', '.js'].includes(extension)) {
      return t('errors.fileType');
    }

    return null;
  };

  const validateFiles = (files: FileList): string | null => {
    // console.log('🔍 Validating files...', {
    //   numberOfFiles: files.length,
    //   fileNames: Array.from(files).map(f => f.name)
    // });

    if (files.length === 0) {
      return t('errors.noFiles');
    }

    // Check if it's a single ZIP file
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      // console.log('📦 ZIP file detected');
      return validateFile(files[0]);
    }

    const fileArray = Array.from(files);
    const fileNames = fileArray.map(f => f.name.toLowerCase());

    // Check if all files are .js
    if (!fileNames.every(name => name.endsWith('.js'))) {
      return 'All files must be .js files';
    }

    // console.log('📄 Analyzing JS files:', fileNames);

    // Case 1: Standard case (following.js + follower.js)
    const hasStandardFollowing = fileNames.includes('following.js');
    const hasStandardFollower = fileNames.includes('follower.js');

    // Case 2: Split files case
    const followerParts = fileArray.filter(f => /follower-part\d+\.js/.test(f.name.toLowerCase()));
    const followingParts = fileArray.filter(f => /following-part\d+\.js/.test(f.name.toLowerCase()));
    const hasSplitFollower = followerParts.length > 0;
    const hasSplitFollowing = followingParts.length > 0;

    // console.log('📊 Files status:', {
    //   hasStandardFollowing,
    //   hasStandardFollower,
    //   followerParts: followerParts.length > 0 ? followerParts.map(f => f.name) : 'none',
    //   followingParts: followingParts.length > 0 ? followingParts.map(f => f.name) : 'none'
    // });

    // Check file sizes in all cases
    for (const file of files) {
      const sizeError = validateFile(file);
      if (sizeError) return sizeError;
    }

    // Validate combinations
    if (hasStandardFollowing && hasStandardFollower && files.length === 2) {
      // console.log('✅ Standard case validated');
      return null;
    } else if (hasSplitFollower && hasSplitFollowing) {
      // console.log('✅ Split files case validated (both)');
      return null;
    } else if (hasStandardFollowing && hasSplitFollower) {
      // console.log('✅ Split files case validated (follower only)');
      return null;
    } else if (hasSplitFollowing && hasStandardFollower) {
      // console.log('✅ Split files case validated (following only)');
      return null;
    }

    // console.log('❌ Invalid file combination');
    return t('errors.invalidCombination');
  };

  const validateFileType = (file: File): boolean => {
    // console.log("File Type =", file.type)
    const validTypes = [
      'application/javascript',
      'text/javascript',
      'application/zip',
      'application/x-javascript',
      'text/ecmascript',
      'application/ecmascript',
      'application/x-ecmascript',
      'text/x-javascript',
      'text/jsx',
      'text/plain',
      'module',
      'application/x-zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'multipart/x-zip'
    ];
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
    // console.log(`🔄 Fusion des fichiers ${type}:`, files.map(f => f.name));

    // Trier les fichiers par numéro de part
    const sortedFiles = files.sort((a, b) => {
      const numA = parseInt(a.name.match(/part(\d+)/)?.[1] || '0');
      const numB = parseInt(b.name.match(/part(\d+)/)?.[1] || '0');
      return numA - numB;
    });

    // console.log('📋 Ordre de traitement:', sortedFiles.map(f => f.name));

    // Extraire et fusionner les données
    let mergedContent = '';
    let totalCount = 0;

    sortedFiles.forEach((file, index) => {
      const isLast = index === sortedFiles.length - 1;
      const text = new TextDecoder().decode(file.content);
      // console.log(`📖 Traitement de ${file.name}...`);

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
      // console.log(`📊 ${file.name}: ${objectCount} objets trouvés`);
      totalCount += objectCount;

      // Ajouter une virgule entre les fichiers (sauf pour le premier morceau)
      if (index > 0 && content.trim()) {
        mergedContent += ',';
      }

      mergedContent += content;
    });

    // console.log(`📊 Total ${type}: ${totalCount} entrées`);

    // Recréer le contenu avec le bon préfixe
    const finalContent = `window.YTD.${type}.part0 = [${mergedContent}`;
    return {
      content: new TextEncoder().encode(finalContent),
      count: totalCount
    };
  };

  const processFiles = async (files: FileList) => {
    try {
      // console.log('🔄 Starting file processing', {
      //   numberOfFiles: files.length,
      //   files: Array.from(files).map(f => ({ name: f.name, size: f.size }))
      // });

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
        // console.log('🔄 Fusion des fichiers follower...');
        const { content, count } = mergePartFiles(followerParts, 'follower');

        // Valider le contenu fusionné
        const textContent = new TextDecoder().decode(content);
        const validationError = validateTwitterData(textContent, 'follower');
        if (validationError) {
          throw new Error(`Invalid follower data: ${validationError}`);
        }

        formData.append(
          'files',
          new Blob(
            [content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer],
            { type: 'application/javascript' }
          ),
          'follower.js'
        );
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
          const ab = followerFile.content.buffer.slice(
            followerFile.content.byteOffset,
            followerFile.content.byteOffset + followerFile.content.byteLength
          ) as ArrayBuffer;
          
          formData.append('files', new Blob([ab], { type: 'application/javascript' }), 'follower.js');          fileCounts.follower = (textContent.match(/"follower"\s*:/g) || []).length;
        }
      }

      // Traiter les fichiers following (même logique)
      if (followingParts.length > 0) {
        // console.log('� Fusion des fichiers following...');
        const { content, count } = mergePartFiles(followingParts, 'following');

        const textContent = new TextDecoder().decode(content);
        const validationError = validateTwitterData(textContent, 'following');
        if (validationError) {
          throw new Error(`Invalid following data: ${validationError}`);
        }

        const ab = content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength
        ) as ArrayBuffer;
        
        formData.append('files', new Blob([ab], { type: 'application/javascript' }), 'following.js');        fileCounts.following = count;
      } else {
        const followingFile = processedFiles.find(f => f.name.toLowerCase() === 'following.js');
        if (followingFile) {
          const textContent = new TextDecoder().decode(followingFile.content);
          const validationError = validateTwitterData(textContent, 'following');
          if (validationError) {
            throw new Error(`Invalid following data: ${validationError}`);
          }
          const ab2 = followingFile.content.buffer.slice(
            followingFile.content.byteOffset,
            followingFile.content.byteOffset + followingFile.content.byteLength
          ) as ArrayBuffer;
          
          formData.append('files', new Blob([ab2], { type: 'application/javascript' }), 'following.js');          fileCounts.following = (textContent.match(/"following"\s*:/g) || []).length;
        }
      }

      // Envoi au serveur...
      // console.log('📤 Envoi au serveur...', {
      //   followerCount: fileCounts.follower,
      //   followingCount: fileCounts.following
      // });

      const response = await fetch('/api/upload/large-files', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload files');
      }

      const { jobId } = await response.json();
      const locale = params.locale as string || 'fr';
      router.push(`/${locale}/upload/large-files?jobId=${jobId}&followerCount=${fileCounts.follower}&followingCount=${fileCounts.following}`);
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
    // Convertir FileList en Array pour un meilleur logging
    const filesArray = Array.from(files);

    console.log('📁 Files selected:', {
      numberOfFiles: files.length,
      firstFileName: files[0]?.name,
      firstFileType: files[0]?.type,
      firstFileSize: `${(files[0]?.size / (1024 * 1024)).toFixed(2)}MB`,
      allFiles: filesArray.map(f => ({
        name: f.name,
        type: f.type,
        size: `${(f.size / (1024 * 1024)).toFixed(2)}MB`,
        rawSize: f.size
      }))
    });

    // Vérifications préalables
    if (!files || files.length === 0) {
      console.log('❌ Erreur: Aucun fichier sélectionné');
      setError('Aucun fichier sélectionné');
      return;
    }

    // Vérifier la taille de chaque fichier individuellement
    for (const file of filesArray) {
      console.log('📊 Vérification taille fichier:', {
        fileName: file.name,
        fileType: file.type,
        size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        maxSize: `${(MAX_FILE_SIZE / (1024 * 1024))}MB`,
        isOverLimit: file.size > MAX_FILE_SIZE
      });

      if (file.size > MAX_FILE_SIZE) {
        console.log('❌ Erreur: Fichier trop volumineux');
        setError(t('errors.fileSize'));
        return;
      }
    }

    // Vérifier les types de fichiers
    const fileTypes = filesArray.map(f => ({
      name: f.name,
      type: f.type,
      isValid: f.type.startsWith('image/') || f.type.includes('zip')
    }));
    console.log('🔍 Vérification des types:', fileTypes);

    // for (const file of filesArray) {
    //   if (!file.type.startsWith('image/') && !file.type.includes('zip')) {
    //     console.log('❌ Erreur: Type de fichier invalide', {
    //       fileName: file.name,
    //       fileType: file.type
    //     });
    //     setError(`Le fichier ${file.name} n'est pas une image ou une archive ZIP`);
    //     return;
    //   }
    // }

    console.log('✅ Toutes les vérifications sont passées, affichage de la modale de consentement');
    // Si toutes les vérifications sont passées, stocker les fichiers et afficher la modale
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
    }
  };

  if (isLoading || isUploading) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator
                msg={isUploading ? t('loading-uploading') : t('loading-indic')}
                textSize="base"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full bg-[#2a39a9]">
      <Image src={seaBackground} fill alt="" className="object-cover"></Image>
      <Header />
      <div className="relative z-10">
        <Image
          src={logo}
          alt={t('logo.alt')}
          width={400}
          height={200}
          className="mx-auto"
          priority
        />
      </div>

      <div className="flex justify-center items-center bg-[#2a39a9] p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/20 backdrop-blur-sm rounded-xl p-8 max-w-2xl w-full mx-auto relative"
        >

          <div className="text-center text-white p-4">
            <h2 className={`${plex.className} text-2xl font-bold mb-6`}>
              {t('title')}
            </h2>
            <h2 className={`${plex.className} text-1xl font-bold mb-6`}>
              {t('action')}
            </h2>
            <div className="space-y-4">
              <p className={`${plex.className} text-white whitespace-pre-line text-left mb-6`}>
                {t('description')}
              </p>

              {!isUploading && (
                <div className="space-y-4">
                  <UploadButton
                    onFilesSelected={handleFilesSelected}
                    onError={handleUploadError}
                    onUploadComplete={() => {}}
                  />
                </div>
              )}

              {isUploading && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  <p className="text-white">{t('uploading')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4  max-w-2xl  relative">
            <h3 className={`${plex.className} text-xl font-bold mb-4 text-white text-center text-white`}>{t('helpModal.title')}</h3>
            <div className={`${plex.className} text-justify text-white`}>
              <p>{t('helpModal.description')}</p>
              <ol className="list-decimal list-inside space-y-2 text-white">
                {t.raw('helpModal.steps').map((step: string, index: number) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <p className="mt-4 text-sm text-white">{t('helpModal.note')}</p>
            </div>
          </div>


          {!isUploading && (
                <div className="space-y-4 mt-12 ">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowSupportModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-[#2a39a9] rounded-xl text-white"
                  >
                    <AlertCircle className="w-5 h-5" />
                    <span className={plex.className}>{tSupport('modal.title')}</span>
                  </motion.button>
                </div>
              )}
          
        

        </motion.div>
        

        {/* Modal de Support */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
        />

        {/* </motion.div> */}

        {/* <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowSupportModal(true)}
        className="fixed bottom-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-full p-3 text-white shadow-lg flex items-center gap-2"
      >
        <AlertCircle className="w-5 h-5" />
        <span>{tSupport('button')}</span>
      </motion.button> */}

        {/* Modal de Support */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
        />
      </div>

      {/* Modals */}
      <ErrorModal
        message={error || ''}
        onClose={handleCloseError}
        isOpen={!!error}
        showExtractInstructions={error?.toLowerCase().includes('1 go') || error?.toLowerCase().includes('1gb')}
      />

      <ConsentModal
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        isOpen={showConsent}
      />

      {/* {showHelpModal && (
        // <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        // </div>
      )} */}

      <div className="flex flex-col items-center text-center space-y-4 bg-[#2a39a9] p-12">
        <h3 className={`${plex.className} text-2xl font-medium text-white `}>
          {tuto('title')}
        </h3>
        <motion.a
          href="https://vimeo.com/1044334098?share=copy"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-3 text-indigo-200 hover:text-white transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Play className="w-5 h-5" />
          <span className={`${plex.className} text-lg underline decoration-indigo-500`}>{tuto('watchVideo')}</span>

        </motion.a>
      </div>
      <Footer />
    </div>
  );
}

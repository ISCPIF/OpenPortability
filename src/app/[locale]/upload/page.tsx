'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ErrorModal from "../../_components/modales/ErrorModal";
import ConsentModal from "../../_components/modales/ConsentModal";
import Header from '../../_components/layouts/Header';
import { validateTwitterData, extractTargetFiles } from '../../_components/uploads/UploadButton';
import Image from 'next/image';
import { quantico } from '../../fonts/plex';
import { motion } from 'framer-motion';
import { AlertCircle, Play, Upload, HelpCircle, Activity } from 'lucide-react';
import Footer from "@/app/_components/layouts/Footer";
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import SupportModal from '../../_components/modales/SupportModale';
import logoBlanc from '../../../../public/logo/logo-openport-blanc.svg';
import logoRose from '../../../../public/logos/logo-openport-rose.svg';
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground';
import { useTheme } from '@/hooks/useTheme';
import { useCommunityColors } from '@/hooks/useCommunityColors';

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
  const tLoaders = useTranslations('loaders');
  const { colors, isDark } = useTheme();
  const { colors: communityColors } = useCommunityColors();
  
  // Contrast color for loaders based on theme and palette
  const contrastColor = isDark 
    ? (communityColors[9] || communityColors[8] || '#fad541')
    : (communityColors[0] || communityColors[1] || '#011959');

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
    if (session?.user?.has_onboarded) {
      router.replace("/reconnect");
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
    if (files.length === 0) {
      return t('errors.noFiles');
    }

    // Check if it's a single ZIP file
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      return validateFile(files[0]);
    }

    const fileArray = Array.from(files);
    const fileNames = fileArray.map(f => f.name.toLowerCase());

    // Check if all files are .js
    if (!fileNames.every(name => name.endsWith('.js'))) {
      return 'All files must be .js files';
    }


    // Case 1: Standard case (following.js + follower.js)
    const hasStandardFollowing = fileNames.includes('following.js');
    const hasStandardFollower = fileNames.includes('follower.js');

    // Case 2: Split files case
    const followerParts = fileArray.filter(f => /follower-part\d+\.js/.test(f.name.toLowerCase()));
    const followingParts = fileArray.filter(f => /following-part\d+\.js/.test(f.name.toLowerCase()));
    const hasSplitFollower = followerParts.length > 0;
    const hasSplitFollowing = followingParts.length > 0;

    // Check file sizes in all cases
    for (const file of files) {
      const sizeError = validateFile(file);
      if (sizeError) return sizeError;
    }

    // Validate combinations
    if (hasStandardFollowing && hasStandardFollower && files.length === 2) {
      return null;
    } else if (hasSplitFollower && hasSplitFollowing) {
      return null;
    } else if (hasStandardFollowing && hasSplitFollower) {
      return null;
    } else if (hasSplitFollowing && hasStandardFollower) {
      return null;
    }

    return t('errors.invalidCombination');
  };

  const validateFileType = (file: File): boolean => {
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

    // Trier les fichiers par numéro de part
    const sortedFiles = files.sort((a, b) => {
      const numA = parseInt(a.name.match(/part(\d+)/)?.[1] || '0');
      const numB = parseInt(b.name.match(/part(\d+)/)?.[1] || '0');
      return numA - numB;
    });
    // Extraire et fusionner les données
    let mergedContent = '';
    let totalCount = 0;

    sortedFiles.forEach((file, index) => {
      const isLast = index === sortedFiles.length - 1;
      const text = new TextDecoder().decode(file.content);

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
      totalCount += objectCount;

      // Ajouter une virgule entre les fichiers (sauf pour le premier morceau)
      if (index > 0 && content.trim()) {
        mergedContent += ',';
      }

      mergedContent += content;
    });
    // Recréer le contenu avec le bon préfixe
    const finalContent = `window.YTD.${type}.part0 = [${mergedContent}`;
    return {
      content: new TextEncoder().encode(finalContent),
      count: totalCount
    };
  };

  const processFiles = async (files: FileList) => {
    try {

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
    console.error('❌ Upload error:', errorMessage);
    setError(errorMessage);
    setIsUploading(false);
    setPendingFiles(null);
    setShowConsent(false);
  };

  const handleCloseError = () => {
    console.error('🔄 Closing error');
    setError(null);
  };

  const handleFilesSelected = (files: FileList) => {
    // Convertir FileList en Array pour un meilleur logging
    const filesArray = Array.from(files);

    // Vérifications préalables
    if (!files || files.length === 0) {
      console.error('❌ Erreur: Aucun fichier sélectionné');
      setError('Aucun fichier sélectionné');
      return;
    }

    // Vérifier la taille de chaque fichier individuellement
    for (const file of filesArray) {


      if (file.size > MAX_FILE_SIZE) {
        console.error('❌ Erreur: Fichier trop volumineux');
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

    // Si toutes les vérifications sont passées, stocker les fichiers et afficher la modale
    setPendingFiles(files);
    setShowConsent(true);
  };

  const handleConsentDecline = () => {
    console.error('❌ Consent declined');
    setPendingFiles(null);
    setShowConsent(false);
  };

  const handleConsentAccept = async () => {

    if (!pendingFiles || pendingFiles.length === 0) {
      console.error('❌ No files to process');
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
      <div 
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <ParticulesBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <LoadingIndicator
            msg={isUploading ? tLoaders('uploading') : tLoaders('upload')}
            textSize="base"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: colors.background }}>
      <ParticulesBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main className={`${quantico.className} flex-1 flex flex-col items-center px-4 py-8`}>
          
          {/* Main Panel - Graph style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full max-w-xl backdrop-blur-sm rounded-xl border shadow-xl overflow-hidden ${
              isDark 
                ? 'bg-slate-900/95 border-slate-700/50' 
                : 'bg-white/90 border-slate-200'
            }`}
          >
            {/* Header */}
            <div className={`px-6 pt-6 pb-4 border-b ${
              isDark ? 'border-slate-700/50' : 'border-slate-200'
            }`}>
              <Image
                src={isDark ? logoBlanc : logoRose}
                alt={t('logo.alt')}
                width={160}
                height={48}
                className="mx-auto mb-4 h-auto w-32 sm:w-40"
                priority
              />
              <div className="flex items-center justify-center gap-2 mb-2">
                <Upload className="w-5 h-5 text-amber-400" />
                <h2 className={`text-base sm:text-lg font-semibold tracking-wide ${
                  isDark ? 'text-white' : 'text-slate-800'
                }`}>
                  {t('title')}
                </h2>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Activity className={`w-3 h-3 ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`} />
                <span className={`text-[10px] uppercase tracking-wider ${
                  isDark ? 'text-emerald-500' : 'text-emerald-600'
                }`}>
                  {t('action')}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Description */}
              <p className={`text-[13px] leading-relaxed whitespace-pre-line ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}>
                {t('description')}
              </p>

              {/* Upload button */}
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
                <div className="flex items-center justify-center gap-3 py-4">
                  <div 
                    className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" 
                    style={{ borderColor: contrastColor, borderTopColor: 'transparent' }}
                  />
                  <p className={`text-[13px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('uploading')}</p>
                </div>
              )}

              {/* Help section */}
              <div className={`rounded-lg border p-4 space-y-3 ${
                isDark 
                  ? 'bg-slate-800/50 border-slate-700/30' 
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-400" />
                  <h3 className={`text-[13px] font-semibold ${
                    isDark ? 'text-white' : 'text-slate-800'
                  }`}>
                    {t('helpModal.title')}
                  </h3>
                </div>
                <div className={`text-[12px] leading-relaxed space-y-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  <p>{t('helpModal.description')}</p>
                  <ol className={`list-decimal list-inside space-y-1 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {t.raw('helpModal.steps').map((step: string, index: number) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('helpModal.note')}</p>
                </div>
              </div>

              {/* Support button */}
              {!isUploading && (
                <button
                  onClick={() => setShowSupportModal(true)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-[12px] transition-all ${
                    isDark 
                      ? 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/30 text-slate-300 hover:text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>{tSupport('modal.title')}</span>
                </button>
              )}
            </div>
          </motion.div>

          {/* Tutorial Panel - Graph style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`w-full max-w-xl mt-6 backdrop-blur-sm rounded-xl border shadow-xl overflow-hidden ${
              isDark 
                ? 'bg-slate-900/95 border-slate-700/50' 
                : 'bg-white/90 border-slate-200'
            }`}
          >
            <div className="px-6 py-5 flex flex-col items-center text-center space-y-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-purple-400" />
                <h3 className={`text-[13px] font-semibold ${
                  isDark ? 'text-white' : 'text-slate-800'
                }`}>
                  {tuto('title')}
                </h3>
              </div>
              <motion.a
                href="https://vimeo.com/1044334098?share=copy"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 py-2 px-4 rounded-lg border text-[12px] transition-all ${
                  isDark 
                    ? 'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/30 text-purple-300 hover:text-purple-200' 
                    : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-600 hover:text-purple-700'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play className="w-4 h-4" />
                <span className="font-medium">{tuto('watchVideo')}</span>
              </motion.a>
            </div>
          </motion.div>

          <SupportModal
            isOpen={showSupportModal}
            onClose={() => setShowSupportModal(false)}
          />
        </main>

        <Footer />
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
    </div>
  );
}

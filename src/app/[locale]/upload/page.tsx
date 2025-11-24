'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import Footer from "@/app/_components/layouts/Footer";
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import SupportModal from '../../_components/modales/SupportModale';
import logoBlanc from '../../../../public/logo/logo-openport-blanc.svg';
import logoRose from '../../../../public/logos/logo-openport-rose.svg';
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/app/_components/ui/Button';

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
  const { colors, isDark } = useTheme();
  const headingColor = isDark ? 'text-white' : 'text-slate-900';
  const accentColor = isDark ? 'text-indigo-200' : 'text-indigo-700';
  const secondaryTextColor = isDark ? 'text-white/80' : 'text-slate-700';
  const helpPanelClasses = isDark
    ? 'bg-white/5 border-white/10 text-white'
    : 'bg-slate-50 border-slate-200 text-slate-900';
  const primaryAccent = '#ff007f';
  const supportButtonShadow = isDark
    ? '0 0 15px rgba(255, 0, 127, 0.4), inset 0 0 12px rgba(255, 0, 127, 0.18)'
    : '0 0 12px rgba(255, 0, 127, 0.24), inset 0 0 10px rgba(255, 0, 127, 0.08)';
  const tutorialSectionClasses = isDark
    ? 'bg-gradient-to-b from-slate-950/95 via-slate-900/85 to-slate-950/95 border-white/10 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)]'
    : 'bg-gradient-to-b from-white via-slate-50 to-white border-slate-200 text-slate-900 shadow-[0_30px_70px_rgba(15,23,42,0.15)]';
  const tutorialLinkClasses = isDark
    ? 'text-white hover:text-[#ff007f]'
    : 'text-indigo-700 hover:text-pink-600';

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
    if (session?.user?.has_onboarded) {
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
        className="relative min-h-screen w-full"
        style={{ backgroundColor: colors.background }}
      >
        <ParticulesBackground />
        <div className="relative z-10 container mx-auto py-12">
          <div className="flex flex-col text-center text-[#E2E4DF]">
            <div className="m-auto my-32 lg:my-40">
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
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: colors.background }}
    >
      <ParticulesBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex flex-col">
          <div className="relative z-10">
            <Image
              src={isDark ? logoBlanc : logoRose}
              alt={t('logo.alt')}
              width={400}
              height={200}
              className="mx-auto"
              priority
            />
          </div>

          <div className="px-6 text-center mt-8 space-y-3">
            <h2 className={`${plex.className} text-3xl sm:text-4xl font-bold ${headingColor}`}>
              {t('title')}
            </h2>
            <p className={`${plex.className} text-base sm:text-lg font-semibold tracking-[0.4em] uppercase ${accentColor}`}>
              {t('action')}
            </p>
          </div>

          <div className="flex justify-center items-center p-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`w-full max-w-3xl mx-auto rounded-3xl border-2 p-8 backdrop-blur-xl shadow-lg transition-[box-shadow] duration-300 ${
                isDark
                  ? 'bg-slate-950/80 border-pink-500/30 shadow-[0_0_30px_rgba(255,0,127,0.25)]'
                  : 'bg-white/95 border-pink-500/20 shadow-[0_20px_45px_rgba(17,24,39,0.15)]'
              }`}
            >
              <div className="p-4">
                <div className="space-y-4">
                  <p className={`${plex.className} whitespace-pre-line text-left mb-6 text-base leading-relaxed ${secondaryTextColor}`}>
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
                    <div className="flex items-center justify-center space-x-2 text-white">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                      <p>{t('uploading')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 mt-6 ${helpPanelClasses}`}>
                <h3 className={`${plex.className} text-lg font-semibold mb-4 text-center uppercase tracking-[0.35em]`}>
                  {t('helpModal.title')}
                </h3>
                <div className={`${plex.className} text-sm leading-relaxed text-justify space-y-4`}>
                  <p>{t('helpModal.description')}</p>
                  <ol className="list-decimal list-inside space-y-2 text-left">
                    {t.raw('helpModal.steps').map((step: string, index: number) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                  <p className="text-xs opacity-80">{t('helpModal.note')}</p>
                </div>
              </div>

              {!isUploading && (
                <div className="space-y-4 mt-12">
                  <Button
                    onClick={() => setShowSupportModal(true)}
                    className={`${plex.className} w-full flex items-center justify-center gap-3 rounded-full border-2 px-8 py-4 uppercase tracking-[0.35em] transition-all duration-300`}
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: primaryAccent,
                      color: isDark ? '#ffffff' : '#111827',
                      boxShadow: supportButtonShadow
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.currentTarget.style.backgroundColor = primaryAccent;
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 0, 127, 0.55)';
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = isDark ? '#ffffff' : '#111827';
                      e.currentTarget.style.boxShadow = supportButtonShadow;
                    }}
                  >
                    <AlertCircle className="w-5 h-5" />
                    <span>{tSupport('modal.title')}</span>
                  </Button>
                </div>
              )}
            </motion.div>
          </div>

          <SupportModal
            isOpen={showSupportModal}
            onClose={() => setShowSupportModal(false)}
          />
        </main>

        <section className={`w-full max-w-3xl mx-auto flex flex-col items-center text-center space-y-4 p-12 rounded-3xl border-2 backdrop-blur-xl transition-all duration-300 ${tutorialSectionClasses}`}>
          <h3 className={`${plex.className} text-2xl font-semibold tracking-[0.4em] uppercase`}>
            {tuto('title')}
          </h3>
          <motion.a
            href="https://vimeo.com/1044334098?share=copy"
            target="_blank"
            rel="noopener noreferrer"
            className={`group inline-flex items-center gap-3 transition-colors ${tutorialLinkClasses}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play className="w-5 h-5" />
            <span className={`${plex.className} text-lg font-semibold tracking-[0.4em] uppercase`}>{tuto('watchVideo')}</span>
          </motion.a>
        </section>

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

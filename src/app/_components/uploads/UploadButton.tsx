'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import * as zip from '@zip.js/zip.js';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { plex } from '../../fonts/plex';
import { Button } from '@/app/_components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import {
  ExtractedFile,
  TwitterData,
  validateFile,
  validateFiles,
  validateTwitterData,
  sanitizeContent,
  mergePartFiles,
  normalizeFilePath,
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
  TARGET_FILES,
  REQUIRED_FILES
} from '@/lib/upload_utils';

interface UnzipProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'extracting' | 'done' | 'error';
  message?: string;
}

interface UploadButtonProps {
  onUploadComplete: (stats: { following: number; followers: number }) => void;
  onError: (error: string) => void;
  onFilesSelected: (files: FileList) => void;
  filesToProcess?: FileList | null;
}

const processFiles = async (files: FileList): Promise<{ name: string; content: Uint8Array }[]> => {
  // Validation des fichiers
  const validationError = validateFiles(files);
  if (validationError) {
    throw new Error(validationError);
  }

  // Convertir FileList en array pour manipulation
  const fileArray = Array.from(files);
  const fileNames = fileArray.map(f => f.name.toLowerCase());

  // Détecter les différents types de fichiers
  const followerParts = fileArray.filter(f => /follower-part\d+\.js/.test(f.name.toLowerCase()));
  const followingParts = fileArray.filter(f => /following-part\d+\.js/.test(f.name.toLowerCase()));
  const standardFollowingFile = fileArray.find(f => f.name.toLowerCase() === 'following.js');
  const standardFollowerFile = fileArray.find(f => f.name.toLowerCase() === 'follower.js');

  // Traiter les fichiers follower
  let followerData: any[] = [];
  if (followerParts.length > 0) {
    const extractedFiles: ExtractedFile[] = await Promise.all(
      followerParts.map(async file => ({
        name: file.name,
        content: new Uint8Array(await file.arrayBuffer())
      }))
    );
    const { content, count } = mergePartFiles(extractedFiles, 'follower');
    followerData = JSON.parse(new TextDecoder().decode(content).split('=')[1]);
  } else if (standardFollowerFile) {
    const content = await standardFollowerFile.text();
    const validationError = validateTwitterData(content, 'follower');
    if (validationError) throw new Error(validationError);
    followerData = JSON.parse(content.split('=')[1]);
  }

  // Traiter les fichiers following
  let followingData: any[] = [];
  if (followingParts.length > 0) {
    const extractedFiles: ExtractedFile[] = await Promise.all(
      followingParts.map(async file => ({
        name: file.name,
        content: new Uint8Array(await file.arrayBuffer())
      }))
    );
    const { content, count } = mergePartFiles(extractedFiles, 'following');
    followingData = JSON.parse(new TextDecoder().decode(content).split('=')[1]);
  } else if (standardFollowingFile) {
    const content = await standardFollowingFile.text();
    const validationError = validateTwitterData(content, 'following');
    if (validationError) throw new Error(validationError);
    followingData = JSON.parse(content.split('=')[1]);
  }

  // Créer les fichiers finaux
  const result: { name: string; content: Uint8Array }[] = [];

  if (followerData.length > 0) {
    const followerContent = `window.YTD.follower.part0 = ${JSON.stringify(followerData)}`;
    result.push({
      name: 'follower.js',
      content: sanitizeContent(new TextEncoder().encode(followerContent))
    });
  }

  if (followingData.length > 0) {
    const followingContent = `window.YTD.following.part0 = ${JSON.stringify(followingData)}`;
    result.push({
      name: 'following.js',
      content: sanitizeContent(new TextEncoder().encode(followingContent))
    });
  }

  return result;
};

export const extractTargetFiles = async (file: File): Promise<ExtractedFile[]> => {
  const zipReader = new zip.ZipReader(new zip.BlobReader(file));
  const entries = await zipReader.getEntries();
  
  const targetFiles: ExtractedFile[] = [];
  for (const entry of entries) {
    // Only process file entries (not directories) and ensure getData exists
    if (entry.directory) continue;
    const normalizedPath = normalizeFilePath(entry.filename);
    if (TARGET_FILES.includes(normalizedPath) && 'getData' in entry && typeof (entry as any).getData === 'function') {
      const raw = await (entry as any).getData(new zip.Uint8ArrayWriter());
      const content = new Uint8Array(raw);
      const name = normalizedPath.split('/').pop()!;
      targetFiles.push({ name, content });
    }
  }
  
  await zipReader.close();
  return targetFiles;
};

export { validateTwitterData };

const UploadButton = ({ onUploadComplete, onError, onFilesSelected, filesToProcess }: UploadButtonProps) => {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [unzipProgress, setUnzipProgress] = useState<UnzipProgress[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const maxRetries = 3;
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('uploadButton');
  const { isDark } = useTheme();

  useEffect(() => {
    const handleUnzipProgress = (event: CustomEvent<UnzipProgress[]>) => {
      setUnzipProgress(event.detail);
    };

    window.addEventListener('unzipProgress', handleUnzipProgress as EventListener);
    return () => {
      window.removeEventListener('unzipProgress', handleUnzipProgress as EventListener);
    };
  }, []);

  useEffect(() => {
    if (filesToProcess) {
      handleUpload(filesToProcess);
    }
  }, [filesToProcess]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Vérifie si on quitte vraiment la zone de drop
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX <= rect.left ||
        clientX >= rect.right ||
        clientY <= rect.top ||
        clientY >= rect.bottom
      ) {
        setIsDragging(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      onFilesSelected(files);
    }
  };

  const handleUpload = async (files: FileList) => {
    setIsUploading(true);
    setRetryCount(0);
    
    const tryProcess = async (): Promise<void> => {
      try {
        const extractedFiles = await processFiles(files);
        setIsUploading(false);
        onUploadComplete({
          following: extractedFiles.length,
          followers: extractedFiles.length
        });
      } catch (error) {
        console.error('Erreur de téléchargement :', error);
        
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          setRetryCount(prev => prev + 1);
          return tryProcess();
        } else {
          setIsUploading(false);
          onError('Le téléchargement a échoué après plusieurs tentatives. Veuillez réessayer.');
        }
      }
    };

    await tryProcess();
  };

  return (
    <div
      ref={dropZoneRef}
      className={`w-full max-w-md mx-auto ${plex.className} relative`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => {
          const files = e.target.files;
          if (files) {
            setSelectedFiles(files);
            onFilesSelected(files);
          }
        }}
        accept=".zip,.js"
        multiple
        className="hidden"
        id="file-upload"
      />
      <Button
        variant="outline"
        type="button"
        disabled={isUploading}
        onClick={() => {
          if (!isUploading) {
            fileInputRef.current?.click();
          }
        }}
        onMouseEnter={() => setIsHoveringButton(true)}
        onMouseLeave={() => setIsHoveringButton(false)}
        className={`w-full rounded-2xl border-2 px-8 py-8 text-xs sm:text-sm font-semibold tracking-[0.12em] uppercase flex items-center justify-center gap-3 transition-all duration-300 h-auto min-h-[4rem] ${
          isUploading ? 'opacity-70' : ''
        } ${isDragging ? 'ring-2 ring-white/60 ring-offset-2' : ''}`}
        style={{
          backgroundColor: isDark
            ? isHoveringButton
              ? '#ffffff'
              : 'transparent'
            : isHoveringButton
              ? '#1a1a1a'
              : '#000000',
          borderColor: isDark ? '#ffffff' : '#000000',
          color: isDark
            ? isHoveringButton
              ? '#000000'
              : '#ffffff'
            : '#ffffff',
          boxShadow: isDark
            ? isHoveringButton
              ? '0 0 30px #007bff, inset 0 0 20px rgba(0,123,255,0.3)'
              : '0 0 15px rgba(0,123,255,0.5), inset 0 0 15px rgba(0,123,255,0.1)'
            : isHoveringButton
              ? '0 0 30px rgba(0,0,0,0.6)'
              : '0 0 15px rgba(0,0,0,0.3)',
          fontFamily: 'monospace',
          transition: 'background-color 200ms ease, box-shadow 200ms ease, border-color 200ms ease, color 200ms ease'
        }}
      >
        <motion.span
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.985 }}
          className="flex w-full flex-wrap items-center justify-center gap-3 cursor-pointer text-center"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          <span className="w-full px-6 text-center text-[0.7rem] sm:text-sm leading-snug whitespace-normal break-words">
            {isUploading ? t('uploadInProgress') : t('clickOrDrop')}
          </span>
        </motion.span>
      </Button>

      {/* Overlay de drop */}
      {isDragging && (
        <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-pink-400/60 bg-pink-500/15 backdrop-blur-sm flex items-center justify-center z-20">
          <p className="text-white text-base font-medium uppercase tracking-[0.3em]">
            {t('dropHere')}
          </p>
        </div>
      )}

      {unzipProgress.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-3"
        >
          {unzipProgress.map((progress, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-2xl border p-4 backdrop-blur-lg ${
                isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white/90 border-slate-200'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-semibold tracking-[0.3em] uppercase ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                  {progress.fileName}
                </span>
                <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {progress.progress}%
                </span>
              </div>
              <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${
                    progress.status === 'error' ? 'bg-red-500' :
                    'bg-gradient-to-r from-pink-400 to-rose-500'
                  }`}
                />
              </div>
              {progress.message && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-400 mt-2"
                >
                  {progress.message}
                </motion.p>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default UploadButton;
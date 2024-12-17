'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import * as zip from '@zip.js/zip.js';
import { motion } from 'framer-motion';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { plex } from '../fonts/plex';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['.zip', '.js'];
const TARGET_FILES = ['data/following.js', 'data/follower.js'];
const REQUIRED_FILES = ['following.js', 'follower.js'];

interface ExtractedFile {
  name: string;
  content: Uint8Array;
}

interface UnzipProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'extracting' | 'done' | 'error';
  message?: string;
}

interface TwitterData {
  following?: {
    accountId: string;
    userLink: string;
  };
  follower?: {
    accountId: string;
    userLink: string;
  };
}

interface UploadButtonProps {
  onUploadComplete: (stats: { following: number; followers: number }) => void;
  onError: (error: string) => void;
  onFilesSelected: (files: FileList) => void;
  filesToProcess?: FileList | null;
}

const normalizeFilePath = (path: string): string => {
  return path.replace(/\\/g, '/').replace(/^\.?\/+/, '').toLowerCase();
};

export const validateTwitterData = (content: string, type: 'following' | 'follower'): string | null => {
  const prefix = `window.YTD.${type}.part0 = `;
  
  if (!content.startsWith(prefix)) {
    return `Invalid file format: ${type}.js must start with "${prefix}"`;
  }

  try {
    // Remove the prefix and parse the JSON
    const jsonStr = content.substring(prefix.length);
    const data = JSON.parse(jsonStr) as TwitterData[];

    // Validate each entry
    for (const entry of data) {
      const item = entry[type];
      if (!item) {
        return `Invalid ${type} data structure`;
      }

      const { accountId, userLink } = item;
      if (!accountId || !userLink) {
        return `Missing required fields in ${type} data`;
      }

      const expectedUserLink = `https://twitter.com/intent/user?user_id=${accountId}`;
      if (userLink !== expectedUserLink) {
        return `Invalid userLink format in ${type} data`;
      }
    }

    return null;
  } catch (error) {
    return `Invalid JSON in ${type}.js: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) {
    return 'File size exceeds 50MB limit';
  }

  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_TYPES.includes(extension)) {
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

export const extractTargetFiles = async (file: File): Promise<ExtractedFile[]> => {
  const reader = new zip.ZipReader(new zip.BlobReader(file));
  const entries = await reader.getEntries();
  const extractedFiles: ExtractedFile[] = [];
  const progressMap = new Map<string, UnzipProgress>();

  // Initialiser le statut pour chaque fichier cible
  TARGET_FILES.forEach(targetFile => {
    progressMap.set(targetFile, {
      fileName: targetFile,
      progress: 0,
      status: 'pending'
    });
  });

  try {
    for (const entry of entries) {
      const normalizedPath = normalizeFilePath(entry.filename);
      if (TARGET_FILES.includes(normalizedPath)) {
        progressMap.set(normalizedPath, {
          fileName: normalizedPath,
          progress: 0,
          status: 'extracting'
        });

        try {
          const uint8Array = await entry.getData!(new zip.Uint8ArrayWriter(), {
            onprogress: (current, total) => {
              const progress = Math.round((current / total) * 100);
              progressMap.set(normalizedPath, {
                fileName: normalizedPath,
                progress,
                status: 'extracting'
              });
              // Mettre à jour l'UI avec la progression
              window.dispatchEvent(new CustomEvent('unzipProgress', {
                detail: Array.from(progressMap.values())
              }));
            }
          });

          extractedFiles.push({
            name: normalizedPath,
            content: uint8Array
          });

          progressMap.set(normalizedPath, {
            fileName: normalizedPath,
            progress: 100,
            status: 'done'
          });
        } catch (error) {
          console.error(`Error extracting ${normalizedPath}:`, error);
          progressMap.set(normalizedPath, {
            fileName: normalizedPath,
            progress: 0,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        }
      }
    }
  } finally {
    await reader.close();
  }

  if (extractedFiles.length < TARGET_FILES.length) {
    throw new Error('Some required files were not found in the zip');
  }

  return extractedFiles;
};

export const processFiles = async (files: FileList): Promise<{ name: string; content: Uint8Array }[]> => {
  const processedFiles: { name: string; content: Uint8Array }[] = [];

  // If it's a ZIP file
  if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
    const extractedFiles = await extractTargetFiles(files[0]);
    if (extractedFiles.length === 0) {
      throw new Error('No valid files found in ZIP');
    }
    return extractedFiles;
  }

  // If it's direct file upload
  const fileNames = Array.from(files).map(f => f.name.toLowerCase());
  const missingFiles = REQUIRED_FILES.filter(required => 
    !fileNames.some(name => name.toLowerCase() === required.toLowerCase())
  );

  if (missingFiles.length > 0) {
    throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
  }

  // Process each file
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    processedFiles.push({
      name: file.name,
      content: new Uint8Array(arrayBuffer)
    });
  }

  return processedFiles;
};

export default function UploadButton({ onUploadComplete, onError, onFilesSelected, filesToProcess }: UploadButtonProps) {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [unzipProgress, setUnzipProgress] = useState<UnzipProgress[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const maxRetries = 3;

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
        console.error('Upload error:', error);
        
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          setRetryCount(prev => prev + 1);
          return tryProcess();
        } else {
          setIsUploading(false);
          onError('Upload failed after multiple attempts. Please try again.');
        }
      }
    };

    await tryProcess();
  };

  return (
    <div className={`w-full max-w-md mx-auto ${plex.className}`}>
      <input
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
      <motion.label
        htmlFor="file-upload"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          w-full px-6 py-4 flex items-center justify-center gap-3
          text-white font-semibold rounded-xl cursor-pointer
          bg-gradient-to-r from-blue-600 to-blue-800
          hover:from-blue-700 hover:to-blue-900
          shadow-lg hover:shadow-xl
          transition-all duration-300
          disabled:from-gray-400 disabled:to-gray-500 
          disabled:cursor-not-allowed
          ${isUploading ? 'pointer-events-none' : ''}
        `}
      >
        {isUploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Upload className="w-5 h-5" />
        )}
        {isUploading ? 'Processing...' : 'Select Twitter Archive'}
      </motion.label>

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
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-100">{progress.fileName}</span>
                <span className="text-sm font-medium">
                  {progress.status === 'done' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : progress.status === 'error' ? (
                    <XCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    `${Math.round(progress.progress)}%`
                  )}
                </span>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${
                    progress.status === 'error' ? 'bg-red-500' :
                    progress.status === 'done' ? 'bg-green-400' : 'bg-blue-500'
                  }`}
                />
              </div>
              {progress.message && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-400 mt-2"
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
}
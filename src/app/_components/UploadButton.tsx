'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import * as zip from '@zip.js/zip.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['.zip', '.js'];
const TARGET_FILES = ['data/following.js', 'data/follower.js'];
const REQUIRED_FILES = ['following.js', 'follower.js'];

interface ExtractedFile {
  name: string;
  content: Uint8Array;
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
  try {
    console.log('📦 Processing ZIP file...');
    
    const reader = new zip.ZipReader(new zip.BlobReader(file));
    const entries = await reader.getEntries();
    const extractedFiles: ExtractedFile[] = [];

    // Parcourir les entrées
    for (const entry of entries) {
      const normalizedPath = normalizeFilePath(entry.filename);
      
      // Vérifier si le fichier correspond à un des fichiers cibles
      if (TARGET_FILES.some(target => normalizedPath.endsWith(normalizeFilePath(target)))) {
        console.log('✨ Found target file:', entry.filename);
        
        // Lire le contenu du fichier
        const uint8Array = await entry.getData!(new zip.Uint8ArrayWriter());
        const fileName = entry.filename.split('/').pop() || '';
        
        extractedFiles.push({
          name: fileName,  // On ne garde que le nom du fichier, pas le chemin complet
          content: uint8Array
        });
      }
    }

    await reader.close();

    console.log('✅ Extraction complete:', extractedFiles.length, 'files found');
    return extractedFiles;

  } catch (error) {
    console.error('❌ Extraction error:', error);
    throw error;
  }
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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quand on reçoit des fichiers à traiter (après consentement)
  useEffect(() => {
    if (filesToProcess) {
      handleProcessFiles(filesToProcess);
    }
  }, [filesToProcess]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFilesSelected(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProcessFiles = async (files: FileList) => {
    setIsUploading(true);
    setError(null);

    try {
      if (!session?.user?.id) {
        throw new Error('You must be logged in to upload files');
      }

      const processedFiles = await processFiles(files);
      
      if (processedFiles.length === 0) {
        throw new Error('No valid files found');
      }

      console.log('📤 Preparing upload...');
      const formData = new FormData();
      
      for (const { name, content } of processedFiles) {
        const textContent = new TextDecoder().decode(content);
        
        const type = name.toLowerCase().includes('following') ? 'following' : 'follower';
        const validationError = validateTwitterData(textContent, type);
        if (validationError) {
          throw new Error(validationError);
        }
        
        console.log(`✅ ${name} validation successful: correct Twitter data format`);
        
        const file = new File([content], name, {
          type: 'application/javascript'
        });
        formData.append('file', file);
      }

      const response = await fetch(`/api/upload/${session.user.id}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      console.log('✅ Upload successful');
      const result = await response.json();
      onUploadComplete(result.stats);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to process files');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div
        className={`w-full p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
          ${isUploading 
            ? 'border-violet-500 bg-violet-50' 
            : 'border-gray-300 hover:border-violet-400'
          }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-2">
          <svg 
            className={`w-8 h-8 ${isUploading ? 'text-violet-500' : 'text-gray-400'}`}
            fill="none" 
            strokeWidth="1.5" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </div>
          <div className="text-xs text-gray-500">
            Upload your Twitter data: following.js and follower.js files or a ZIP archive
          </div>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
        accept=".zip,.js"
        multiple
        className="hidden"
      />

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      {isUploading && (
        <div className="text-violet-600">Uploading...</div>
      )}
    </div>
  );
}
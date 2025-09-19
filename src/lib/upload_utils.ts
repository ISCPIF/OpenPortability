import * as zip from '@zip.js/zip.js';

// Types
export interface ExtractedFile {
  name: string;
  content: Uint8Array;
}

export interface TwitterData {
  following?: {
    accountId: string;
    userLink: string;
  };
  follower?: {
    accountId: string;
    userLink: string;
  };
}

export interface FileProcessResult {
  content: Uint8Array;
  count: number;
}

// Constants
export const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB
export const ALLOWED_TYPES = ['.zip', '.js'];
export const TARGET_FILES = ['data/following.js', 'data/follower.js'];
export const REQUIRED_FILES = ['following.js', 'follower.js'];

// Utility functions
export const normalizeFilePath = (path: string): string => {
  return path.replace(/\\/g, '/').replace(/^\.?\/+/, '').toLowerCase();
};

export const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) {
    return 'File size exceeds 1GB limit';
  }

  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['.zip', '.js'].includes(extension)) {
    return 'Invalid file type. Please upload either a ZIP file or following.js and follower.js files';
  }

  return null;
};

export const validateFileType = (file: File): boolean => {
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
];  return validTypes.includes(file.type);
};

export const validateFiles = (files: FileList): string | null => {


  if (files.length === 0) {
    return 'No files selected';
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
  return 'Please upload either a ZIP file, following.js + follower.js, or their split versions (following-part*.js/follower-part*.js)';
};

export const validateTwitterData = (content: string, type: 'following' | 'follower'): string | null => {


  const basePrefix = `window.YTD.${type}.part`;
  
  // Check if content starts with any valid part prefix
  if (!content.startsWith(basePrefix)) {
    console.error(`❌ Préfixe invalide. Attendu: "${basePrefix}", Reçu: "${content.substring(0, basePrefix.length)}"`);
    return `Format de fichier invalide : ${type}.js doit commencer par "${basePrefix}[N] = "`;
  }

  try {
    // Extract the JSON part, skipping the prefix and "="
    const jsonStartIndex = content.indexOf("[");
    if (jsonStartIndex === -1) {
      console.error('❌ Crochet ouvrant "[" non trouvé');
      return `Format de données invalide dans ${type}.js`;
    }
    return null;
  } catch (error) {
    console.error('❌ Erreur lors du parsing JSON:', error);
    return `JSON invalide dans ${type}.js : ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
  }
};

export const sanitizeContent = (content: Uint8Array): Uint8Array => {
  const text = new TextDecoder().decode(content);
  const sanitized = text
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/['"]\s*javascript\s*['"]/i, '');
  return new TextEncoder().encode(sanitized);
};

export const mergePartFiles = (files: ExtractedFile[], type: 'follower' | 'following'): FileProcessResult => {
  
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
    const objectCount = (content.match(new RegExp(`"${type}"\\s*:`, 'g')) || []).length;
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

export const extractTargetFiles = async (file: File): Promise<ExtractedFile[]> => {
  const reader = new zip.ZipReader(new zip.BlobReader(file));
  const entries = await reader.getEntries();
  
  // Type guard: ensure entry exposes getData (i.e., it's a file entry, not a directory entry)
  const isFileEntry = (entry: any): entry is typeof entries[number] & { getData: (writer: any) => Promise<Uint8Array> } =>
    entry && typeof entry.getData === 'function';
  
  const targetFiles = entries.filter(entry => {
    const normalizedPath = normalizeFilePath(entry.filename);
    return TARGET_FILES.some(target => normalizedPath.endsWith(normalizeFilePath(target)));
  });

  if (targetFiles.length === 0) {
    throw new Error('No target files found in ZIP archive');
  }

  const extractedFiles: ExtractedFile[] = await Promise.all(
    targetFiles.map(async entry => {
      if (!isFileEntry(entry)) {
        throw new Error(`Invalid ZIP entry (not a file): ${entry?.filename || 'unknown'}`);
      }
      const content = await entry.getData(new zip.Uint8ArrayWriter());
      const name = entry.filename.split('/').pop() || '';
      return { name, content };
    })
  );

  await reader.close();
  return extractedFiles;
};
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
import { createClient } from '@supabase/supabase-js';

const UploadButton = dynamic(() => import('../_components/UploadButton'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-12 w-48 rounded-lg"></div>,
  ssr: false
});

interface UploadStats {
  totalItems: number;
  totalBatches: number;
}

interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_batch: number;
  total_items: number;
  error_log?: string;
}

interface ExtractedFile {
  name: string;
  content: Uint8Array;
}

interface BatchUpdate {
  id: string;
  job_id: string;
  batch_number: number;
  batch_type: 'followers' | 'following';
  processed: boolean;
  created_at: string;
  updated_at: string;
}

interface BatchStats {
  followers: {
    total: number;
    processed: number;
  };
  following: {
    total: number;
    processed: number;
  };
}

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number | null;
  error?: string;
  totalItems: number;
  stats?: {
    total: number;
    processed: number;
    followers: number;
    following: number;
  };
  batchStats?: BatchStats;
}

const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 50MB
const MAX_CLIENT_PARSE_SIZE = 5 * 1024 * 1024; // 5MB - seuil pour le parsing côté client

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
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [batchStats, setBatchStats] = useState<BatchStats>({
    followers: {
      total: 0,
      processed: 0
    },
    following: {
      total: 0,
      processed: 0
    }
  });
  const [progressMessage, setProgressMessage] = useState<string>('');

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

  useEffect(() => {
    console.log("État actuel du currentJob", currentJob)
    if (!currentJob?.id) return;

    console.log('🔄 Setting up realtime subscription for job:', currentJob.id);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchBatchStats = async () => {
      const { data: batches, error } = await supabase
        .from('import_job_batches')
        .select('*')
        .eq('job_id', currentJob.id);

      if (!error && batches) {
        const processedBatches = batches.filter(b => b.processed).length;
        const totalBatches = batches.length;
        const progress = Math.round((processedBatches / totalBatches) * 100);
        
        const stats = {
          followers: {
            total: batches.filter(b => b.batch_type === 'followers').length,
            processed: batches.filter(b => b.processed && b.batch_type === 'followers').length
          },
          following: {
            total: batches.filter(b => b.batch_type === 'following').length,
            processed: batches.filter(b => b.processed && b.batch_type === 'following').length
          }
        };
        
        setBatchStats(stats);
        setUploadProgress(progress);
        setProgressMessage(`Traitement des données : ${processedBatches}/${totalBatches} lots (${progress}%)`);
      }
    };

    const subscription = supabase
      .channel(`job-${currentJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'import_job_batches',
          filter: `job_id=eq.${currentJob.id}`
        },
        async () => {
          await fetchBatchStats();
        }
      )
      .subscribe();

    fetchBatchStats();

    // Vérifier le statut du job toutes les 5 secondes
    const statusInterval = setInterval(() => {
      checkJobStatus(currentJob.id);
    }, 5000);

    return () => {
      console.log('🧹 Cleaning up realtime subscription');
      subscription.unsubscribe();
      clearInterval(statusInterval);
    };
  }, [currentJob?.id]);

  const checkJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/import-status/${jobId}`);
      const data = await response.json();

      console.log("data from checkJobStatus", data)
      
      if (data.error) {
        setError(data.error);
        setIsUploading(false);
        return;
      }

      if (data.status === 'completed') {
        setIsUploading(false);
        setUploadStats({
          totalBatches: data.stats?.total || 0, // Nombre total de batches
          totalItems: data.totalItems || 0      // Nombre total d'importations (followers + following)
        });
        setShowStats(true);
      } else if (data.status === 'failed') {
        setError(data.error || 'Import failed');
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Failed to check job status:', error);
      setError('Failed to check job status');
      setIsUploading(false);
    }
  };

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

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      let requiresServerProcessing = false;

      for (const file of Array.from(files)) {
        if (file.size > MAX_CLIENT_PARSE_SIZE) {
          requiresServerProcessing = true;
          formData.append('files', file);
        }
      }

      if (requiresServerProcessing) {
        const response = await fetch('/api/upload/large-files', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload large files');
        }

        const { jobId } = await response.json();
        router.push(`/upload/large-files?jobId=${jobId}`);
        return;
      }

      // Continuer avec la logique existante pour les petits fichiers
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

          const result = await response.json();

          if (result.error) {
            throw new Error(result.error);
          }

          if (result.jobId) {
            // Grand import, démarrer le polling
            setCurrentJob({
              id: result.jobId,
              status: 'pending',
              current_batch: 0,
              total_items: result.totalItems
            });
            checkJobStatus(result.jobId);
          } else {
            // Petit import, traitement normal
            setUploadStats(result.stats);
            setShowStats(true);
            // setTimeout(() => {
            //   router.replace("/dashboard");
            // }, 2000);
          }
        } catch (error) {
          // console.error('❌ Error processing files:', error);
          handleUploadError(error instanceof Error ? error.message : 'Failed to process files');
          setIsUploading(false);
        }
      };
      await processFiles(files);
    } catch (error) {
      setError(error.message);
    } finally {
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
    await handleFileUpload(pendingFiles);
  };

  const renderProgress = (jobStatus: JobStatus) => {
    if (!jobStatus) return null;

    const { status, progress, batchStats } = jobStatus;

    if (status === 'failed') {
      return (
        <div className="text-red-500">
          Une erreur est survenue lors de l'importation.
          {jobStatus.error && <div className="text-sm">{jobStatus.error}</div>}
        </div>
      );
    }

    if (status === 'completed') {
      return (
        <div className="space-y-2">
          <div className="text-green-500">
            Import terminé ! {jobStatus.totalItems} éléments importés.
          </div>
          {batchStats && (
            <div className="text-sm space-y-1">
              <div>
                Followers : {batchStats.followers.processed}/{batchStats.followers.total} batches
              </div>
              <div>
                Following : {batchStats.following.processed}/{batchStats.following.total} batches
              </div>
            </div>
          )}
        </div>
      );
    }

    if (status === 'processing') {
      return (
        <div className="space-y-2">
          <div>
            Import en cours... {progress}%
          </div>
          {batchStats && (
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-24">Followers :</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(batchStats.followers.processed / batchStats.followers.total) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="w-20 text-right">
                  {batchStats.followers.processed}/{batchStats.followers.total}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24">Following :</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(batchStats.following.processed / batchStats.following.total) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="w-20 text-right">
                  {batchStats.following.processed}/{batchStats.following.total}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <div>En attente de traitement...</div>;
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

              {isUploading && (
                <div className="mt-4">
                  {renderProgress({
                    status: currentJob?.status,
                    progress: uploadProgress,
                    batchStats: batchStats,
                    totalItems: currentJob?.total_items,
                    error: error
                  })}
                </div>
              )}
              {uploadStats && (
                <div className={`text-center mb-6 p-4 bg-pink-50 rounded-lg ${plex.className}`}>
                  <h2 className="text-xl font-semibold text-pink-800 mb-2">Traitement terminé</h2>
                  <p className="text-pink-700">
                    {uploadStats.totalBatches} batches traités pour {uploadStats.totalItems.toLocaleString()} importations
                  </p>
                  <button
                    onClick={() => router.replace("/dashboard")}
                    className="mt-4 px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                  >
                    Aller au dashboard
                  </button>
                </div>
              )}
            </div>
          </div>

          {currentJob && (
            <div className="mt-8 p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
              <h3 className="text-xl font-semibold mb-4">Import Progress</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Overall Progress</p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${(currentJob.current_batch / Math.ceil(currentJob.total_items / 1000)) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {currentJob.current_batch} / {Math.ceil(currentJob.total_items / 1000)} batches
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Followers</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${(batchStats.followers.processed / batchStats.followers.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {batchStats.followers.processed} / {batchStats.followers.total} batches
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Following</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${(batchStats.following.processed / batchStats.following.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {batchStats.following.processed} / {batchStats.following.total} batches
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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

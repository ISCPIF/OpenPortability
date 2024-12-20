'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../_components/Header';
import ErrorModal from "../../_components/ErrorModal";
import Image from 'next/image';
import seaBackground from '../../../../public/sea.svg';
import { plex } from '../../fonts/plex';
import logoHQX from '../../../../public/BannerHQX-rose_FR.svg';
import { motion, AnimatePresence } from 'framer-motion';
import boat1 from '../../../../public/boats/boat-1.svg';
import { Loader2 } from 'lucide-react';

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  totalItems: number;
  stats?: {
    total: number;
    processed: number;
    followers: number;
    following: number;
  };
}

interface Stats {
  matchedCount: number;
  totalUsers: number;
  following: number;
  followers: number;
}

export default function LargeFilesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  // Vérifier l'authentification
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Vérifier le statut du job
  useEffect(() => {
    if (!jobId) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/import-status/${jobId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch job status');
        }

        setJobStatus({
          status: data.status,
          progress: data.progress,
          totalItems: data.totalItems,
          error: data.error,
          stats: data.stats
        });

        // Si le job est terminé, arrêter le polling
        if (data.status === 'completed' || data.status === 'failed') {
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error checking job status:', error);
        setError((error as Error).message);
        return true;
      }
    };

    const pollStatus = async () => {
      const shouldStop = await checkStatus();
      if (!shouldStop) {
        setTimeout(pollStatus, 2000);
      }
    };

    pollStatus();
  }, [jobId]);

  // Calculer le pourcentage de progression
  const progressPercentage = jobStatus?.stats ? 
    Math.round((jobStatus.stats.processed / jobStatus.stats.total) * 100) : 0;

  if (status === 'loading' || !session) {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <Header />
      
      <div className="relative">
        <Image
          src={seaBackground}
          alt="Sea background"
          className="w-full h-auto"
          priority
        />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
          <Image
            src={logoHQX}
            alt="GoodbyeX Logo"
            className="w-64 mb-8"
            priority
          />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 backdrop-blur-xl rounded-xl border border-black/10 shadow-xl p-8 max-w-2xl w-full"
          >
            {jobStatus && (
              <div className="text-white">
                <h2 className={`${plex.className} text-2xl font-bold mb-6 text-center`}>Import en cours</h2>
                
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Progression totale</span>
                    <span>{progressPercentage}% ({jobStatus.stats?.processed.toLocaleString()} / {jobStatus.stats?.total.toLocaleString()})</span>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-2.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5 }}
                      className="bg-gradient-to-r from-pink-500 to-blue-500 h-2.5 rounded-full"
                    />
                  </div>
                </div>

                {/* Status and Stats */}
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">Status</span>
                    <span className={`px-3 py-1 rounded-full text-sm 
                      ${jobStatus.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                        jobStatus.status === 'processing' ? 'bg-blue-500/20 text-blue-300' :
                        jobStatus.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                        'bg-gray-500/20 text-gray-300'}`}
                    >
                      {jobStatus.status === 'processing' && (
                        <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                      )}
                      {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
                    </span>
                  </div>
                  
                  {jobStatus.stats && (
                    <div className="grid grid-cols-2 gap-6 mt-6 text-center">
                      <div className="p-4 bg-black/20 rounded-xl">
                        <p className="text-3xl font-bold text-pink-400">{jobStatus.stats.followers.toLocaleString()}</p>
                        <p className="text-sm text-white/60 mt-1">Followers</p>
                      </div>
                      <div className="p-4 bg-black/20 rounded-xl">
                        <p className="text-3xl font-bold text-blue-400">{jobStatus.stats.following.toLocaleString()}</p>
                        <p className="text-sm text-white/60 mt-1">Following</p>
                      </div>
                    </div>
                  )}

                  {jobStatus.error && (
                    <div className="mt-6 p-4 bg-red-500/20 text-red-300 rounded-xl">
                      {jobStatus.error}
                    </div>
                  )}

                  {jobStatus.status === 'completed' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push('/dashboard')}
                      className="w-full mt-6 bg-gradient-to-r from-pink-500 to-blue-500 text-white py-3 px-4 rounded-xl 
                               hover:from-pink-600 hover:to-blue-600 transition-all duration-200 
                               flex items-center justify-center space-x-2"
                    >
                      <span className={plex.className}>Retourner au dashboard</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </motion.button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Image src={boat1} alt="Boat" className="w-32" />
        </motion.div>
      </div>
      
      {error && (
        <ErrorModal
          message={error}
          onClose={() => setError(null)}
        />
      )}
    </div>
  );
}
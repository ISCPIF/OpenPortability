'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '../../_components/Header';
import ErrorModal from "../../_components/ErrorModal";
import Image from 'next/image';
import seaBackground from '../../../../public/sea.svg';
import { plex } from '../../fonts/plex';
import logoHQX from '../../../../public/logoxHQX/HQX-rose-FR.svg';
import { motion, AnimatePresence } from 'framer-motion';
import boat1 from '../../../../public/boats/boat-1.svg';
import { Loader2 } from 'lucide-react';
import Footer from "@/app/_components/Footer";


interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  stats?: {
    total: number;
    progress: number;
    processed: number;
    followers: {
      processed: number;
      total: number;
    };
    following: {
      processed: number;
      total: number;
    };
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
  const followerCount = parseInt(searchParams.get('followerCount') || '0', 10);
  const followingCount = parseInt(searchParams.get('followingCount') || '0', 10);

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

        // S'assurer que la structure des stats est correcte
        const updatedData = {
          ...data,
          stats: {
            total: data.stats?.total || 0,
            progress: data.stats?.progress || 0,
            processed: data.stats?.processed || 0,
            followers: {
              processed: data.stats?.followers?.processed || 0,
              total: followerCount
            },
            following: {
              processed: data.stats?.following?.processed || 0,
              total: followingCount
            }
          }
        };

        setJobStatus(updatedData);

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
  }, [jobId, followerCount, followingCount]);

  // Calculer les pourcentages de progression
  const followerProgress = jobStatus?.stats?.followers?.processed !== undefined ? 
    Math.round((jobStatus.stats.followers.processed / followerCount) * 100) : 0;
  
  const followingProgress = jobStatus?.stats?.following?.processed !== undefined ? 
    Math.round((jobStatus.stats.following.processed / followingCount) * 100) : 0;

  const totalProgress = jobStatus?.stats?.progress || 0;

  if (status === 'loading' || !session) {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
    </div>;
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

      <div className="relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 mt-44">
            {jobStatus && (
              <div className="text-white">                
                {/* Progress Bars */}
                <div className="space-y-6">
                  {/* Global Progress */}
                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold">Total Progress</span>
                      <span className="text-white/60">
                        {totalProgress}% ({jobStatus.stats?.processed?.toLocaleString()} / {jobStatus.stats?.total?.toLocaleString()})
                      </span>
                    </div>
                    <div className="w-full bg-black/20 rounded-full h-2.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${totalProgress}%` }}
                        transition={{ duration: 0.5 }}
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-2.5 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Followers Progress */}
                  {followerCount > 0 && jobStatus?.stats?.followers?.processed !== undefined && (
                    <div className="mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="font-semibold">Followers</span>
                        <span>
                          {followerProgress}% (
                          {jobStatus.stats.followers.processed.toLocaleString()} / 
                          {followerCount.toLocaleString()})
                        </span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${followerProgress}%` }}
                          transition={{ duration: 0.5 }}
                          className="bg-gradient-to-r from-pink-500 to-purple-500 h-2.5 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Following Progress */}
                  {followingCount > 0 && jobStatus?.stats?.following?.processed !== undefined && (
                    <div className="mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="font-semibold">Following</span>
                        <span>
                          {followingProgress}% (
                          {jobStatus.stats.following.processed.toLocaleString()} / 
                          {followingCount.toLocaleString()})
                        </span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${followingProgress}%` }}
                          transition={{ duration: 0.5 }}
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2.5 rounded-full"
                        />
                      </div>
                    </div>
                  )}
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
                  
                  {jobStatus.status === 'completed' && (
                    <div className="grid grid-cols-2 gap-6 mt-6 text-center">
                      <div className="p-4 bg-black/20 rounded-xl">
                        <p className="text-3xl font-bold text-pink-400">
                          {followerCount.toLocaleString()}
                        </p>
                        <p className="text-sm text-white/60 mt-1">Followers</p>
                      </div>
                      <div className="p-4 bg-black/20 rounded-xl">
                        <p className="text-3xl font-bold text-blue-400">
                          {followingCount.toLocaleString()}
                        </p>
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
        </div>
      </div>
      <Footer />
    </div>
  );
}
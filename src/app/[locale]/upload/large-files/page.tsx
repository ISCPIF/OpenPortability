'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '../../../_components/Header';
import ErrorModal from "../../../_components/ErrorModal";
import Image from 'next/image';
import seaBackground from '../../../../public/sea.svg';
import { plex } from '../../../fonts/plex';
import { motion, AnimatePresence } from 'framer-motion';
import boat1 from '../../../../../public/boats/boat-1.svg';
import { Loader2 } from 'lucide-react';
import Footer from "@/app/_components/Footer";
import logo from '../../../../../public/logo/logo-openport-blanc.svg';
import LoadingIndicator from '@/app/_components/LoadingIndicator';



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
  const params = useParams();
  const t = useTranslations('largeFiles');

  const jobId = searchParams.get('jobId');
  const followerCount = parseInt(searchParams.get('followerCount') || '0', 10);
  const followingCount = parseInt(searchParams.get('followingCount') || '0', 10);

  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(10); // Compteur pour la redirection

  // Vérifier l'authentification
  useEffect(() => {
    if (status === 'unauthenticated') {
      const locale = params.locale as string || 'fr';
      router.push(`/${locale}`);
    }
  }, [status, router, params.locale]);

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
  const totalItemCount = followerCount + followingCount;
  const isSmallUpload = totalItemCount < 2000;

  const followerProgress = jobStatus?.stats?.followers?.processed !== undefined ?
    Math.round((jobStatus.stats.followers.processed / followerCount) * 100) : 0;

  const followingProgress = jobStatus?.stats?.following?.processed !== undefined ?
    Math.round((jobStatus.stats.following.processed / followingCount) * 100) : 0;

  const totalProgress = jobStatus?.stats?.progress || 0;

  // Animation duration based on upload size
  const animationDuration = isSmallUpload ? 5 : 0.5;
  const animationEase = isSmallUpload ? "linear" : "easeOut";

  // Redirection automatique après 10 secondes quand le job est terminé
  useEffect(() => {
    if (jobStatus?.status === 'completed') {
      // Mise à jour du compteur à rebours
      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prevCount) => {
          if (prevCount <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prevCount - 1;
        });
      }, 1000);
      
      // Redirection après 10 secondes
      const redirectTimeout = setTimeout(() => {
        const locale = params.locale as string || 'fr';
        router.push(`/${locale}/reconnect`);
      }, 10000); // 10 secondes

      return () => {
        clearTimeout(redirectTimeout);
        clearInterval(countdownInterval);
      };
    }
  }, [jobStatus?.status, router, params.locale]);

  if (status === 'loading' || !session) {
    return <div className="min-h-screen bg-[#2a39a9] relative w-full m-auto">
      <div className="container mx-auto py-12">
        <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
          <div className="m-auto relative my-32 lg:my-40">
            <LoadingIndicator msg={"Loading..."} />
          </div>
        </div>
      </div>
    </div>;
  }

  return (
    <>
      <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
        <Header />
        <div className="flex justify-center mt-8 mb-8">
          <Image
            src={logo}
            alt={t('logo.alt')}
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
                <div className="space-y-6">
                  {/* Message about contacts being downloaded */}
                  <div className="text-center mb-6 px-4 py-3 bg-white/10 rounded-lg">
                    <p className="text-white">{t('downloadingContacts')}</p>
                  </div>
                  
                  {/* Global Progress */}
                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold">{t('progress.total.title')}</span>
                      <span className="text-white/60">
                        {totalProgress}% ({t('progress.total.processed', {
                          processed: jobStatus.stats?.processed?.toLocaleString(),
                          total: jobStatus.stats?.total?.toLocaleString()
                        })})
                      </span>
                    </div>
                    <div className="w-full bg-black/20 rounded-full h-2.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${totalProgress}%` }}
                        transition={{
                          duration: animationDuration,
                          ease: animationEase
                        }}
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-2.5 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Followers Progress */}
                  {followerCount > 0 && jobStatus?.stats?.followers?.processed !== undefined && (
                    <div className="mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="font-semibold">{t('progress.followers.title')}</span>
                        <span>
                          {followerProgress}% ({t('progress.followers.processed', {
                            processed: jobStatus.stats.followers.processed.toLocaleString(),
                            total: followerCount.toLocaleString()
                          })})
                        </span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${followerProgress}%` }}
                          transition={{
                            duration: animationDuration,
                            ease: animationEase
                          }}
                          className="bg-gradient-to-r from-pink-500 to-purple-500 h-2.5 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Following Progress */}
                  {followingCount > 0 && jobStatus?.stats?.following?.processed !== undefined && (
                    <div className="mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="font-semibold">{t('progress.following.title')}</span>
                        <span>
                          {followingProgress}% ({t('progress.following.processed', {
                            processed: jobStatus.stats.following.processed.toLocaleString(),
                            total: followingCount.toLocaleString()
                          })})
                        </span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${followingProgress}%` }}
                          transition={{
                            duration: animationDuration,
                            ease: animationEase
                          }}
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2.5 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Status and Stats */}
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">{t('status.title')}</span>
                    <span className={`px-3 py-1 rounded-full text-sm 
                      ${jobStatus.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                        jobStatus.status === 'processing' ? 'bg-blue-500/20 text-blue-300' :
                          jobStatus.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                            'bg-gray-500/20 text-gray-300'}`}
                    >
                      {jobStatus.status === 'processing' && (
                        <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                      )}
                      {t(`status.${jobStatus.status}`)}
                    </span>
                  </div>

                  {jobStatus.status === 'completed' && (
                    <>
                      <div className="grid grid-cols-2 gap-6 mt-6 text-center">
                        <div className="p-4 bg-black/20 rounded-xl">
                          <p className="text-3xl font-bold text-pink-400">
                            {followerCount.toLocaleString()}
                          </p>
                          <p className="text-sm text-white/60 mt-1">{t('stats.followers')}</p>
                        </div>
                        <div className="p-4 bg-black/20 rounded-xl">
                          <p className="text-3xl font-bold text-blue-400">
                            {followingCount.toLocaleString()}
                          </p>
                          <p className="text-sm text-white/60 mt-1">{t('stats.following')}</p>
                        </div>
                      </div>

                      {/* Affichage du compte à rebours */}
                      <div className="mt-4 text-center text-white/70">
                        <p>{t('redirecting')} {redirectCountdown}s</p>
                      </div>
                    </>
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
                      onClick={() => {
                        const locale = params.locale as string || 'fr';
                        router.push(`/${locale}/reconnect`);
                      }}
                      className="w-full mt-6 bg-white text-gray-800 py-3 px-4 rounded-xl 
                      hover:bg-gray-50 transition-all duration-200 
                      flex items-center justify-center space-x-2"
                    >
                      <span className={plex.className}>{t('button.dashboard')}</span>
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
      </div>
      <Footer />
    </>
  );
}

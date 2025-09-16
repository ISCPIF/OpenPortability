'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '../../../_components/layouts/Header';
import ErrorModal from "../../../_components/modales/ErrorModal";
import Image from 'next/image';
import seaBackground from '../../../../public/sea.svg';
import { plex } from '../../../fonts/plex';
import { motion, AnimatePresence } from 'framer-motion';
import boat1 from '../../../../../public/boats/boat-1.svg';
import { Loader2 } from 'lucide-react';
import Footer from "@/app/_components/layouts/Footer";
import logo from '../../../../../public/logo/logo-openport-blanc.svg';
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  // Redis phase metadata (optional, via API)
  phase?: 'pending' | 'nodes' | 'edges' | 'completed' | 'failed';
  phase_progress?: number; // 0..100
  nodes_total?: number;
  nodes_processed?: number;
  edges_total?: number;
  edges_processed?: number;
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
  const vizRef = useRef<HTMLDivElement | null>(null); // kept for potential future use
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canUseWebGL, setCanUseWebGL] = useState(true);
  const [displayProgress, setDisplayProgress] = useState<number>(0);

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
        setTimeout(pollStatus, 5000);
      }
    };

    pollStatus();
  }, [jobId, followerCount, followingCount]);

  // Calculer les pourcentages de progression
  const totalItemCount = followerCount + followingCount;
  const isSmallUpload = totalItemCount < 2000;

  const totalProgress = jobStatus?.stats?.progress || 0;

  // Animation duration based on upload size
  const animationDuration = isSmallUpload ? 5 : 0.5;
  const animationEase = isSmallUpload ? "linear" : "easeOut";

  // Phase metadata
  const phase = jobStatus?.phase;
  const phaseLabel = phase === 'nodes' ? t('phase.nodes')
    : phase === 'edges' ? t('phase.edges')
    : phase === 'completed' ? t('phase.completed')
    : phase === 'failed' ? t('phase.failed')
    : t('phase.pending');
  const phaseProgress = typeof jobStatus?.phase_progress === 'number' ? Math.max(0, Math.min(100, Math.round(jobStatus.phase_progress))) : undefined;

  // Two progress bars: nodes preload and edges import
  const nodesProgressPct = (() => {
    if (!jobStatus) return 0;
    if (phase === 'nodes') {
      if (typeof phaseProgress === 'number') return phaseProgress;
      const total = jobStatus.nodes_total || 0;
      const done = jobStatus.nodes_processed || 0;
      return total > 0 ? Math.round((done / total) * 100) : 0;
    }
    if (phase === 'edges' || phase === 'completed') return 100;
    return typeof phaseProgress === 'number' ? phaseProgress : 0;
  })();

  const edgesProgressPct = (() => {
    if (!jobStatus) return 0;
    if (phase === 'completed') return 100;
    if (phase === 'edges') {
      const total = jobStatus.edges_total || 0;
      const done = jobStatus.edges_processed || 0;
      if (total > 0) return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
      if (typeof phaseProgress === 'number') return phaseProgress;
      return Math.max(0, Math.min(100, Math.round(jobStatus?.stats?.progress || 0)));
    }
    return 0;
  })();

  // Combined progress: 0–50% nodes, 50–100% edges. Lock to 100% on completion.
  const combinedTargetPct = (() => {
    if (!jobStatus) return 0;
    if (jobStatus.status === 'completed') return 100;
    if (phase === 'nodes' || phase === 'pending') {
      return Math.round(Math.max(0, Math.min(100, nodesProgressPct)) * 0.5);
    }
    if (phase === 'edges') {
      return 50 + Math.round(Math.max(0, Math.min(100, edgesProgressPct)) * 0.5);
    }
    // Fallback
    return Math.max(0, Math.min(100, Math.round(totalProgress)));
  })();

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

  // Prefers-reduced-motion + WebGL support detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const m = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReducedMotion(!!m.matches);
      update();
      if (m.addEventListener) m.addEventListener('change', update);
      else if ((m as any).addListener) (m as any).addListener(update);
      // WebGL check
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setCanUseWebGL(!!gl);
      return () => {
        if (m.removeEventListener) m.removeEventListener('change', update);
        else if ((m as any).removeListener) (m as any).removeListener(update);
      };
    } catch {
      setReducedMotion(true);
      setCanUseWebGL(false);
    }
  }, []);

  // Smoothly ease displayProgress toward combinedTargetPct
  useEffect(() => {
    let raf: number;
    let running = true;
    const start = performance.now();
    const from = displayProgress;
    const to = Math.max(0, Math.min(100, combinedTargetPct));
    const duration = reducedMotion ? 120 : 400; // ms

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = () => {
      if (!running) return;
      const now = performance.now();
      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * easeOutCubic(t);
      setDisplayProgress(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    // If target is less than current (rare), jump back gracefully
    if (to <= from) {
      setDisplayProgress(to);
      return () => { running = false; if (raf) cancelAnimationFrame(raf); };
    }

    raf = requestAnimationFrame(tick);
    return () => { running = false; if (raf) cancelAnimationFrame(raf); };
  }, [combinedTargetPct, reducedMotion]);

  // Stepper progress (derive from backend stats when available)
  const followingStats = jobStatus?.stats?.following;
  const followersStats = jobStatus?.stats?.followers;
  const followingPct = followingStats && followingStats.total > 0
    ? Math.round((followingStats.processed / followingStats.total) * 100)
    : 0;
  const followersPct = followersStats && followersStats.total > 0
    ? Math.round((followersStats.processed / followersStats.total) * 100)
    : 0;

  // Step states: pending | active | done
  const step1State: 'pending' | 'active' | 'done' = (phase === 'edges' || jobStatus?.status === 'completed') ? 'done' : ((phase === 'nodes' || phase === 'pending') ? 'active' : 'pending');
  const step2Done = followingStats && followingStats.total > 0 && followingStats.processed >= followingStats.total;
  const step3Done = followersStats && followersStats.total > 0 && followersStats.processed >= followersStats.total;
  const step2State: 'pending' | 'active' | 'done' = step1State === 'done' && !step2Done ? 'active' : (step2Done ? 'done' : 'pending');
  const step3State: 'pending' | 'active' | 'done' = (step2State === 'done' && !step3Done) ? 'active' : (step3Done ? 'done' : 'pending');

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator msg={"Loading..."} />
            </div>
          </div>
        </div>
      </div>
    );
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
          <div className="flex flex-col items-center justify-center p-8 mt-8">
            {jobStatus && (
              <div className="text-white">
                <div className="space-y-6">
                  {/* Message about contacts being downloaded */}
                  <div className="text-center mb-6 px-4 py-3 bg-white/10 rounded-lg">
                    <p className="text-white">{t('downloadingContacts')}</p>
                  </div>

                  {/* Single Combined Progress Bar: 0–50% nodes, 50–100% edges */}
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold">{phaseLabel}</span>
                      <span className="text-xs text-white/80">{Math.round(displayProgress)}%</span>
                    </div>
                    <div className="w-full bg-white/15 rounded-full h-3 relative overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{ width: `${Math.round(displayProgress)}%` }}
                        transition={{ duration: jobStatus?.status === 'completed' ? 0.2 : animationDuration, ease: animationEase }}
                        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 rounded-full"
                      />
                      {/* 50% split marker */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                    </div>
                    <div className="mt-2 text-xs text-white/70 flex justify-between">
                      <span>{t('phase.nodes')} 0–50%</span>
                      <span>{t('phase.edges')} 50–100%</span>
                    </div>
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
                        {/* <div className="grid grid-cols-2 gap-6 mt-6 text-center">
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
                        </div> */}

                        {/* Affichage du compte à rebours */}
                        <div className="mt-4 text-center text-white/70">
                          <p>{t('redirecting')} {redirectCountdown}s</p>
                        </div>
                      </>
                    )}

                    {jobStatus.status === 'failed' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const locale = params.locale as string || 'fr';
                          router.push(`/${locale}/upload`);
                        }}
                        className="w-full mt-6 bg-white text-gray-800 py-3 px-4 rounded-xl
                        hover:bg-gray-50 transition-all duration-200
                        flex items-center justify-center space-x-2"
                      >
                        <span className={plex.className}>{t('button.retryUpload', { default: 'Back to upload' })}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414
L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </motion.button>
                    )}

                    {jobStatus.error && (
                      <div className="mt-6 p-4 bg-red-500/20 text-red-300 rounded-xl">
                        {jobStatus.error}
                      </div>
                    )}

                    {/* {jobStatus.status === 'completed' && (
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
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414
L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </motion.button>
                    )} */}
                  </div>
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
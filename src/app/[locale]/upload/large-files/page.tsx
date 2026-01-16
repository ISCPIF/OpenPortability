'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '../../../_components/layouts/Header';
import { useSSE, SSEImportJobData } from '@/hooks/useSSE';

import Image from 'next/image';
import { quantico } from '../../../fonts/plex';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Footer from "@/app/_components/layouts/Footer";
import logoBlanc from '../../../../../public/logo/logo-openport-blanc.svg';
import logoRose from '../../../../../public/logos/logo-openport-rose.svg';
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground';
import { useTheme } from '@/hooks/useTheme';
import { invalidateHashesCache } from '@/contexts/GraphDataContext';

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
  const { data: session, status, update } = useSession();

  const searchParams = useSearchParams();
  const params = useParams();
  const t = useTranslations('largeFiles');
  const tLoaders = useTranslations('loaders');
  const { colors, isDark } = useTheme();

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
  const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Vérifier l'authentification
  useEffect(() => {
    if (status === 'unauthenticated') {
      const locale = params.locale as string || 'fr';
      router.push(`/${locale}`);
    }
  }, [status, router, params.locale]);

  // Helper to update job status from API or SSE data
  const updateJobStatusFromData = useCallback((data: any) => {
    // SSE data has stats as simple numbers, API has nested objects
    const followersProcessed = typeof data.stats?.followers === 'number' 
      ? data.stats.followers 
      : (data.stats?.followers?.processed || 0);
    const followingProcessed = typeof data.stats?.following === 'number'
      ? data.stats.following
      : (data.stats?.following?.processed || 0);
    
    const updatedData = {
      ...data,
      status: data.status || 'processing', // Preserve status from SSE/API
      stats: {
        total: data.stats?.total || 0,
        progress: data.stats?.progress || 0,
        processed: data.stats?.processed || 0,
        followers: {
          processed: followersProcessed,
          total: followerCount
        },
        following: {
          processed: followingProcessed,
          total: followingCount
        }
      }
    };
    setJobStatus(updatedData);
  }, [followerCount, followingCount]);

  // SSE handler for real-time job updates
  const handleSSEImportJob = useCallback((data: SSEImportJobData) => {
    // Only process events for our job
    if (data.jobId !== jobId) return;
    
    console.log('📡 [SSE] Received import job update:', data);
    updateJobStatusFromData(data);
  }, [jobId, updateJobStatusFromData]);

  // Connect to SSE for real-time updates
  const { isConnected: sseIsConnected } = useSSE({
    onImportJob: handleSSEImportJob,
    onConnected: () => {
      console.log('📡 [SSE] Connected for import job updates');
    },
    onError: () => {
      console.log('📡 [SSE] Disconnected, falling back to polling');
    },
  });

  // Track SSE connection state in a ref for use in async callbacks
  const sseConnectedRef = useRef(sseIsConnected);
  useEffect(() => {
    sseConnectedRef.current = sseIsConnected;
    // When SSE connects, clear any pending polling
    if (sseIsConnected && pollingIntervalRef.current) {
      console.log('📡 [SSE] Connected - stopping polling');
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, [sseIsConnected]);

  // Initial fetch + fallback polling when SSE is not connected
  useEffect(() => {
    if (!jobId) return;
    
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/import-status/${jobId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch job status');
        }

        if (isMounted) {
          updateJobStatusFromData(data);
        }

        // Si le job est terminé, arrêter le polling
        if (data.status === 'completed' || data.status === 'failed') {
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error checking job status:', error);
        if (isMounted) {
          setError((error as Error).message);
        }
        return true;
      }
    };

    const pollStatus = async () => {
      // Check ref for current SSE state
      if (sseConnectedRef.current) {
        console.log('📡 [Polling] SSE is connected, skipping poll');
        return;
      }
      
      const shouldStop = await checkStatus();
      
      // Schedule next poll only if not connected to SSE and not stopped
      if (!shouldStop && !sseConnectedRef.current && isMounted) {
        pollingIntervalRef.current = setTimeout(pollStatus, 5000);
      }
    };

    // Initial fetch (always do this to get initial state)
    checkStatus();
    
    // Start polling only if SSE is not connected
    if (!sseIsConnected) {
      pollingIntervalRef.current = setTimeout(pollStatus, 5000);
    }

    return () => {
      isMounted = false;
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [jobId, updateJobStatusFromData]);

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
        const countdownInterval = setInterval(() => {
          setRedirectCountdown((prevCount) => {
            if (prevCount <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prevCount - 1;
          });
        }, 1000);

        // Redirection après 10 secondes avec refresh de la session
        const redirectTimeout = setTimeout(async () => {
          // Invalidate hashes cache to force fresh fetch on reconnect page
          await invalidateHashesCache();
          
          await update(); // Force le rechargement de la session
          // Set flag for useReconnectState to know we came from LargeFilesPage
          sessionStorage.setItem('fromLargeFiles', 'true');
          
          // Set view mode cookies to 'followings' so reconnect page opens on followings view
          // IMPORTANT: Must update BOTH cookies because graph_ui_state takes priority in getInitialViewMode()
          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          document.cookie = `graph_view_mode=followings; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
          
          // Also update graph_ui_state (preserving viewport if exists)
          const existingUiCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('graph_ui_state='))
            ?.split('=')[1];
          let viewport = null;
          if (existingUiCookie) {
            try {
              const parsed = JSON.parse(decodeURIComponent(existingUiCookie));
              viewport = parsed?.viewport ?? null;
            } catch {
              // ignore malformed cookie
            }
          }
          const uiState = JSON.stringify({ viewMode: 'followings', viewport: viewport || undefined });
          document.cookie = `graph_ui_state=${encodeURIComponent(uiState)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
          
          const locale = params.locale as string || 'fr';
          router.push(`/${locale}/reconnect`);
        }, 10000); // 20 secondes

        return () => {
          clearTimeout(redirectTimeout);
          clearInterval(countdownInterval);
        };
      }
    }, [jobStatus?.status, router, params.locale, update]);

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

  // Status icon helper
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-rose-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-rose-500" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  // Status badge classes
  const getStatusBadgeClasses = (status: string) => {
    const base = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium';
    switch (status) {
      case 'completed':
        return `${base} ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`;
      case 'failed':
        return `${base} ${isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-50 text-rose-700'}`;
      case 'processing':
        return `${base} ${isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-50 text-rose-700'}`;
      default:
        return `${base} ${isDark ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-100 text-slate-600'}`;
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div 
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <ParticulesBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <LoadingIndicator msg={tLoaders('largeFiles')} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: colors.background }}>
      <ParticulesBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        
        {/* Logo */}
        <div className="flex justify-center mt-8 mb-6">
          <Image
            src={isDark ? logoBlanc : logoRose}
            alt={t('logo.alt')}
            width={200}
            height={80}
            className="mx-auto h-auto w-40 sm:w-48"
            priority
          />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 pb-8">
          {jobStatus && (
            <div
              className={`${quantico.className} w-full max-w-2xl rounded-xl border backdrop-blur-sm shadow-xl overflow-hidden ${
                isDark 
                  ? 'bg-slate-900/95 border-slate-700/50' 
                  : 'bg-white/90 border-slate-200'
              }`}
            >
              {/* Header with status */}
              <div className={`flex items-center justify-between p-5 border-b ${
                isDark ? 'border-slate-700/50' : 'border-slate-200'
              }`}>
                <h2 className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {t('status.title')}
                </h2>
                <span className={getStatusBadgeClasses(jobStatus.status)}>
                  {getStatusIcon(jobStatus.status)}
                  {t(`status.${jobStatus.status}`)}
                </span>
              </div>

              <div className="p-5 space-y-5">
                {/* Info banner */}
                <div className={`px-4 py-3 rounded-lg text-[12px] ${
                  isDark 
                    ? 'bg-slate-800/50 border border-slate-700/30 text-slate-300' 
                    : 'bg-slate-50 border border-slate-200 text-slate-600'
                }`}>
                  <p>{t('downloadingContacts')}</p>
                </div>

                {/* Progress section */}
                <div className="space-y-3">
                  {/* Phase label and percentage */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[13px] font-medium ${isDark ? 'text-white' : 'text-slate-700'}`}>
                      {phaseLabel}
                    </span>
                    <span className={`text-[13px] font-semibold ${
                      isDark ? 'text-amber-400' : 'text-amber-600'
                    }`}>
                      {Math.round(displayProgress)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className={`w-full h-2 rounded-full overflow-hidden ${
                    isDark ? 'bg-slate-700/50' : 'bg-slate-200'
                  }`}>
                    <motion.div
                      initial={false}
                      animate={{ width: `${Math.round(displayProgress)}%` }}
                      transition={{ duration: jobStatus?.status === 'completed' ? 0.2 : animationDuration, ease: animationEase }}
                      className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full"
                    />
                  </div>

                  {/* Phase hints */}
                  <div className={`flex justify-between text-[10px] uppercase tracking-wider ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    <span>{t('phase.nodes')} 0–50%</span>
                    <span>{t('phase.edges')} 50–100%</span>
                  </div>
                </div>

                {/* Completion message */}
                {jobStatus.status === 'completed' && (
                  <div className={`text-center p-4 rounded-lg border ${
                    isDark 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-emerald-50 border-emerald-200'
                  }`}>
                    <CheckCircle2 className={`w-7 h-7 mx-auto mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <p className={`text-[12px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      {t('redirecting')} {redirectCountdown}s
                    </p>
                  </div>
                )}

                {/* Error state */}
                {jobStatus.status === 'failed' && (
                  <div className="space-y-4">
                    {jobStatus.error && (
                      <div className={`p-4 rounded-lg border text-[12px] ${
                        isDark 
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' 
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        {jobStatus.error}
                      </div>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => {
                        const locale = params.locale as string || 'fr';
                        router.push(`/${locale}/upload`);
                      }}
                      className={`w-full py-3 px-4 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${
                        isDark
                          ? 'bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800'
                      }`}
                    >
                      {t('button.retryUpload', { default: 'Back to upload' })}
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}
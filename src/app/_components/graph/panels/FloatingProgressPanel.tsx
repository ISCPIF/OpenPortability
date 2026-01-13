'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Pause, CheckCircle, Loader, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';

interface FailureDetail {
  handle: string;
  error: string;
}

interface PlatformResult {
  succeeded: number;
  failed: number;
  failures: FailureDetail[];
}

interface FloatingProgressPanelProps {
  results?: {
    bluesky: PlatformResult | null;
    mastodon: PlatformResult | null;
  } | null;
  stats: {
    matches: {
      bluesky: { total: number; notFollowed: number };
      mastodon: { total: number; notFollowed: number };
    };
  } | null;
  session: {
    user: {
      bluesky_username?: string | null;
      mastodon_username?: string | null;
    };
  };
  onPause?: () => void;
  onComplete?: () => void; // Called when migration is complete
  onClose?: () => void; // Called when user closes the panel
  // For manual mode: number of selected accounts (overrides stats totals)
  selectedCount?: number;
  isManualMode?: boolean;
  // Breakdown of selected accounts by platform (for manual mode)
  selectedBreakdown?: {
    bluesky: number; // Number of selected accounts with Bluesky handle
    mastodon: number; // Number of selected accounts with Mastodon handle
  };
}

export function FloatingProgressPanel({
  results,
  stats,
  session,
  onPause,
  onComplete,
  onClose,
  selectedCount,
  isManualMode = false,
  selectedBreakdown,
}: FloatingProgressPanelProps) {
  const t = useTranslations('floatingProgressPanel');
  const [showErrors, setShowErrors] = useState(false);
  const [hasCalledComplete, setHasCalledComplete] = useState(false);
  
  // Store initial totals to prevent them from being reset when selectedCount becomes 0
  const [initialTotals, setInitialTotals] = useState<{
    bluesky: number;
    mastodon: number;
    total: number;
  } | null>(null);

  // Résultats avec valeurs par défaut - utilise succeeded et failed de l'API
  const blueskySucceeded = results?.bluesky?.succeeded || 0;
  const mastodonSucceeded = results?.mastodon?.succeeded || 0;
  const blueskyFailed = results?.bluesky?.failed || 0;
  const mastodonFailed = results?.mastodon?.failed || 0;
  
  // Collecter toutes les erreurs
  const allFailures: { platform: string; handle: string; error: string }[] = [];
  if (results?.bluesky?.failures) {
    results.bluesky.failures.forEach(f => {
      allFailures.push({ platform: 'bluesky', handle: f.handle, error: f.error });
    });
  }
  if (results?.mastodon?.failures) {
    results.mastodon.failures.forEach(f => {
      allFailures.push({ platform: 'mastodon', handle: f.handle, error: f.error });
    });
  }

  // En mode manuel, le total est le nombre de comptes sélectionnés
  // En mode automatique, c'est la somme des comptes à suivre par plateforme
  const totalSucceeded = blueskySucceeded + mastodonSucceeded;
  const totalFailed = blueskyFailed + mastodonFailed;
  
  // Pour les barres de progression par plateforme
  // PRIORITÉ: selectedBreakdown (calculé à partir des comptes sélectionnés) > stats globales
  // selectedBreakdown est défini quand on démarre une migration manuelle
  const currentBlueskyTotal = selectedBreakdown?.bluesky ?? (stats?.matches.bluesky.notFollowed || 0);
  const currentMastodonTotal = selectedBreakdown?.mastodon ?? (stats?.matches.mastodon.notFollowed || 0);
  
  // Total = selectedCount si défini, sinon somme des plateformes
  const currentTotalToFollow = selectedCount ?? (currentBlueskyTotal + currentMastodonTotal);
  
  // Store initial totals when they are first set (non-zero)
  // This prevents the totals from being reset when selectedCount becomes 0 after migration
  useEffect(() => {
    if (initialTotals === null && currentTotalToFollow > 0) {
      setInitialTotals({
        bluesky: currentBlueskyTotal,
        mastodon: currentMastodonTotal,
        // Total for completion check = sum of platform follows, not account count
        // Because totalSucceeded counts follows per platform (bluesky + mastodon separately)
        total: currentBlueskyTotal + currentMastodonTotal
      });
    }
  }, [currentTotalToFollow, currentBlueskyTotal, currentMastodonTotal, initialTotals]);
  
  // Use stored initial totals if available, otherwise use current values
  const blueskyTotal = initialTotals?.bluesky ?? currentBlueskyTotal;
  const mastodonTotal = initialTotals?.mastodon ?? currentMastodonTotal;
  // For completion: use sum of platform totals (not account count)
  const totalToFollow = initialTotals?.total ?? (currentBlueskyTotal + currentMastodonTotal);
  
  // Calcul des progressions par plateforme
  const blueskyProgress = blueskyTotal > 0 
    ? Math.round((blueskySucceeded / blueskyTotal) * 100) 
    : 0;
  const mastodonProgress = mastodonTotal > 0 
    ? Math.round((mastodonSucceeded / mastodonTotal) * 100) 
    : 0;
  
  // Progression globale (pour mode manuel)
  const totalProgress = totalToFollow > 0 
    ? Math.round((totalSucceeded / totalToFollow) * 100) 
    : 0;

  const isComplete = totalToFollow > 0 && (totalSucceeded + totalFailed) >= totalToFollow;
  // Always show as "in progress" once the panel is visible (no "starting" state)
  const isInProgress = !isComplete;



  // Call onComplete when migration finishes
  useEffect(() => {
    if (isComplete && !hasCalledComplete && onComplete) {
      setHasCalledComplete(true);
      // Small delay to let the UI update before showing the modal
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, [isComplete, hasCalledComplete, onComplete]);

  // Afficher les barres par plateforme seulement si il y a des comptes à suivre pour cette plateforme
  const showBlueskyBar = blueskyTotal > 0;
  const showMastodonBar = mastodonTotal > 0;
  // Afficher une barre globale seulement si aucune barre par plateforme n'est affichée
  const showGlobalBar = !showBlueskyBar && !showMastodonBar && totalToFollow > 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[420px] max-w-[90vw] bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Loader className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          )}
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {isComplete ? t('status.complete') : t('status.inProgress')}
            </span>
            <p className="text-[11px] font-medium text-white">
              {isComplete 
                ? (totalFailed > 0 
                    ? t('actionSummary.completedWithErrors', { succeeded: totalSucceeded, total: selectedCount || totalToFollow, failed: totalFailed })
                    : t('actionSummary.completed', { succeeded: totalSucceeded, total: selectedCount || totalToFollow }))
                : t('actionSummary.following', { count: selectedCount || totalToFollow })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isComplete && onPause && (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] font-medium text-slate-300 transition-colors"
            >
              <Pause className="w-3 h-3" />
              {t('pause')}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              title={t('close')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bars */}
      <div className="px-3 py-3 space-y-3">
        {/* Global Progress (Manual Mode) */}
        {showGlobalBar && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🔗</span>
                <span className="text-[10px] text-slate-300">{t('platforms.manualFollow')}</span>
                {totalFailed > 0 && (
                  <span className="text-[9px] text-red-400">({t('failed', { count: totalFailed })})</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {totalSucceeded}/{totalToFollow}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-slate-800">
              <div 
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-blue-400"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Bluesky Progress (Automatic Mode) */}
        {showBlueskyBar && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🦋</span>
                <span className="text-[10px] text-slate-300">{t('platforms.bluesky')}</span>
                {blueskyFailed > 0 && (
                  <span className="text-[9px] text-red-400">({t('failed', { count: blueskyFailed })})</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {blueskySucceeded}/{blueskyTotal}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-slate-800">
              <div 
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-emerald-400"
                style={{ width: `${blueskyProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Mastodon Progress (Automatic Mode) */}
        {showMastodonBar && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🐘</span>
                <span className="text-[10px] text-slate-300">{t('platforms.mastodon')}</span>
                {mastodonFailed > 0 && (
                  <span className="text-[9px] text-red-400">({t('failed', { count: mastodonFailed })})</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {mastodonSucceeded}/{mastodonTotal}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-slate-800">
              <div 
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-emerald-400"
                style={{ width: `${mastodonProgress}%` }}
              />
            </div>
          </div>
        )}

      </div>

      {/* Errors Section */}
      {allFailures.length > 0 && (
        <div className="border-t border-slate-700/50">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-red-400">{t('errors.title', { count: allFailures.length })}</span>
            </div>
            {showErrors ? (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>
          
          {showErrors && (
            <div className="px-3 pb-2 max-h-32 overflow-y-auto">
              {allFailures.slice(0, 10).map((failure, idx) => (
                <div key={idx} className="py-1 border-b border-slate-800 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px]">{failure.platform === 'bluesky' ? '🦋' : '🐘'}</span>
                    <span className="text-[9px] text-slate-300 font-mono truncate max-w-[120px]">
                      {failure.handle}
                    </span>
                  </div>
                  <p className="text-[9px] text-red-400/80 truncate pl-4">
                    {failure.error}
                  </p>
                </div>
              ))}
              {allFailures.length > 10 && (
                <p className="text-[9px] text-slate-500 text-center pt-1">
                  {t('errors.moreErrors', { count: allFailures.length - 10 })}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary Footer */}
      <div className="px-3 py-2 border-t border-slate-700/50 flex items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-sm font-bold text-emerald-400">{totalSucceeded}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">{t('summary.followed')}</p>
        </div>
        <div className="w-px h-6 bg-slate-700/50" />
        <div className="text-center">
          <p className="text-sm font-bold text-slate-300">{totalToFollow}</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">{t('summary.total')}</p>
        </div>
        {totalFailed > 0 && (
          <>
            <div className="w-px h-6 bg-slate-700/50" />
            <div className="text-center">
              <p className="text-sm font-bold text-red-400">{totalFailed}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">{t('summary.failed')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

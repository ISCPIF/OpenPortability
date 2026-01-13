// src/hooks/useReconnectState.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useStats } from './useStats';
import { useMastodonInstances } from './useMastodonInstances';
import { MatchingTarget, MatchedFollower, FollowerOfSource } from '@/lib/types/matching';
import { useAuthRefresh } from './useAuthRefresh';

type AccountToFollow = MatchingTarget | MatchedFollower;

// Module-level variables to track API calls across component instances
// This helps with React Strict Mode double-mounting
const globalMatchesFetched = { current: false };
const globalFollowersFetched = { current: false };
// Shared promise for concurrent matching requests
let activeMatchingPromise: Promise<any> | null = null;
let activeFollowersPromise: Promise<any> | null = null;

// Type pour la liste des followings
interface FollowingListResponse {
  following: MatchingTarget[]
}

export function useReconnectState() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { stats, globalStats, isLoading: statsLoading, refreshStats } = useStats({ skipInitialFetch: true });
  const mastodonInstances = useMastodonInstances();
  const { invalidProviders: authMissingProviders, recheckAuth } = useAuthRefresh();
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  const [isAutomaticReconnect, setIsAutomaticReconnect] = useState(false);
  const [invalidTokenProviders, setInvalidTokenProviders] = useState<string[]>([]);
  // Breakdown of selected accounts by platform (for progress panel)
  const [selectedBreakdown, setSelectedBreakdown] = useState<{ bluesky: number; mastodon: number } | null>(null);
  
  // NOUVEAU: État séparé pour la liste des followings seulement
  const [followingListState, setFollowingListInternal] = useState<MatchingTarget[]>([]);
  
  // Debug: log when followingList changes
  useEffect(() => {
    if (followingListState.length > 0) {
      const connectedCount = followingListState.filter((m: any) => m.has_follow_bluesky || m.has_been_followed_on_bluesky).length;
      console.log('🔄 [useReconnectState] followingListState changed:', {
        total: followingListState.length,
        connectedBluesky: connectedCount,
      });
    }
  }, [followingListState]);

  // Track the last synced data version to detect when global cache is updated
  const [lastSyncedVersion, setLastSyncedVersion] = useState<number>(0);
  
  // Sync with global cache from GraphDataContext
  // This ensures FloatingAccountsPanel gets data when context fetches it
  // OPTIMIZED: Replaced polling with event-based sync
  useEffect(() => {
    const syncFromGlobalCache = () => {
      if (typeof window !== 'undefined') {
        // First try the new globalGraphState from GraphDataContext
        const graphState = (window as any).__globalGraphState;
        if (graphState?.matchingDataLoaded && graphState?.matchingData?.length > 0) {
          const cacheVersion = Date.now(); // Use current time as version
          if (followingListState.length === 0 || followingListState.length !== graphState.matchingData.length) {
            console.log('🔄 [useReconnectState] Syncing from GraphDataContext:', graphState.matchingData.length, 'matches');
            setFollowingListInternal(graphState.matchingData);
            setAccountsToProcessInternal(graphState.matchingData);
            setLastSyncedVersion(cacheVersion);
            return;
          }
        }
        
        // Fallback to legacy global state (for backward compatibility)
        const globalState = (window as any).__matchingNetworkState;
        if (globalState?.fetched && globalState?.data && globalState.data.length > 0) {
          const cacheVersion = globalState._version || 0;
          if (followingListState.length === 0 || cacheVersion > lastSyncedVersion) {
            console.log('🔄 [useReconnectState] Syncing from legacy cache:', globalState.data.length, 'matches, version:', cacheVersion);
            setFollowingListInternal(globalState.data);
            setAccountsToProcessInternal(globalState.data);
            setLastSyncedVersion(cacheVersion);
          }
        }
      }
    };

    // Check immediately on mount
    syncFromGlobalCache();

    // Listen for updates via custom events (from both GraphDataContext and legacy)
    const handleCacheUpdate = () => {
      console.log('🔄 [useReconnectState] Received cache update event');
      syncFromGlobalCache();
    };
    
    // Listen to both event types for compatibility
    window.addEventListener('matchingNetworkUpdated', handleCacheUpdate);
    window.addEventListener('matchingDataUpdated', handleCacheUpdate);
    
    return () => {
      window.removeEventListener('matchingNetworkUpdated', handleCacheUpdate);
      window.removeEventListener('matchingDataUpdated', handleCacheUpdate);
    };
  }, [followingListState.length, lastSyncedVersion]);
  
  const followingList = followingListState;
  
  // Garder accountsToProcess pour compatibilité (sera supprimé plus tard)
  const [accountsToProcess, setAccountsToProcessInternal] = useState<AccountToFollow[]>([]);

  // Wrapper function to update both states (for compatibility during transition)
  const setFollowingList = (accounts: MatchingTarget[]) => {
    setFollowingListInternal(accounts);
    setAccountsToProcessInternal(accounts as AccountToFollow[]);
  };

  // Alias for setAccountsToProcess that also updates followingList
  const setAccountsToProcess = (accounts: AccountToFollow[]) => {
    setAccountsToProcessInternal(accounts);
    setFollowingListInternal(accounts as MatchingTarget[]);
  };
  
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'mastodon' | 'bluesky'>('bluesky');
  const [showModaleResults, setShowModaleResults] = useState(false);
  const [migrationResults, setMigrationResults] = useState<{ 
    bluesky: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null; 
    mastodon: { succeeded: number; failed: number; failures: { handle: string; error: string }[] } | null;
  } | null>(null);
  const [missingProviders, setMissingProviders] = useState<('bluesky' | 'mastodon')[]>([]);
  const [isReconnectionComplete, setIsReconnectionComplete] = useState(false);
  
  // NOUVEAU: État pour les followers (chargé en background)
  const [followersList, setFollowersList] = useState<FollowerOfSource[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  
  // Use ref to track API calls
  const matchesFetchedRef = useRef(globalMatchesFetched.current);
  const followersFetchedRef = useRef(globalFollowersFetched.current);
  
  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_username;
  const hasBluesky = session?.user?.bluesky_username;
  const hasTwitter = session?.user?.twitter_username;
  const hasOnboarded = session?.user?.has_onboarded;
  
  // Vérifier si l'utilisateur a des comptes connectés
  const connectedServicesCount = [
    !!hasMastodon, 
    !!hasBluesky, 
    !!hasTwitter
  ].filter(Boolean).length;

  // Update missingProviders when authMissingProviders changes
  useEffect(() => {
    if (authMissingProviders.length > 0) {
      // Filter to only valid provider types
      const validProviders = authMissingProviders.filter(
        (p: string): p is 'bluesky' | 'mastodon' => p === 'bluesky' || p === 'mastodon'
      );
      if (validProviders.length > 0) {
        setMissingProviders(validProviders);
      }
    }
  }, [authMissingProviders]);

  // NOTE: fetchFollowingList has been removed - data is now managed by GraphDataContext
  // Use graphData.fetchPersonalData() from ReconnectGraphDashboard instead

  // NOUVEAU: Fonction pour récupérer la liste des followers (chargé en background)
  const fetchFollowersList = useCallback(async () => {
    // Check if already fetched via global state (shared with useFollowersNetwork)
    if (typeof window !== 'undefined') {
      const globalState = (window as any).__followersNetworkState;
      if (globalState?.fetched && globalState?.data) {
        console.log('[useReconnectState] Using cached followers data');
        setFollowersList(globalState.data);
        setFollowersCount(globalState.data.length);
        return globalState.data;
      }
    }

    // Skip if already fetched
    if (followersFetchedRef.current || globalFollowersFetched.current) {
      return followersList;
    }

    // Reuse active promise if exists
    if (activeFollowersPromise) {
      return activeFollowersPromise;
    }

    setIsLoadingFollowers(true);

    activeFollowersPromise = (async () => {
      try {
        const response = await fetch('/api/graph/followers-hashes', {
          headers: {
            'Cache-Control': 'no-cache',
            'X-Request-ID': `followers-list-${Date.now()}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // API now returns hashes directly (coordinate hashes of followers in graph)
        const hashes = data.hashes || [];
        const totalCount = data.stats?.total_in_graph || hashes.length;

        setFollowersList(hashes);
        setFollowersCount(totalCount);
        followersFetchedRef.current = true;
        globalFollowersFetched.current = true;

        // Store in global state for useFollowersNetwork to reuse
        if (typeof window !== 'undefined') {
          if (!(window as any).__followersNetworkState) {
            (window as any).__followersNetworkState = { fetched: false, data: null, promise: null };
          }
          (window as any).__followersNetworkState.fetched = true;
          (window as any).__followersNetworkState.data = hashes;
        }

        console.log(`[useReconnectState] Loaded ${hashes.length} followers in background`);
        return hashes;
      } catch (error) {
        console.error('fetchFollowersList: Error:', error);
        return [];
      } finally {
        setIsLoadingFollowers(false);
        activeFollowersPromise = null;
      }
    })();

    return activeFollowersPromise;
  }, [followersList]);

  // NOTE: fetchMatches has been removed - data is now managed by GraphDataContext

  // NOUVEAU: Fonction pour re-fetch les stats après un follow
  // Note: matching_found is now handled by refetchPersonalNetwork via onComplete callback
  const refetchUserStatsAfterFollow = useCallback(async () => {
    try {
      // Attendre un peu pour que la DB soit mise à jour
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Rafraîchir les stats uniquement
      console.log('🔄 [refetchUserStatsAfterFollow] Refreshing stats...');
      await refreshStats();
      
      // Invalidate global cache so that refetchPersonalNetwork will fetch fresh data
      if (typeof window !== 'undefined' && (window as any).__matchingNetworkState) {
        (window as any).__matchingNetworkState.fetched = false;
        (window as any).__matchingNetworkState.data = null;
      }
      globalMatchesFetched.current = false;
      matchesFetchedRef.current = false;
      
    } catch (error) {
      console.error('❌ [refetchUserStatsAfterFollow] Error:', error);
    }
  }, [refreshStats]);

  // NOTE: refetchFollowingList has been removed - use graphData.refetchPersonalData() instead

  // Reset global flags when user session changes
  useEffect(() => {
    if (session?.user?.id) {
    } else {
      globalMatchesFetched.current = false;
      matchesFetchedRef.current = false;
    }
  }, [session?.user?.id]);

  // Helper: check if user came from LargeFilesPage
  const cameFromLargeFiles = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    // Check sessionStorage flag (set by LargeFilesPage redirect)
    const fromLargeFiles = sessionStorage.getItem('fromLargeFiles');
    if (fromLargeFiles === 'true') {
      // Clear the flag after reading
      sessionStorage.removeItem('fromLargeFiles');
      return true;
    }
    
    // Fallback: check document.referrer
    const referrer = document.referrer;
    if (referrer && referrer.includes('/upload/large-files')) {
      return true;
    }
    
    return false;
  }, []);

  // Vérifier les tokens et charger les données
  useEffect(() => {

    console.log("session is ->", session)

    if (status === "unauthenticated") {
      // router.replace("/auth/signin");
      return;
    }


    // Skip if we're not in a state where we need to load data
    if (status === "loading") {
      return;
    }

    if (!session) {
      setIsLoading(false);
      return;
    }
    // Permettre l'accès si l'utilisateur a onboarded OU a un compte Twitter (twitter_id ou twitter_username)
    const hasTwitterAccount = session.user?.twitter_id || session.user?.twitter_username;
    if (!session.user?.has_onboarded && !hasTwitterAccount) {
      // router.replace("/dashboard");
      setIsLoading(false);
      return;
    }

    // NOTE: matching_found is now loaded by GraphDataContext.fetchPersonalData()
    // called from ReconnectGraphDashboard. This hook only syncs from global cache.
    // Stats are loaded after personal data is ready.
    
    // Charger les stats (indépendant du matching)
    refreshStats();
    
    setIsLoading(false);
  }, [session?.user?.id, status, refreshStats]); // Uniquement se déclencher sur les changements d'ID utilisateur et de status

  // Fonction pour mettre à jour l'option de reconnexion automatique
  const updateAutomaticReconnect = async (value: boolean) => {
    try {
      const response = await fetch('/api/users/automatic-reconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ automatic_reconnect: value }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to update automatic reconnect setting');
      }

      setIsAutomaticReconnect(value);
    } catch (error) {
      console.error('updateAutomaticReconnect: Error:', error);
    }
  };

  // Fonctions pour gérer les modes de reconnexion
  const handleAutomaticMode = async () => {
    await updateAutomaticReconnect(true);
    setIsAutomaticReconnect(true);
  };

  const handleManualMode = async () => {
    await updateAutomaticReconnect(false);
    setIsAutomaticReconnect(false);
    setShowOptions(false);
  };

  const toggleAutomaticReconnect = async () => {
    const newValue = !isAutomaticReconnect;
    await updateAutomaticReconnect(newValue);
  };

  // Fonction pour démarrer la migration automatique
  const handleAutomaticReconnection = async () => {
    await handleAutomaticMode();
    // Démarrer la migration automatique avec tous les comptes
    const allAccountIds = accountsToProcess.map((match: any) => 
      'node_id' in match ? match.node_id.toString() : match.source_twitter_id
    );
    handleStartMigration(allAccountIds);
  };

  // Fonction pour démarrer la migration manuelle
  const handleManualReconnection = async () => {
    await handleManualMode();
  };

  // Fonction pour démarrer la migration
  // onUpdateFollowingStatus: callback to update graph highlighting cache (passed from component inside GraphDataProvider)
  const handleStartMigration = async (
    selectedAccountsParam: string[], 
    onComplete?: () => void,
    onUpdateFollowingStatus?: (coordHashes: string[], platform: 'bluesky' | 'mastodon', followed: boolean) => void
  ) => {

    
    try {
      setIsMigrating(true);
      // Update the selectedAccounts state with the accounts being migrated
      // This ensures selectedAccountsCount is accurate in the progress panel
      setSelectedAccounts(new Set(selectedAccountsParam));
      
      // Get all selected accounts and handle both types
      const accountsToMigrate = accountsToProcess.filter((match: any) => {
        const twitterId = 'node_id' in match 
          ? match.node_id.toString()
          : match.source_twitter_id;
        const isSelected = selectedAccountsParam.includes(twitterId);
        
        return isSelected;
      });
      
      // Calculate breakdown by platform for progress panel
      // Count accounts that have handles for each platform AND are not already followed
      let blueskyCount = 0;
      let mastodonCount = 0;
      accountsToMigrate.forEach((acc: any) => {
        const hasBlueskyHandle = !!acc.bluesky_handle;
        const hasMastodonHandle = !!(acc.mastodon_handle || acc.mastodon_username);
        const hasFollowedBluesky = 'has_follow_bluesky' in acc ? acc.has_follow_bluesky : acc.has_been_followed_on_bluesky;
        const hasFollowedMastodon = 'has_follow_mastodon' in acc ? acc.has_follow_mastodon : acc.has_been_followed_on_mastodon;
        
        // Only count if user has the platform connected AND account has handle AND not already followed
        if (hasBluesky && hasBlueskyHandle && !hasFollowedBluesky) blueskyCount++;
        if (hasMastodon && hasMastodonHandle && !hasFollowedMastodon) mastodonCount++;
      });
      setSelectedBreakdown({ bluesky: blueskyCount, mastodon: mastodonCount });
      console.log('📊 [useReconnectState] Selected breakdown:', { bluesky: blueskyCount, mastodon: mastodonCount });
      
      // Initialize progress tracking - start with zeros, will accumulate from API responses
      const initialResults = {
        bluesky: { succeeded: 0, failed: 0, failures: [] as { handle: string; error: string }[] },
        mastodon: { succeeded: 0, failed: 0, failures: [] as { handle: string; error: string }[] }
      };
      setMigrationResults(initialResults);

      // Process in batches, excluding already followed accounts
      const BATCH_SIZE = 25;
      let remainingAccounts = accountsToMigrate.filter((acc: any) => {
        const hasFollowedBluesky = 'has_follow_bluesky' in acc 
          ? acc.has_follow_bluesky 
          : acc.has_been_followed_on_bluesky;
        const hasFollowedMastodon = 'has_follow_mastodon' in acc 
          ? acc.has_follow_mastodon 
          : acc.has_been_followed_on_mastodon;
        return (!hasFollowedBluesky && session?.user?.bluesky_username) || 
               (!hasFollowedMastodon && session?.user?.mastodon_username);
      });



      for (let i = 0; i < remainingAccounts.length; i += BATCH_SIZE) {
        const batchAccounts = remainingAccounts.slice(i, i + BATCH_SIZE);
        
        const response = await fetch('/api/migrate/send_follow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accounts: batchAccounts }),
        });
        
        // Parse response body first
        let result: any = null;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error('🔴 [useReconnectState] Failed to parse response JSON:', parseError);
        }
        
        console.log('📡 [useReconnectState] API response:', { 
          status: response.status, 
          ok: response.ok, 
          resultKeys: result ? Object.keys(result) : null 
        });

        // Handle reauth required (401 with requiresReauth)
        if (response.status === 401 && result?.requiresReauth) {
          console.log('🔐 [useReconnectState] Reauth required for providers:', result.providers);
          const providers = result.providers || [];
          setInvalidTokenProviders(providers);
          setIsMigrating(false);
          return;
        }
        
        // Handle legacy InvalidToken error (500)
        if (response.status === 500 && result?.error === 'InvalidToken') {
          setInvalidTokenProviders(['bluesky']);
          setIsMigrating(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to process batch ${i / BATCH_SIZE + 1}`);
        }

        // Update progress based on batch results - accumulate succeeded, failed, and failures
        setMigrationResults((prevResults: any) => {
          if (!prevResults) return initialResults;

          return {
            bluesky: {
              succeeded: prevResults.bluesky.succeeded + (result.bluesky?.succeeded || 0),
              failed: prevResults.bluesky.failed + (result.bluesky?.failed || 0),
              failures: [...prevResults.bluesky.failures, ...(result.bluesky?.failures || [])]
            },
            mastodon: {
              succeeded: prevResults.mastodon.succeeded + (result.mastodon?.succeeded || 0),
              failed: prevResults.mastodon.failed + (result.mastodon?.failed || 0),
              failures: [...prevResults.mastodon.failures, ...(result.mastodon?.failures || [])]
            }
          };
        });

        // Update accountsToProcess to mark successfully followed accounts
        // Get the handles that failed so we can exclude them
        const failedBlueskyHandles = new Set(
          (result.bluesky?.failures || []).map((f: { handle: string }) => f.handle?.toLowerCase())
        );
        const failedMastodonHandles = new Set(
          (result.mastodon?.failures || []).map((f: { handle: string }) => f.handle?.toLowerCase())
        );

        // Get the node_ids of accounts in this batch
        const batchNodeIds = new Set(
          batchAccounts.map((acc: any) => 
            'node_id' in acc ? acc.node_id.toString() : acc.source_twitter_id
          )
        );

        // Update the accounts state to reflect successful follows
        console.log('📝 [useReconnectState] Updating accounts after batch follow:', {
          batchSize: batchAccounts.length,
          blueskySucceeded: result.bluesky?.succeeded || 0,
          mastodonSucceeded: result.mastodon?.succeeded || 0,
          failedBlueskyHandles: Array.from(failedBlueskyHandles),
          failedMastodonHandles: Array.from(failedMastodonHandles),
        });
        
        // Update graph highlighting cache with coord_hashes from API response
        if (onUpdateFollowingStatus) {
          const blueskyHashes = result.bluesky?.coordHashes || [];
          const mastodonHashes = result.mastodon?.coordHashes || [];
          
          if (blueskyHashes.length > 0) {
            onUpdateFollowingStatus(blueskyHashes, 'bluesky', true);
            console.log('📊 [useReconnectState] Updated graph cache for', blueskyHashes.length, 'Bluesky follows');
          }
          if (mastodonHashes.length > 0) {
            onUpdateFollowingStatus(mastodonHashes, 'mastodon', true);
            console.log('📊 [useReconnectState] Updated graph cache for', mastodonHashes.length, 'Mastodon follows');
          }
        }
        
        // Use setFollowingList which updates both states
        setFollowingListInternal((prevAccounts: MatchingTarget[]) => {
          let updatedCount = 0;
          const updatedAccounts = prevAccounts.map((acc: any) => {
            const nodeId = 'node_id' in acc ? acc.node_id.toString() : acc.source_twitter_id;
            
            // Only update accounts that were in this batch
            if (!batchNodeIds.has(nodeId)) return acc;

            const blueskyHandle = acc.bluesky_handle?.toLowerCase();
            const mastodonHandle = (acc.mastodon_handle || acc.mastodon_username)?.toLowerCase();

            // Check if follow succeeded (not in failures list)
            const blueskySucceeded = blueskyHandle && 
              result.bluesky?.succeeded > 0 && 
              !failedBlueskyHandles.has(blueskyHandle);
            const mastodonSucceeded = mastodonHandle && 
              result.mastodon?.succeeded > 0 && 
              !failedMastodonHandles.has(mastodonHandle);

            if (blueskySucceeded || mastodonSucceeded) {
              updatedCount++;
            }

            return {
              ...acc,
              has_follow_bluesky: acc.has_follow_bluesky || blueskySucceeded,
              has_been_followed_on_bluesky: acc.has_been_followed_on_bluesky || blueskySucceeded,
              has_follow_mastodon: acc.has_follow_mastodon || mastodonSucceeded,
              has_been_followed_on_mastodon: acc.has_been_followed_on_mastodon || mastodonSucceeded,
            };
          });
          console.log('📝 [useReconnectState] followingList updated:', {
            totalAccounts: prevAccounts.length,
            updatedCount,
            batchNodeIds: Array.from(batchNodeIds),
          });
          
          // Also update global cache to prevent stale data from overwriting
          if (typeof window !== 'undefined' && (window as any).__matchingNetworkState) {
            (window as any).__matchingNetworkState.data = updatedAccounts;
            console.log('📝 [useReconnectState] Global cache updated with new follow status');
          }
          
          return updatedAccounts;
        });
        // Also update accountsToProcess to keep them in sync
        setAccountsToProcessInternal((prevAccounts: AccountToFollow[]) => {
          return prevAccounts.map((acc: any) => {
            const nodeId = 'node_id' in acc ? acc.node_id.toString() : acc.source_twitter_id;
            if (!batchNodeIds.has(nodeId)) return acc;

            const blueskyHandle = acc.bluesky_handle?.toLowerCase();
            const mastodonHandle = (acc.mastodon_handle || acc.mastodon_username)?.toLowerCase();
            const blueskySucceeded = blueskyHandle && result.bluesky?.succeeded > 0 && !failedBlueskyHandles.has(blueskyHandle);
            const mastodonSucceeded = mastodonHandle && result.mastodon?.succeeded > 0 && !failedMastodonHandles.has(mastodonHandle);

            return {
              ...acc,
              has_follow_bluesky: acc.has_follow_bluesky || blueskySucceeded,
              has_been_followed_on_bluesky: acc.has_been_followed_on_bluesky || blueskySucceeded,
              has_follow_mastodon: acc.has_follow_mastodon || mastodonSucceeded,
              has_been_followed_on_mastodon: acc.has_been_followed_on_mastodon || mastodonSucceeded,
            };
          });
        });
      }

      setIsReconnectionComplete(true);
      setIsMigrating(false);
      // Réinitialiser la sélection après une migration réussie
      setSelectedAccounts(new Set());
      
      // Refetch stats after migration
      await refetchUserStatsAfterFollow();
      
      // Call onComplete callback to trigger personal network refetch
      // This will reload matching_found + followings-hashes via GraphDataContext
      if (onComplete) {
        console.log('🔄 [useReconnectState] Calling onComplete callback (refetchPersonalData)...');
        onComplete();
      }
      
    } catch (error) {
      console.error('handleStartMigration: Error:', error);
      setIsMigrating(false);
      // Réinitialiser la sélection même en cas d'erreur
      setSelectedAccounts(new Set());
      
      // Même en cas d'erreur, essayons de rafraîchir les stats
      // car il se peut que certains follows aient réussi
      try {
        await refetchUserStatsAfterFollow();
        // onComplete will handle matching_found + followings-hashes via GraphDataContext
        if (onComplete) {
          onComplete();
        }
      } catch (refreshError) {
        console.error('Failed to refresh stats after error:', refreshError);
      }
    }
  };

  return {
    session,
    update,
    stats,
    globalStats,
    mastodonInstances,
    isLoading,
    setIsLoading,
    isMigrating,
    setIsMigrating,
    showOptions,
    setShowOptions,
    isAutomaticReconnect,
    setIsAutomaticReconnect,
    invalidTokenProviders,
    setInvalidTokenProviders,
    accountsToProcess,
    setAccountsToProcess,
    selectedAccounts,
    setSelectedAccounts,
    activeTab,
    setActiveTab,
    showModaleResults,
    setShowModaleResults,
    migrationResults,
    setMigrationResults,
    missingProviders,
    setMissingProviders,
    isReconnectionComplete,
    setIsReconnectionComplete,
    hasMastodon,
    hasBluesky,
    hasTwitter,
    hasOnboarded,
    connectedServicesCount,
    handleAutomaticMode,
    handleManualMode,
    toggleAutomaticReconnect,
    handleAutomaticReconnection,
    handleManualReconnection,
    handleStartMigration,
    followingList,
    refetchUserStatsAfterFollow,
    refreshStats,
    // Followers (loaded in background)
    followersList,
    isLoadingFollowers,
    followersCount,
    fetchFollowersList,
    // Selected accounts breakdown by platform (for progress panel)
    selectedBreakdown,
  };
}
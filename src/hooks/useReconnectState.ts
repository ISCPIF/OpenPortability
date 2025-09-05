// src/hooks/useReconnectState.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useStats } from './useStats';
import { useMastodonInstances } from './useMastodonInstances';
import { MatchingTarget, MatchedFollower } from '@/lib/types/matching';
import { useAuthTokens } from './useAuthTokens'; // Import useAuthTokens

type AccountToFollow = MatchingTarget | MatchedFollower;

// Module-level variables to track API calls across component instances
// This helps with React Strict Mode double-mounting
const globalMatchesFetched = { current: false };
// Shared promise for concurrent matching requests
let activeMatchingPromise: Promise<any> | null = null;

// Type pour la liste des followings
interface FollowingListResponse {
  following: MatchingTarget[]
}

export function useReconnectState() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { stats, globalStats, isLoading: statsLoading, refreshStats } = useStats();
  const mastodonInstances = useMastodonInstances();
  const { missingProviders: authMissingProviders, verifyTokens: authVerifyTokens } = useAuthTokens();
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  const [isAutomaticReconnect, setIsAutomaticReconnect] = useState(false);
  const [invalidTokenProviders, setInvalidTokenProviders] = useState<string[]>([]);
  
  // NOUVEAU: État séparé pour la liste des followings seulement
  const [followingList, setFollowingList] = useState<MatchingTarget[]>([]);
  
  // Garder accountsToProcess pour compatibilité (sera supprimé plus tard)
  const [accountsToProcess, setAccountsToProcess] = useState<AccountToFollow[]>([]);
  
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'mastodon' | 'bluesky'>('bluesky');
  const [showModaleResults, setShowModaleResults] = useState(false);
  const [migrationResults, setMigrationResults] = useState<{ 
    bluesky: { attempted: number; succeeded: number }; 
    mastodon: { attempted: number; succeeded: number } 
  } | null>(null);
  const [missingProviders, setMissingProviders] = useState<('bluesky' | 'mastodon')[]>([]);
  const [isReconnectionComplete, setIsReconnectionComplete] = useState(false);
  
  // Use ref to track API calls
  const matchesFetchedRef = useRef(globalMatchesFetched.current);
  
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
      setMissingProviders(authMissingProviders);
    }
  }, [authMissingProviders]);

  // NOUVEAU: Fonction pour récupérer la liste des followings
  const fetchFollowingList = useCallback(async () => {
    try {
      const response = await fetch('/api/migrate/matching_found', {
        headers: {
          'Cache-Control': 'no-cache',
          'X-Request-ID': `following-list-${Date.now()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }


      const followingData = await response.json();
      console.log("following dsata from matching found is ->", followingData)
      
      // Adapter selon la structure actuelle de l'API (sera simplifié plus tard)
      const followingArray = followingData.matches?.following || followingData.following || [];
      setFollowingList(followingArray);
      
      // Maintenir compatibilité avec l'ancien système
      setAccountsToProcess(followingArray);
      
      // console.log("===== FOLLOWING LIST FETCHED =====");
      // console.log("Following data:", JSON.stringify(followingData, null, 2));
      // console.log("Following array length:", followingArray.length);
      // console.log("===================================");
      
      return followingArray;
    } catch (error) {
      console.error('fetchFollowingList: Error:', error);
      throw error;
    }
  }, []);

  // REFACTORISÉ: fetchMatches maintenant appelle seulement fetchFollowingList (stats géré par useStats)
  const fetchMatches = useCallback(async () => {
    // Skip if already fetched (check both local and global state)
    if (matchesFetchedRef.current || globalMatchesFetched.current) {
      matchesFetchedRef.current = true;
      globalMatchesFetched.current = true;
      return;
    }
    
    // If there's an active matching request in progress, reuse that promise
    if (activeMatchingPromise) {
      return activeMatchingPromise;
    }
    
    activeMatchingPromise = (async () => {
      try {
        // Appeler seulement fetchFollowingList (stats déjà géré par useStats)
        await fetchFollowingList();
        
        matchesFetchedRef.current = true;
        globalMatchesFetched.current = true;
        
      } catch (error) {
        console.error('fetchMatches: Error:', error);
        throw error;
      } finally {
        activeMatchingPromise = null;
      }
    })();
    
    return activeMatchingPromise;
  }, [fetchFollowingList]);

  // NOUVEAU: Fonction pour re-fetch les stats après un follow (le cache a déjà été mis à jour par la DB)
  const refetchUserStatsAfterFollow = useCallback(async () => {
    try {
      console.log("🔄 [refetchUserStatsAfterFollow] Starting stats refresh...");
      
      // Attendre 5 secondes pour que le webhook PostgreSQL termine
      console.log("⏳ [refetchUserStatsAfterFollow] Waiting 5s for cache update...");
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      await refreshStats();
      
      console.log("✅ [refetchUserStatsAfterFollow] Stats refresh completed");
    } catch (error) {
      console.error('❌ [refetchUserStatsAfterFollow] Error:', error);
    }
  }, [refreshStats]);

  // Reset global flags when user session changes
  useEffect(() => {
    if (session?.user?.id) {
    } else {
      globalMatchesFetched.current = false;
      matchesFetchedRef.current = false;
    }
  }, [session?.user?.id]);

  // Vérifier les tokens et charger les données
  useEffect(() => {

    if (status === "unauthenticated") {
      router.replace("/auth/signin");
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
    if (!session.user?.has_onboarded && !session.user?.twitter_id) {
      router.replace("/dashboard");
      return;
    }

    let mounted = true;
    const loadData = async () => {      
      try {
        await authVerifyTokens();
        
        if (!mounted) return;

        if (session.user?.has_onboarded || session.user?.twitter_id) {
          await fetchMatches();
        }
        
        if (!mounted) return;

        // Mettre à jour l'état de chargement même si stats n'est pas encore disponible
        setIsLoading(false);
      } catch (error) {
        console.error('loadData: Error:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [session?.user?.id, status]); // Uniquement se déclencher sur les changements d'ID utilisateur et de status

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
    const allAccountIds = accountsToProcess.map(match => 
      'node_id' in match ? match.node_id.toString() : match.source_twitter_id
    );
    handleStartMigration(allAccountIds);
  };

  // Fonction pour démarrer la migration manuelle
  const handleManualReconnection = async () => {
    await handleManualMode();
  };

  // Fonction pour démarrer la migration
  const handleStartMigration = async (selectedAccounts: string[]) => {
    console.log(" [handleStartMigration] Called with selectedAccounts:", selectedAccounts);
    console.log(" [handleStartMigration] selectedAccounts length:", selectedAccounts.length);
    console.log(" [handleStartMigration] accountsToProcess length:", accountsToProcess.length);
    
    try {
      setIsMigrating(true);
      
      // Get all selected accounts and handle both types
      const accountsToMigrate = accountsToProcess.filter(match => {
        const twitterId = 'node_id' in match 
          ? match.node_id.toString()
          : match.source_twitter_id;
        const isSelected = selectedAccounts.includes(twitterId);
        
        console.log(" [handleStartMigration] Checking account:", {
          twitterId,
          isSelected,
          matchType: 'node_id' in match ? 'MatchingTarget' : 'MatchedFollower'
        });
        
        return isSelected;
      });

      console.log(" [handleStartMigration] Filtered accountsToMigrate:", accountsToMigrate.length);
      console.log(" [handleStartMigration] accountsToMigrate details:", accountsToMigrate);
      
      // Initialize progress tracking with total matches
      const initialResults = {
        bluesky: {
          attempted: accountsToMigrate.filter(acc => {
            const hasFollowed = 'has_follow_bluesky' in acc 
              ? acc.has_follow_bluesky 
              : acc.has_been_followed_on_bluesky;
            return !hasFollowed;
          }).length,
          succeeded: accountsToMigrate.filter(acc => {
            const hasFollowed = 'has_follow_bluesky' in acc 
              ? acc.has_follow_bluesky 
              : acc.has_been_followed_on_bluesky;
            return hasFollowed;
          }).length
        },
        mastodon: {
          attempted: accountsToMigrate.filter(acc => {
            const hasFollowed = 'has_follow_mastodon' in acc 
              ? acc.has_follow_mastodon 
              : acc.has_been_followed_on_mastodon;
            return !hasFollowed;
          }).length,
          succeeded: accountsToMigrate.filter(acc => {
            const hasFollowed = 'has_follow_mastodon' in acc 
              ? acc.has_follow_mastodon 
              : acc.has_been_followed_on_mastodon;
            return hasFollowed;
          }).length
        }
      };
      setMigrationResults(initialResults);

      console.log("********")
      console.log("batchAccounts", accountsToMigrate)
      console.log("********")

      // Process in batches, excluding already followed accounts
      const BATCH_SIZE = 25;
      let remainingAccounts = accountsToMigrate.filter(acc => {
        const hasFollowedBluesky = 'has_follow_bluesky' in acc 
          ? acc.has_follow_bluesky 
          : acc.has_been_followed_on_bluesky;
        const hasFollowedMastodon = 'has_follow_mastodon' in acc 
          ? acc.has_follow_mastodon 
          : acc.has_been_followed_on_mastodon;
        return (!hasFollowedBluesky && session?.user?.bluesky_username) || 
               (!hasFollowedMastodon && session?.user?.mastodon_username);
      });

      console.log("********")
        console.log("batchAccounts", accountsToMigrate)
        console.log("type of accounts.node_id -->", typeof accountsToMigrate[0].node_id)
        console.log("type of accounts -->", typeof accountsToMigrate[0])
        console.log("********")

      for (let i = 0; i < remainingAccounts.length; i += BATCH_SIZE) {
        const batchAccounts = remainingAccounts.slice(i, i + BATCH_SIZE);
        
        const response = await fetch('/api/migrate/send_follow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accounts: batchAccounts }),
        });
        
        if (response.status === 500 && response.error === 'InvalidToken') {
          setInvalidTokenProviders(['bluesky']);
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to process batch ${i / BATCH_SIZE + 1}`);
        }

        const result = await response.json();

        // Update progress based on batch results
        setMigrationResults(prevResults => {
          if (!prevResults) return initialResults;

          return {
            bluesky: {
              attempted: prevResults.bluesky.attempted,
              succeeded: prevResults.bluesky.succeeded + (result.bluesky?.succeeded || 0)
            },
            mastodon: {
              attempted: prevResults.mastodon.attempted,
              succeeded: prevResults.mastodon.succeeded + (result.mastodon?.succeeded || 0)
            }
          };
        });
      }

      setIsReconnectionComplete(true);
      setIsMigrating(false);
      await refetchUserStatsAfterFollow();
      
    } catch (error) {
      console.error('handleStartMigration: Error:', error);
      setIsMigrating(false);
      
      // Même en cas d'erreur, essayons de rafraîchir les stats
      // car il se peut que certains follows aient réussi
      try {
        console.log(" Attempting stats refresh despite error...");
        await refetchUserStatsAfterFollow();
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
    refreshStats
  };
}
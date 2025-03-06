// src/hooks/useReconnectState.ts
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useStats } from './useStats';
import { useMastodonInstances } from './useMastodonInstances';
import { MatchingTarget, MatchedFollower } from '@/lib/types/matching';

type AccountToFollow = MatchingTarget | MatchedFollower;

export function useReconnectState() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { stats, globalStats, isLoading: statsLoading, refreshStats } = useStats();
  const mastodonInstances = useMastodonInstances();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  const [isAutomaticReconnect, setIsAutomaticReconnect] = useState(false);
  const [invalidTokenProviders, setInvalidTokenProviders] = useState<string[]>([]);
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

  // Vérifier les tokens et charger les données
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
      return;
    }
    
    if (!session?.user?.has_onboarded && !session?.user?.twitter_id) {
      router.replace("/dashboard");
      return;
    }

    const verifyTokens = async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        const data = await response.json();

        if (!data.success && data.providers) {
          setMissingProviders(data.providers);
        }
      } catch (error) {
        console.error('Error verifying tokens:', error);
      }
    };

    const fetchMatches = async () => {
      try {
        const matchesResponse = await fetch('/api/migrate/matching_found', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        const matchesData = await matchesResponse.json();
        setAccountsToProcess(matchesData.matches.following);

        if (matchesData.error) {
          console.error("Error fetching matches:", matchesData.error);
        }
      } catch (error) {
        console.error("Error in fetchMatches:", error);
      }
    };

    const loadData = async () => {
      await verifyTokens();
      
      if (session?.user?.has_onboarded || session?.user?.twitter_id) {
        await fetchMatches();
      }
      
      // if (session?.user?.hasOwnProperty('automatic_reconnect')) {
      //   setIsAutomaticReconnect(Boolean(session.user.automatic_reconnect));
      // }
      
      setIsLoading(false);
    };

    if (session) {
      loadData();
    } else {
      setIsLoading(status === "loading" || statsLoading);
    }
  }, [session, status, router, statsLoading]);

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
      console.error('Error updating automatic reconnect:', error);
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
      'target_twitter_id' in match ? match.target_twitter_id : match.source_twitter_id
    );
    handleStartMigration(allAccountIds);
  };

  // Fonction pour démarrer la migration manuelle
  const handleManualReconnection = async () => {
    await handleManualMode();
  };

  // Fonction pour démarrer la migration
  const handleStartMigration = async (selectedAccounts: string[]) => {
    try {
      setIsMigrating(true);
      
      // Get all selected accounts and handle both types
      const accountsToMigrate = accountsToProcess.filter(match => {
        const twitterId = 'target_twitter_id' in match 
          ? match.target_twitter_id 
          : match.source_twitter_id;
        return selectedAccounts.includes(twitterId);
      });

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

      // Update user stats after migration is complete
      try {
        await fetch('/api/update/user_stats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Error updating user stats:', error);
      }

      setIsReconnectionComplete(true);
      setIsMigrating(false);
      refreshStats();
      
    } catch (error) {
      console.error('Error during migration:', error);
      setIsMigrating(false);
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
    refreshStats
  };
}
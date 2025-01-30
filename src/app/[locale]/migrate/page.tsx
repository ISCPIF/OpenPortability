'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { plex } from '@/app/fonts/plex'
import Header from '@/app/_components/Header'
import LoadingIndicator from '@/app/_components/LoadingIndicator'
import Footer from '@/app/_components/Footer'
import { MatchingTarget, MatchingStats } from '@/lib/types/matching'

// Dynamic imports for heavy components
const MigrateSea = dynamic(() => import('@/app/_components/MigrateSea'), {
  loading: () => <div className="animate-pulse bg-blue-900/50 h-[600px]" />
})

const MigrateStats = dynamic(() => import('@/app/_components/MigrateStats'), {
  loading: () => <div className="animate-pulse bg-blue-900/50 h-24" />
})

const SuccessAutomaticReconnexion = dynamic(() => import('@/app/_components/SuccessAutomaticReconnexion'), {
  loading: () => <LoadingIndicator msg="Loading success view" />
})

const AutomaticReconnexion = dynamic(() => import('@/app/_components/AutomaticReconnexion'), {
  loading: () => <LoadingIndicator msg="Automatic" />
})

const ReconnexionOptions = dynamic(() => import('@/app/_components/ReconnexionOptions'), {
  loading: () => <LoadingIndicator msg="Reconnection options" />
})

const ManualReconnexion = dynamic(() => import('@/app/_components/ManualReconnexion'), {
  loading: () => <LoadingIndicator msg="Manual" />
})

const RefreshTokenModale = dynamic(() => import('@/app/_components/RefreshTokenModale'), {
  ssr: false
})

type Stats = {
  connections: {
    followers: number;
    following: number;
  };
  matches: {
    bluesky: {
      total: number;
      hasFollowed: number;
      notFollowed: number;
    };
    mastodon: {
      total: number;
      hasFollowed: number;
      notFollowed: number;
    };
  };
};

type GlobalStats = {
  connections: {
    followers: number;
    following: number;
  };
  matches: {
    bluesky: {
      total: number;
      hasFollowed: number;
      notFollowed: number;
    };
    mastodon: {
      total: number;
      hasFollowed: number;
      notFollowed: number;
    };
  };
};

export default function MigratePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const t = useTranslations('migrate')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMigrating, setIsMigrating] = useState(false)
  const [showOptions, setShowOptions] = useState(true)
  const [isAutomaticReconnect, setIsAutomaticReconnect] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showRefreshTokenModal, setShowRefreshTokenModal] = useState(false)
  const [invalidTokenProviders, setInvalidTokenProviders] = useState<string[]>([])
  const [accountsToProcess, setAccountsToProcess] = useState<MatchingTarget[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'mastodon' | 'bluesky'>('bluesky')
  const [stats, setStats] = useState<Stats | null>(null)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [showModaleResults, setShowModaleResults] = useState(false)
  const [migrationResults, setMigrationResults] = useState<{ bluesky: { attempted: number; succeeded: number }; mastodon: { attempted: number; succeeded: number } } | null>(null)
  const [missingProviders, setMissingProviders] = useState<string[]>([])
  const [isReconnectionComplete, setIsReconnectionComplete] = useState(false)

  // Memoized token check function
  const checkTokens = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await response.json()

      if (!data.success) {
        setInvalidTokenProviders(data.providers || [])
        setShowRefreshTokenModal(true)
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking tokens:', error)
      return false
    }
  }

  useEffect(() => {
    if (!session?.user?.id || !session.user?.has_onboarded) {
      return
    }

    const checkUserProfile = async () => {
      setUserProfile(session.user)

      // Parallel API calls
      const [tokensCheck, matchesResponse, statsResponse] = await Promise.all([
        checkTokens(),
        fetch('/api/migrate/matching_found', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        }),
        fetch('/api/stats/total', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
      ])

      const matchesData = await matchesResponse.json()
      const statsData: GlobalStats = await statsResponse.json()
      console.log("****************************************",matchesData)
      
      if (matchesData.error) {
        console.error("Error fetching matches:", matchesData.error)
        setIsLoading(false)
        return
      }
      
      const matches = matchesData.matches.following
      
      // Store the full matches data for migration
      setAccountsToProcess(matches)
      
      // Use reduce for better performance with large datasets
      const stats = matches.reduce((acc, match) => {
        return {
          connections: {
            followers: 0, // This will be updated from the global stats
            following: acc.connections.following + (match.bluesky_handle || match.mastodon_username ? 1 : 0)
          },
          matches: {
            bluesky: {
              total: acc.matches.bluesky.total + (match.bluesky_handle ? 1 : 0),
              hasFollowed: acc.matches.bluesky.hasFollowed + (match.has_follow_bluesky ? 1 : 0),
              notFollowed: acc.matches.bluesky.notFollowed + (match.bluesky_handle && !match.has_follow_bluesky ? 1 : 0)
            },
            mastodon: {
              total: acc.matches.mastodon.total + (match.mastodon_username ? 1 : 0),
              hasFollowed: acc.matches.mastodon.hasFollowed + (match.has_follow_mastodon ? 1 : 0),
              notFollowed: acc.matches.mastodon.notFollowed + (match.mastodon_username && !match.has_follow_mastodon ? 1 : 0)
            }
          }
        };
      }, {
        connections: {
          followers: 0,
          following: 0
        },
        matches: {
          bluesky: {
            total: 0,
            hasFollowed: 0,
            notFollowed: 0
          },
          mastodon: {
            total: 0,
            hasFollowed: 0,
            notFollowed: 0
          }
        }
      });

      setStats(stats)
      setGlobalStats(statsData)
      console.log("****************************************",stats)
      setIsLoading(false)
    }

    checkUserProfile()

    console.log("session from /migrate", session)
  }, [session?.user?.id, session?.user?.has_onboarded])

  // Fonction pour vérifier les tokens
  const handleAutomaticMode = async () => {
    setIsAutomaticReconnect(true)
    await updateAutomaticReconnect(true)
  }

  // Gestionnaire pour le mode manuel
  const handleManualMode = async () => {
    setIsAutomaticReconnect(false)
    await updateAutomaticReconnect(false)
  }

  const handleToggleAccount = (twitterId: string) => {
    setSelectedAccounts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(twitterId)) {
        newSet.delete(twitterId)
      } else {
        newSet.add(twitterId)
      }
      return newSet
    })
  }

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
      // await updateSession(); // Met à jour la session avec les nouvelles données
    } catch (error) {
      console.error('Error updating automatic reconnect:', error);
    }
  };

  const handleAutomaticReconnection = async () => {
    await handleAutomaticMode();
    // Démarrer la migration automatique avec tous les comptes
    const allAccountIds = accountsToProcess.map(match => match.target_twitter_id);
    handleStartMigration(allAccountIds);
  };

  const handleManualReconnection = async () => {
    await handleManualMode();
    setShowOptions(false);
  };

  const toggleAutomaticReconnect = async () => {
    const newValue = !isAutomaticReconnect;
    await updateAutomaticReconnect(newValue);
    setIsAutomaticReconnect(newValue);
  };

  const handleStartMigration = async (selectedAccounts: string[]) => {
    try {
      setIsMigrating(true);
      console.log('Starting migration for accounts:', selectedAccounts);

      // Get all selected accounts
      const accountsToMigrate = accountsToProcess.filter(match => 
        selectedAccounts.includes(match.target_twitter_id)
      );

      // Initialize progress tracking with total matches
      const initialResults = {
        bluesky: {
          attempted: accountsToMigrate.filter(acc => !acc.has_follow_bluesky).length,
          succeeded: accountsToMigrate.filter(acc => acc.has_follow_bluesky).length
        },
        mastodon: {
          attempted: accountsToMigrate.filter(acc => !acc.has_follow_mastodon).length,
          succeeded: accountsToMigrate.filter(acc => acc.has_follow_mastodon).length
        }
      };
      setMigrationResults(initialResults);

      // Process in batches, excluding already followed accounts
      const BATCH_SIZE = 25;
      let remainingAccounts = accountsToMigrate.filter(acc => 
        (!acc.has_follow_bluesky && session?.user?.bluesky_username) || 
        (!acc.has_follow_mastodon && session?.user?.mastodon_username)
      );

      for (let i = 0; i < remainingAccounts.length; i += BATCH_SIZE) {
        const batchAccounts = remainingAccounts.slice(i, i + BATCH_SIZE);
        
        console.log('Sending batch to API:', batchAccounts);
        
        const response = await fetch('/api/migrate/send_follow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accounts: batchAccounts }),
        });
        
        if (response.status === 500 && response.error === 'InvalidToken') {
          console.log('Invalid token detected during migration');
          setInvalidTokenProviders(['bluesky']);
          setShowRefreshTokenModal(true);
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to process batch ${i / BATCH_SIZE + 1}`);
        }

        const result = await response.json();
        console.log('Results from send_follow:', result);

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

      // Migration completed
      setIsReconnectionComplete(true);
      setIsMigrating(false);
      
      // Refresh the session to update follow status
      // await updateSession();
    } catch (error) {
      console.error('Error during migration:', error);
      setIsMigrating(false);
    }
  };

  const refreshStats = async () => {
    try {
      const response = await fetch('/api/stats')
      if (response.ok) {
        const newStats = await response.json()
        console.log("API response stats:", newStats)
        setStats({
          connections: newStats.connections,
          matches: newStats.matches
        })
      }
    } catch (error) {
      console.error('Error refreshing stats:', error)
    }
  }

  return (
    <main className="min-h-screen bg-[#2a39a9]">
      <div className="w-full max-w-[90rem] m-auto">
        <div className="bg-[#2a39a9]">
          <Header />
          
          <Suspense fallback={<div className="animate-pulse bg-blue-900/50 h-[600px]" />}>
            <MigrateSea />
          </Suspense>

          <div className="relative">
            <Suspense fallback={<div className="animate-pulse bg-blue-900/50 h-24" />}>
              <MigrateStats 
                stats={stats} 
                session={{
                  user: {
                    twitter_username: session?.user?.twitter_username ?? "",
                    bluesky_username: session?.user?.bluesky_username ?? "",
                    mastodon_username: session?.user?.mastodon_username ?? ""
                  }
                }}
              />
            </Suspense>
          </div>
          
          <div className="bg-[#2a39a9]">
            <Suspense fallback={<LoadingIndicator msg="Loading..." />}>
            {isReconnectionComplete && session && stats ? (
                <SuccessAutomaticReconnexion
                  session={{
                    user: {
                      twitter_username: session.user.twitter_username ?? "",
                      bluesky_username: session.user.bluesky_username ?? "",
                      mastodon_username: session.user.mastodon_username ?? ""
                    }
                  }}
                  stats={stats}
                  onSuccess={refreshStats}
                />
              ) : isAutomaticReconnect ? (
                <AutomaticReconnexion
                  results={migrationResults || { bluesky: { attempted: 0, succeeded: 0 }, mastodon: { attempted: 0, succeeded: 0 } }}
                  onPause={toggleAutomaticReconnect}
                  session={{
                    user: {
                      bluesky_username: session?.user?.bluesky_username ?? null,
                      mastodon_username: session?.user?.mastodon_username ?? null
                    }
                  }}
                  stats={{
                    bluesky_matches: stats?.matches.bluesky.total ?? 0,
                    mastodon_matches: stats?.matches.mastodon.total ?? 0,
                    matched_following: stats?.connections.following ?? 0
                  }}
                />
              ) : showOptions ? (
                <ReconnexionOptions
                  onAutomatic={handleAutomaticReconnection}
                  onManual={handleManualReconnection}
                  globalStats={globalStats}
                />
              ) : (
                <ManualReconnexion
                  matches={accountsToProcess}
                  onStartMigration={handleStartMigration}
                  onToggleAutomaticReconnect={handleAutomaticReconnection}
                  session={{
                    user: {
                      bluesky_username: session?.user?.bluesky_username ?? null,
                      mastodon_username: session?.user?.mastodon_username ?? null
                    }
                  }}
                />
              )}
            </Suspense>
          </div>

          {showRefreshTokenModal && (
            <RefreshTokenModale
              onClose={() => setShowRefreshTokenModal(false)}
              providers={invalidTokenProviders}
              onReconnectMastodon={() => {
                setShowRefreshTokenModal(false)
                const mastodonButton = document.querySelector('[data-testid="mastodon-login-button"]')
                if (mastodonButton) {
                  (mastodonButton as HTMLElement).click()
                }
              }}
            />
          )}

          <Footer />
        </div>
      </div>
    </main>
  )
}
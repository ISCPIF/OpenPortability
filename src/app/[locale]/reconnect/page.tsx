'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, redirect } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic'
import { Upload } from 'lucide-react';

import { plex } from '@/app/fonts/plex'
import Header from '@/app/_components/Header'
import LoadingIndicator from '@/app/_components/LoadingIndicator'
import Footer from '@/app/_components/Footer'
import { UserCompleteStats, GlobalStats } from '@/lib/types/stats'
import { time } from 'console'
import Link from 'next/link'
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons'
import StatsReconnexion from '@/app/_components/StatsReconnexion'
import { MatchingTarget, MatchedFollower, MatchingStats } from '@/lib/types/matching'

// Dynamic imports for heavy components
const MigrateSea = dynamic(() => import('@/app/_components/MigrateSea'), {
  loading: () => <div className="animate-pulse bg-blue-900/50 h-[600px]" />
})

const MigrateStats = dynamic(() => import('@/app/_components/MigrateStats'), {
  loading: () => <div className="animate-pulse bg-blue-900/50 h-24" />
})

const SuccessAutomaticReconnexion = dynamic(() => import('@/app/_components/SuccessAutomaticReconnexion'), {
  loading: () => <div className="flex justify-center"><LoadingIndicator msg="Loading success view" /></div>
})

const AutomaticReconnexion = dynamic(() => import('@/app/_components/AutomaticReconnexion'), {
  loading: () => <div className="flex justify-center"><LoadingIndicator msg="Automatic" /></div>
})

const ReconnexionOptions = dynamic(() => import('@/app/_components/ReconnexionOptions'), {
  loading: () => <div className="flex justify-center"><LoadingIndicator msg="Reconnection options" /></div>
})

const ManualReconnexion = dynamic(() => import('@/app/_components/ManualReconnexion'), {
  loading: () => <div className="flex justify-center"><LoadingIndicator msg="Manual" /></div>
})

type AccountToFollow = MatchingTarget | MatchedFollower;

export default function MigratePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations('migrate')
  const tRefresh = useTranslations('refreshToken')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMigrating, setIsMigrating] = useState(false)
  const [showOptions, setShowOptions] = useState(true)
  const [isAutomaticReconnect, setIsAutomaticReconnect] = useState(false)
  const [invalidTokenProviders, setInvalidTokenProviders] = useState<string[]>([])
  const [accountsToProcess, setAccountsToProcess] = useState<AccountToFollow[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'mastodon' | 'bluesky'>('bluesky')
  const [stats, setStats] = useState<UserCompleteStats | null>(null)
  const [globalStats, setGlobalStats] = useState<GlobalStats | undefined>(undefined)
  const [showModaleResults, setShowModaleResults] = useState(false)
  const [migrationResults, setMigrationResults] = useState<{ bluesky: { attempted: number; succeeded: number }; mastodon: { attempted: number; succeeded: number } } | null>(null)
  const [missingProviders, setMissingProviders] = useState<('bluesky' | 'mastodon')[]>([])
  const [isReconnectionComplete, setIsReconnectionComplete] = useState(false)
  const [mastodonInstances, setMastodonInstances] = useState<string[]>([])

  useEffect(() => {
    if (!session.user.has_onboarded && !session.user.twitter_id)
    {
      redirect('/dashboard')
      return 
    }
    const verifyTokens = async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        const data = await response.json()

        if (!data.success && data.providers) {
          setMissingProviders(data.providers)
        }
      } catch (error) {
        console.error('Error verifying tokens:', error)
      }
    }
    const fetchMastodonInstances = async () => {
      try {
        const response = await fetch('/api/auth/mastodon')
        const data = await response.json()
        if (data.success) {
          setMastodonInstances(data.instances)
        }
      } catch (error) {
        console.error('Error fetching Mastodon instances:', error)
      }
    }
    const fetchMatches = async () => {
      try {
        const matchesResponse = await fetch('/api/migrate/matching_found', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        const matchesData = await matchesResponse.json();
        setAccountsToProcess(matchesData.matches.following);

        console.log(matchesData.matches.following)
        if (matchesData.error) {
          console.error("Error fetching matches:", matchesData.error);
          return;
        }
      } catch (error) {
        console.error("Error in fetchMatches:", error);
      }
    };
    const checkUserProfile = async () => {
      setUserProfile(session.user)

      // Parallel API calls
      console.log("CHECKING USER PROFILE")
      const [userStatsResponse, globalStatsResponse] = await Promise.all([
        fetch('/api/stats', {
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

      const userStats = await userStatsResponse.json()

      console.log("userStats --->", userStats)
      const globalStats: GlobalStats = await globalStatsResponse.json()
      
      if (userStats.error) {
        console.error("Error fetching user stats:", userStats.error)
        // setIsLoading(false)
        return
      }
      
      setStats(userStats)
      setGlobalStats(globalStats)
      // setIsLoading(false)
    }

    verifyTokens()
    checkUserProfile()
    if (session.user.has_onboarded || session.user.twitter_id) {
      console.log("Fetching matches")
      fetchMatches();
    }
    if (missingProviders.length > 0 || !session.user.mastodon_username) {
      console.log("Fetching mastodon instances")
      fetchMastodonInstances()
    }
    setIsLoading(false)
  }, []) // Ce useEffect s'exécute une seule fois au chargement

  

  


  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#2a39a9] backdrop-blur-sm z-50 flex items-center justify-center">
        <LoadingIndicator msg={t('loading')} />
      </div>
    )
  }

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

      setIsReconnectionComplete(true);
      setIsMigrating(false);
      
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
          matches: newStats.matches,
          updated_at: "2024-01-30"
        })
      }
    } catch (error) {
      console.error('Error refreshing stats:', error)
    }
  }

  return (
    <main className="min-h-screen bg-[#2a39a9]">
      <div className=" max-w-[90%] m-auto">
        <div className="">
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
                simpleView={!session?.user?.bluesky_username && !session?.user?.mastodon_username}                
              />
            </Suspense>

            {!session?.user?.bluesky_username && !session?.user?.mastodon_username && (
              <div className="bg-[#2a39a9] rounded-xl px-32 ">
                <h2 className="text-2xl font-bold mb-4 text-white text-center uppercase tracking-wider mb-4">{t('needBothAccounts')}</h2>
                {/* <p className="text-blue-100 mb-6">{t('connectBothAccountsDescription')}</p> */}
                
                <DashboardLoginButtons
                  connectedServices={{
                    bluesky: !!session?.user?.bluesky_username,
                    mastodon: !!session?.user?.mastodon_username,
                    twitter: true
                  }}
                  hasUploadedArchive={true}
                  onLoadingChange={setIsLoading}
                  mastodonInstances={mastodonInstances}
                  isRefreshToken={false}
                  blueskyNotFollowed={stats?.matches.bluesky.notFollowed ?? 0}
                  mastodonNotFollowed={stats?.matches.mastodon.notFollowed ?? 0}
                />
              </div>
            )}
          </div>

          <div className="bg-[#2a39a9] mt-4">
          {missingProviders.length > 0 && (stats?.matches.bluesky.notFollowed > 0 || stats?.matches.mastodon.notFollowed > 0) ? (
              <div className="bg-[#2a39a9] rounded-xl p-8 max-w-[50rem] mx-auto border border-white">
                <h2 className="text-2xl font-semibold text-white text-center uppercase tracking-wider">{tRefresh('title')}</h2>
                {/* <p className="text-blue-100 mb-6">{tRefresh('description')}</p> */}
                
                <DashboardLoginButtons
                  connectedServices={{
                    bluesky: !missingProviders.includes('bluesky'),
                    mastodon: !missingProviders.includes('mastodon'),
                    twitter: true
                  }}
                  hasUploadedArchive={true}
                  onLoadingChange={setIsLoading}
                  mastodonInstances={mastodonInstances}
                  isRefreshToken={true}
                  blueskyNotFollowed={stats?.matches.bluesky.notFollowed ?? 0}
                  mastodonNotFollowed={stats?.matches.mastodon.notFollowed ?? 0}
                />
              </div>
            ) : (
              <Suspense fallback={<LoadingIndicator msg="Loading..." />}>
                {(session?.user?.bluesky_username || session?.user?.mastodon_username) && (
                  <div>
                    {(isReconnectionComplete || (stats && (stats.matches.bluesky.hasFollowed > 0 || stats.matches.mastodon.hasFollowed > 0))) && session && stats ? (
                      <SuccessAutomaticReconnexion
                        session={{
                          user: {
                            twitter_username: session.user?.twitter_username || session.user?.bluesky_username || session.user?.mastodon_username || '',
                            bluesky_username: session.user.bluesky_username ?? "",
                            mastodon_username: session.user.mastodon_username ?? "",
                            mastodon_instance: session.user.mastodon_instance ?? ""
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
                    ) : showOptions && (session?.user?.bluesky_username || session?.user?.mastodon_username) ? (
                      <ReconnexionOptions
                        onAutomatic={handleAutomaticReconnection}
                        onManual={handleManualReconnection}
                        globalStats={globalStats}
                        has_onboarded={session?.user?.has_onboarded}
                      />
                    ) : (session?.user?.bluesky_username || session?.user?.mastodon_username) && (
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
                  </div>
                )}
              </Suspense>
            )}
          </div>
          <div className="w-full flex justify-center mb-12">
            <div className="max-w-[50rem] w-full">
              <StatsReconnexion globalStats={globalStats} />
            </div>
          </div>

          {((session?.user?.bluesky_username && !session?.user?.mastodon_username) || (!session?.user?.bluesky_username && session?.user?.mastodon_username)) && (
            <div className="flex items-center justify-center w-full mb-12">
              <div className="bg-[#2a39a9] rounded-xl flex gap-2">
                <div className="flex max-w-[50rem]">
                  <DashboardLoginButtons
                    connectedServices={{
                      bluesky: !!session?.user?.bluesky_username,
                      mastodon: !!session?.user?.mastodon_username,
                      twitter: true
                    }}
                    hasUploadedArchive={true}
                    onLoadingChange={setIsLoading}
                    mastodonInstances={mastodonInstances}
                    isRefreshToken={false}
                    blueskyNotFollowed={stats?.matches.bluesky.notFollowed ?? 0}
                    mastodonNotFollowed={stats?.matches.mastodon.notFollowed ?? 0}
                  />
                </div>
              </div>
            </div>
          )}
          <Footer />
        </div>
      </div>
    </main>
  )
}
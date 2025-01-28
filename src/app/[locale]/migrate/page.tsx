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
  total_following: number;
  matched_following: number;
  bluesky_matches: number;
  mastodon_matches: number;
}

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
  const [showModaleResults, setShowModaleResults] = useState(false)
  const [migrationResults, setMigrationResults] = useState<{ bluesky: { attempted: number; succeeded: number }; mastodon: { attempted: number; succeeded: number } } | null>(null)
  const [missingProviders, setMissingProviders] = useState<string[]>([])

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
      const [tokensCheck, matchesResponse] = await Promise.all([
        checkTokens(),
        fetch('/api/migrate/matching_found', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
      ])

      const matchesData = await matchesResponse.json()
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
        const toFollowBluesky = match.bluesky_handle && !match.has_follow_bluesky ? 1 : 0
        const toFollowMastodon = match.mastodon_username && !match.has_follow_mastodon ? 1 : 0
        
        return {
          total_following: acc.total_following + toFollowBluesky + toFollowMastodon,
          matched_following: acc.matched_following + (match.has_follow_bluesky || match.has_follow_mastodon ? 1 : 0),
          bluesky_matches: acc.bluesky_matches + (match.bluesky_handle ? 1 : 0),
          mastodon_matches: acc.mastodon_matches + (match.mastodon_username ? 1 : 0)
        }
      }, {
        total_following: 0,
        matched_following: 0,
        bluesky_matches: 0,
        mastodon_matches: 0
      })

      setStats(stats)
      setIsLoading(false)
    }

    checkUserProfile()
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
      await updateSession(); // Met à jour la session avec les nouvelles données
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

      const accountsToMigrate = accountsToProcess.filter(match => 
        selectedAccounts.includes(match.target_twitter_id)
      );

      // Process in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < accountsToMigrate.length; i += BATCH_SIZE) {
        const batchAccounts = accountsToMigrate.slice(i, i + BATCH_SIZE);
        
        // Send the accounts as is - no need to reconstruct since they already match MatchingTarget
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

        // Update processed counts based on the actual batch results
        if (result.mastodon) {
          const batchMastodonSuccess = result.mastodon.successCount || 0;
          // Update processedMastodon count
        }

        if (result.bluesky) {
          const batchBlueskySuccess = result.bluesky.successCount || 0;
          // Update processedBluesky count
        }

        // Update progress after each batch
        // Update migrationResults state
      }

      // Migration completed
      setShowSuccessModal(true);
      setIsMigrating(false);
      
      // Refresh the session to update follow status
      await updateSession();
    } catch (error) {
      console.error('Error during migration:', error);
      setIsMigrating(false);
      // You might want to show an error modal here
    }
  };

  return (
    <main className="min-h-screen bg-[#2a39a9]">
      <div className="w-full max-w-[90rem] m-auto">
        <div className="bg-[#2a39a9]">
          <Header />
          
          <Suspense fallback={<div className="animate-pulse bg-blue-900/50 h-[600px]" />}>
            <MigrateSea stats={stats}/>
          </Suspense>
          
          <div className="mt-[600px] bg-[#2a39a9]">
            <Suspense fallback={<LoadingIndicator msg="Loading..." />}>
              {isAutomaticReconnect ? (
                <AutomaticReconnexion
                  results={migrationResults || { bluesky: { attempted: 0, succeeded: 0 }, mastodon: { attempted: 0, succeeded: 0 } }}
                  onPause={toggleAutomaticReconnect}
                />
              ) : showOptions ? (
                <ReconnexionOptions
                  onAutomatic={handleAutomaticReconnection}
                  onManual={handleManualReconnection}
                />
              ) : (
                <ManualReconnexion
                  matches={accountsToProcess}
                  onStartMigration={handleStartMigration}
                  onToggleAutomaticReconnect={handleAutomaticReconnection}
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
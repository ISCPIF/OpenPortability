'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Header from '@/app/_components/Header'
import { SiBluesky } from "react-icons/si"
import { FaTwitter, FaMastodon } from "react-icons/fa"
import { motion, AnimatePresence } from "framer-motion"
import { Ship } from 'lucide-react'
import MigrateSea from '@/app/_components/MigrateSea'
import Footer from '@/app/_components/Footer'
import AccountToMigrate from '@/app/_components/AccountToMigrate'
import DashboardSea from '@/app/_components/DashboardSea'
import LoadingIndicator from '@/app/_components/LoadingIndicator'
import ReconnexionOptions from '@/app/_components/ReconnexionOptions'
import ManualReconnexion from '@/app/_components/ManualReconnexion'
import ReconnexionModaleResults from '@/app/_components/ReconnexionModaleResults'
import AutomaticReconnexion from '@/app/_components/AutomaticReconnexion'
import RefreshTokenModale from '@/app/_components/RefreshTokenModale'

import { plex } from '@/app/fonts/plex'

type MatchStats = {
  total_followers: number
  matched_followers: number
  total_following: number
  matched_following: number
}

type Match = {
  twitter_id: string
  bluesky_handle: string | null
  mastodon_handle?: string | null
  mastodon_username?: string | null
  mastodon_instance?: string | null
  relationship_type: 'follower' | 'following'
  mapping_date: string | null
  has_follow_bluesky: boolean
  has_follow_mastodon: boolean
}

type GroupedMatches = {
  followers: Match[]
  following: Match[]
}

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
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [isMigrating, setIsMigrating] = useState(false)
  const [activeTab, setActiveTab] = useState<'mastodon' | 'bluesky'>('bluesky')
  const [showOptions, setShowOptions] = useState(true)
  const [isAutomaticReconnect, setIsAutomaticReconnect] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [showModaleResults, setShowModaleResults] = useState(false)
  const [migrationResults, setMigrationResults] = useState<{ bluesky: { attempted: number; succeeded: number }; mastodon: { attempted: number; succeeded: number } } | null>(null)
  const [missingProviders, setMissingProviders] = useState<string[]>([])
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showRefreshTokenModal, setShowRefreshTokenModal] = useState(false)
  const [invalidTokenProviders, setInvalidTokenProviders] = useState<string[]>([])

  // Fonction pour vérifier les tokens
  const checkTokens = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST'
      })
      const data = await response.json()

      console.log('Tokens data:', data)

      if (!data.success) {
        setInvalidTokenProviders(['bluesky'])
        setShowRefreshTokenModal(true)
        console.log("Tokens are invalid")
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking tokens:', error)
      return false
    }
  }

  // Gestionnaire pour le mode automatique
  const handleAutomaticMode = async () => {
    // const tokensValid = await checkTokens()
    // if (!tokensValid) return
    
    setIsAutomaticReconnect(true)
    await updateAutomaticReconnect(true)
  }

  // Gestionnaire pour le mode manuel
  const handleManualMode = async () => {
    // const tokensValid = await checkTokens()
    // if (!tokensValid) return

    setIsAutomaticReconnect(false)
    await updateAutomaticReconnect(false)
  }

  useEffect(() => {
    if (session?.user?.automatic_reconnect) {
      setIsAutomaticReconnect(session.user.automatic_reconnect)
      setShowOptions(false)
    }
  }, [session?.user?.automatic_reconnect])

  useEffect(() => {
    if (!session?.user?.id) {
      // router.push(`/${locale}/dashboard`)
      return
    }

    if (!session.user?.has_onboarded) {
      console.log("Redirecting to dashboard")
      return
    }
    const checkUserProfile = async () => {
      if (!session?.user?.id) {
        console.log("Redirecting to home")
        return
      }

      if (!session.user?.has_onboarded) {
        console.log("Redirecting to dashboard")
        return
      }

      setUserProfile(session.user)

      checkTokens();
      
      const matchesResponse = await fetch('/api/migrate/matching_found')
      const matchesData = await matchesResponse.json()

      console.log("Matches data:", matchesData)
      
      if (matchesData.error) {
        console.error("Error fetching matches:", matchesData.error)
        setIsLoading(false)
        return
      }
      
      // Calculer les statistiques
      const matches = matchesData.matches.following
      const total_following = matches.length
      
      // Compter les comptes déjà suivis (has_follow = true)
      const already_followed = matches.filter(match => 
        (match.bluesky_handle && match.has_follow_bluesky) || 
        (match.mastodon_username && match.has_follow_mastodon)
      ).length

      // Compter les comptes à suivre (has_follow = false)
      const to_follow = matches.filter(match => 
        (match.bluesky_handle && !match.has_follow_bluesky) || 
        (match.mastodon_username && !match.has_follow_mastodon)
      ).length

      // Mettre à jour les stats
      setStats({
        total_following: to_follow, // Nombre de comptes à suivre
        matched_following: already_followed, // Nombre de comptes déjà suivis
        bluesky_matches: matches.filter(m => m.bluesky_handle).length,
        mastodon_matches: matches.filter(m => m.mastodon_username).length
      })

      // Enregistrer les matches pour la migration
      setMatches(matches)
      setIsLoading(false)
    }

    checkUserProfile()
  }, [router, session, status])

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
    const allAccountIds = matches.map(match => match.twitter_id);
    handleStartMigration(allAccountIds);
  };

  const handleManualReconnection = async () => {
    await handleManualMode();
    // Ici vous pouvez ajouter la logique supplémentaire pour la reconnexion manuelle
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

      const accountsToMigrate = matches.filter(match => 
        selectedAccounts.includes(match.twitter_id)
      );

      const totalBlueskyToMigrate = accountsToMigrate.filter(acc => acc.bluesky_handle).length;
      const totalMastodonToMigrate = accountsToMigrate.filter(acc => acc.mastodon_username && acc.mastodon_instance).length;

      // Initialiser les résultats avec les totaux mais 0 succès
      setMigrationResults({
        bluesky: { attempted: totalBlueskyToMigrate, succeeded: 0 },
        mastodon: { attempted: totalMastodonToMigrate, succeeded: 0 }
      });

      // Traiter par batch de 10 comptes
      const BATCH_SIZE = 10;
      let processedBluesky = 0;
      let processedMastodon = 0;

      for (let i = 0; i < accountsToMigrate.length; i += BATCH_SIZE) {
        const batch = accountsToMigrate.slice(i, i + BATCH_SIZE);
        
        const response = await fetch('/api/migrate/send_follow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accounts: batch }),
        });

        const result = await response.json();
        console.log('results from send_follow:', result);

        if (response.status === 500 && result.error === 'InvalidToken') {
          console.log('Token invalide détecté pendant la migration');
          setInvalidTokenProviders(['bluesky']);
          setShowRefreshTokenModal(true);
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to process batch ${i / BATCH_SIZE + 1}`);
        }

        if (result.success) {
          // Mettre à jour le nombre de comptes traités avec succès
          processedBluesky += result.results.bluesky.succeeded || 0;
          processedMastodon += result.results.mastodon.succeeded || 0;

          // Mettre à jour l'interface avec la progression
          setMigrationResults({
            bluesky: {
              attempted: totalBlueskyToMigrate,
              succeeded: processedBluesky
            },
            mastodon: {
              attempted: totalMastodonToMigrate,
              succeeded: processedMastodon
            }
          });
        }
      }

    } catch (error) {
      console.error('Error during migration:', error);
      alert('An error occurred during migration. Please try again.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#2a39a9]">
      <div className="w-full max-w-[90rem] m-auto">
        <div className="bg-[#2a39a9]">
          <Header />
          <MigrateSea stats={stats}/>
          
          <div className="mt-[600px] bg-[#2a39a9]">
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
                matches={matches}
                onStartMigration={handleStartMigration}
                onToggleAutomaticReconnect={handleAutomaticReconnection}
              />
            )}
          </div>

          {showRefreshTokenModal && (
            <RefreshTokenModale
              invalidProviders={invalidTokenProviders}
              onClose={() => setShowRefreshTokenModal(false)}
            />
          )}

          <Footer />
        </div>
      </div>
    </main>
  );
}
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

  useEffect(() => {
    if (session?.user?.automatic_reconnect) {
      setIsAutomaticReconnect(session.user.automatic_reconnect)
      setShowOptions(false)
    }
  }, [session?.user?.automatic_reconnect])

  useEffect(() => {
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
      
      const matchesResponse = await fetch('/api/migrate/matching_found')
      const matchesData = await matchesResponse.json()

      console.log("Matches data:", matchesData)
      
      if (matchesData.error) {
        console.error("Error fetching matches:", matchesData.error)
        setIsLoading(false)
        return
      }
      
      // Envoyer tous les matches et mettre à jour les stats
      setMatches(matchesData.matches.following)
      setStats(matchesData.stats)
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
    await updateAutomaticReconnect(true);
    setIsAutomaticReconnect(true);
    setShowOptions(false);
    // Démarrer la migration automatique avec tous les comptes
    const allAccountIds = matches.map(match => match.twitter_id);
    handleStartMigration(allAccountIds);
  };

  const handleManualReconnection = async () => {
    await updateAutomaticReconnect(false);
    setIsAutomaticReconnect(false);
    setShowOptions(false);
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

      // Initialiser les résultats et montrer la modale immédiatement
      let totalResults = {
        bluesky: { attempted: totalBlueskyToMigrate, succeeded: 0 },
        mastodon: { attempted: totalMastodonToMigrate, succeeded: 0 }
      };
      setMigrationResults(totalResults);
      setShowModaleResults(true);

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

        if (!response.ok) {
          throw new Error(`Failed to process batch ${i / BATCH_SIZE + 1}`);
        }

        const result = await response.json();
        if (result.success) {
          // Calculer la progression
          processedBluesky += result.results.bluesky.attempted;
          processedMastodon += result.results.mastodon.attempted;

          const progressBluesky = Math.floor((processedBluesky / totalBlueskyToMigrate) * totalBlueskyToMigrate);
          const progressMastodon = Math.floor((processedMastodon / totalMastodonToMigrate) * totalMastodonToMigrate);

          // Mettre à jour l'interface avec la progression
          setMigrationResults({
            bluesky: {
              attempted: totalBlueskyToMigrate,
              succeeded: progressBluesky
            },
            mastodon: {
              attempted: totalMastodonToMigrate,
              succeeded: progressMastodon
            }
          });
        }
      }

      // À la fin, mettre succeeded = attempted pour montrer 100%
      setMigrationResults({
        bluesky: {
          attempted: totalBlueskyToMigrate,
          succeeded: totalBlueskyToMigrate
        },
        mastodon: {
          attempted: totalMastodonToMigrate,
          succeeded: totalMastodonToMigrate
        }
      });

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

          {/* {showModaleResults && (
            <ReconnexionModaleResults
              results={migrationResults}
              onClose={() => setShowModaleResults(false)}
            />
          )} */}

          <Footer />
        </div>
      </div>
    </main>
  );
}
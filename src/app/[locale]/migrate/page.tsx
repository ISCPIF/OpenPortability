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
  relationship_type: 'follower' | 'following'
  mapping_date: string | null
}

type GroupedMatches = {
  followers: Match[]
  following: Match[]
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

      if (!session.user?.has_onboarded || !session.user?.bluesky_id) {
        console.log("Redirecting to dashboard")
        return
      }

      setUserProfile(session.user)
      
      const matchesResponse = await fetch('/api/migrate/matching_found')
      const matchesData = await matchesResponse.json()

      console.log("Matches data:", matchesData)
      
      // Ne garder que les following qui ont un match (bluesky_handle non null)
      setMatches(matchesData.matches.following.filter(match => match.bluesky_handle !== null))
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
    setShowOptions(false);
    // Ici vous pouvez ajouter la logique supplémentaire pour la reconnexion automatique
  };
  
  const handleManualReconnection = async () => {
    await updateAutomaticReconnect(false);
    setShowOptions(false);
    // Ici vous pouvez ajouter la logique supplémentaire pour la reconnexion manuelle
  };

  const toggleAutomaticReconnect = async () => {
    const newValue = !isAutomaticReconnect;
    await updateAutomaticReconnect(newValue);
  };

  const handleStartMigration = async (selectedAccounts: string[]) => {
    try {
      setIsMigrating(true);
      console.log('Starting migration for accounts:', selectedAccounts);

      const response = await fetch('/api/migrate/send_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accounts: selectedAccounts }),
      });

      if (!response.ok) {
        throw new Error('Failed to start migration');
      }

      const result = await response.json();
      console.log('Migration result:', result);

      // Optional: Show success message or update UI
      // You might want to add some state for this

    } catch (error) {
      console.error('Error during migration:', error);
      // Optional: Show error message to user
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="min-h-screen mt-4 relative w-full max-w-[90rem] m-auto bg-[#2a39a9]">
      <Header />
      <MigrateSea matchCount={matches.length}/>
      <div className="container mx-auto px-4 mt-[400px] bg-[#2a39a9]">
        {isAutomaticReconnect ? (
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="text-white">Reconnexion automatique activée</span>
            <button
              onClick={toggleAutomaticReconnect}
              className={`w-16 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                isAutomaticReconnect ? 'bg-[#FF3366]' : 'bg-gray-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white transform transition-transform duration-200 ease-in-out ${
                  isAutomaticReconnect ? 'translate-x-8' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ) : showOptions ? (
          <ReconnexionOptions
            matchCount={matches.length}
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
      <Footer />
    </div>
  )
}
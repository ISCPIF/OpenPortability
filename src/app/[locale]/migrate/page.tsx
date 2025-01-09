'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Header from '@/app/_components/Header'
import LoadingIndicator from '@/app/_components/LoadingIndicator'
import { SiBluesky } from "react-icons/si"
import { FaTwitter } from "react-icons/fa"
import { motion, AnimatePresence } from "framer-motion"
import { Ship } from 'lucide-react'
import DahsboardSea from '@/app/_components/DashboardSea'
import Footer from '@/app/_components/Footer'
import AccountToMigrate from '@/app/_components/AccountToMigrate'

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
  relationship_type: 'follower' | 'following'
  mapping_date: string | null
}

type GroupedMatches = {
  followers: Match[]
  following: Match[]
}

export default function MigratePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations('migrate')
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [matches, setMatches] = useState<GroupedMatches | null>(null)
  const [stats, setStats] = useState<MatchStats | null>(null)
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [isMigrating, setIsMigrating] = useState(false)

  useEffect(() => {
    console.log("Session from useEffect", session)
    const checkUserProfile = async () => {
      if (!session?.user?.id) {
        console.log("Redirecting to home")
        return
      }

      if (!session.user?.has_onboarded || !session.user?.twitter_id || !session.user?.bluesky_id) {
        console.log("Redirecting to dashboard")
        return
      }

      setUserProfile(session.user)
      
      const matchesResponse = await fetch('/api/migrate/matching_found')
      const matchesData = await matchesResponse.json()
      
      setMatches(matchesData.matches)
      setStats(matchesData.stats)
      setIsLoading(false)
    }

    checkUserProfile()
  }, [session, router])


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

  const handleSelectAll = (type: 'followers' | 'following') => {
    if (!matches) return
    
    const accounts = matches[type].filter(match => match.bluesky_handle) // Ne considérer que les comptes avec un handle Bluesky
    const allSelected = accounts.every(match => selectedAccounts.has(match.twitter_id))
    
    setSelectedAccounts(prev => {
      const newSet = new Set(prev)
      accounts.forEach(match => {
        if (allSelected) {
          newSet.delete(match.twitter_id)
        } else {
          newSet.add(match.twitter_id)
        }
      })
      return newSet
    })
  }

  const handleStartMigration = async () => {
    if (selectedAccounts.size === 0) return
    
    setIsMigrating(true)
    try {
      const response = await fetch('/api/migrate/send_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accounts: Array.from(selectedAccounts)
        }),
      })

      if (!response.ok) {
        throw new Error('Migration failed')
      }

      // Reset selection after successful migration
      setSelectedAccounts(new Set())
    } catch (error) {
      console.error('Migration error:', error)
    } finally {
      setIsMigrating(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return <LoadingIndicator msg={"Loading your matches"} />
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b from-blue-500 to-blue-700 ${plex.className}`}>
      <Header />
      <main className="container mx-auto px-4 py-8 relative">
        {/* <DahsboardSea className="absolute inset-0 pointer-events-none" /> */}
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Ship className="w-8 h-8 text-white" />
              <h1 className="text-4xl font-bold text-white">
                {t('title')}
              </h1>
            </div>
            
            {selectedAccounts.size > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <button
                  onClick={handleStartMigration}
                  disabled={isMigrating}
                  className="bg-white text-blue-600 px-6 py-2 rounded-full font-medium shadow-lg
                           hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600
                           disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isMigrating ? (
                    <>
                      <LoadingIndicator size="small" />
                      <span>{t('migrating')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('startMigration')}</span>
                      <span className="text-sm bg-blue-100 px-2 py-0.5 rounded-full">
                        {selectedAccounts.size}
                      </span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </div>

          {/* Stats Cards */}
          <AnimatePresence>
            {stats && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-6 mb-8"
              >
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2 text-gray-800">
                    <FaTwitter className="text-blue-400" />
                    <span>Followers</span>
                  </h2>
                  <p className="text-3xl font-bold text-blue-600">
                    {stats.matched_followers} / {stats.total_followers}
                  </p>
                  <p className="text-gray-600 mt-1">{t('matches_found')}</p>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2 text-gray-800">
                    <FaTwitter className="text-blue-400" />
                    <span>Following</span>
                  </h2>
                  <p className="text-3xl font-bold text-blue-600">
                    {stats.matched_following} / {stats.total_following}
                  </p>
                  <p className="text-gray-600 mt-1">{t('matches_found')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Matches Lists */}
          <AnimatePresence>
            {matches && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Followers Section */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                      <FaTwitter className="text-blue-400" />
                      <span>{t('followers')}</span>
                    </h2>
                    <button
                      onClick={() => handleSelectAll('followers')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {matches.followers.every(m => selectedAccounts.has(m.twitter_id))
                        ? t('deselectAll')
                        : t('selectAll')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {matches.followers.map((match) => (
                      <AccountToMigrate
                        key={match.twitter_id}
                        twitterId={match.twitter_id}
                        blueskyHandle={match.bluesky_handle}
                        isSelected={selectedAccounts.has(match.twitter_id)}
                        onToggle={() => handleToggleAccount(match.twitter_id)}
                        relationship="follower"
                      />
                    ))}
                  </div>
                </div>

                {/* Following Section */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                      <FaTwitter className="text-blue-400" />
                      <span>{t('following')}</span>
                    </h2>
                    <button
                      onClick={() => handleSelectAll('following')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {matches.following.every(m => selectedAccounts.has(m.twitter_id))
                        ? t('deselectAll')
                        : t('selectAll')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {matches.following.map((match) => (
                      <AccountToMigrate
                        key={match.twitter_id}
                        twitterId={match.twitter_id}
                        blueskyHandle={match.bluesky_handle}
                        isSelected={selectedAccounts.has(match.twitter_id)}
                        onToggle={() => handleToggleAccount(match.twitter_id)}
                        relationship="following"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
      <Footer />
    </div>
  )
}
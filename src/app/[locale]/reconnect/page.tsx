'use client'

import { Suspense, useEffect } from 'react'
import dynamic from 'next/dynamic'

import Header from '@/app/_components/Header'
import LoadingIndicator from '@/app/_components/LoadingIndicator'
import Footer from '@/app/_components/Footer'
import StatsReconnexion from '@/app/_components/StatsReconnexion'
import { useReconnectState } from '@/hooks/useReconnectState'
import MigrateSea from '@/app/_components/MigrateSea'
import NewsLetterConsentsUpdate from '@/app/_components/NewsLetterConsentsUpdate'

// Nouveau composant conteneur pour gérer la logique conditionnelle
import ReconnectContainer from '@/app/_components/reconnect/ReconnectContainer'

// Dynamic imports for heavy components

const MigrateStats = dynamic(() => import('@/app/_components/MigrateStats'), {
  loading: () => <div className="animate-pulse bg-blue-900/50 h-24" />
})

export default function ReconnectPage() {
  const {
    session,
    stats,
    globalStats,
    mastodonInstances,
    isLoading,
    setIsLoading,
    showOptions,
    isAutomaticReconnect,
    accountsToProcess,
    migrationResults,
    missingProviders,
    isReconnectionComplete,
    handleAutomaticReconnection,
    handleManualReconnection,
    handleStartMigration,
    refreshStats,
    setAccountsToProcess
  } = useReconnectState()

  // // Forcer un rafraîchissement des statistiques au chargement initial
  useEffect(() => {
    // Forcer le rechargement des données au premier rendu
    const loadInitialData = async () => {
      await refreshStats();
    };
    
    loadInitialData();
  }, [refreshStats]);


  // Ne bloquer que sur isLoading et stats, pas sur globalStats
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full  m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator msg="Loading..." />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E8E9E4]">
      <div className="relative z-40 bg-[#E8E9E4]">
        <Header />
      </div>
      
      <div className="bg-[#2a39a9] min-h-[calc(100vh-64px)]"> 
        <div className="flex flex-col text-center text-[#E2E4DF]">
          {/* Sea background that takes full width */}
          <Suspense fallback={<div className="animate-pulse bg-blue-900/50 h-[600px]" />}>
            <MigrateSea />
          </Suspense>
        </div>

        <div className="relative w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 -mt-16 sm:-mt-24">
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
          </div>

          {/* Composant conteneur qui gère l'affichage conditionnel */}
          <ReconnectContainer
            session={session}
            stats={stats}
            globalStats={globalStats}
            mastodonInstances={mastodonInstances}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            isAutomaticReconnect={isAutomaticReconnect}
            showOptions={showOptions}
            isReconnectionComplete={isReconnectionComplete}
            missingProviders={missingProviders}
            accountsToProcess={accountsToProcess}
            setAccountsToProcess={setAccountsToProcess}
            migrationResults={migrationResults}
            handleAutomaticReconnection={handleAutomaticReconnection}
            handleManualReconnection={handleManualReconnection}
            handleStartMigration={handleStartMigration}
            refreshStats={refreshStats}
          />

          {/* Statistiques globales */}
          <div className="w-full flex justify-center my-8">
            <div className="w-full">
              {globalStats ? (
                <StatsReconnexion globalStats={globalStats} />
              ) : (
                <div className="animate-pulse bg-blue-900/50 h-24" />
              )}
            </div>
          </div>
         
        </div>
        {/* {session?.user?.have_seen_newsletter && (
          <NewsLetterConsentsUpdate userId={session.user.id} />
        )} */}
        <Footer />
      </div>
    </div>
  )
}
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'

import Header from '@/app/_components/layouts/Header'
import Footer from '@/app/_components/layouts/Footer'
import { useReconnectState } from '@/hooks/useReconnectState'
import { useTheme } from '@/hooks/useTheme'
import { useCommunityColors } from '@/hooks/useCommunityColors'
import { GraphDataProvider } from '@/contexts/GraphDataContext'
import { useNewsletter } from '@/hooks/useNewsLetter'
import NewsLetterFirstSeen from '@/app/_components/modales/NewsLetterFirstSeen'

// Loading component with theme-aware colors
function ReconnectLoader() {
  const { isDark } = useTheme()
  const { colors: communityColors } = useCommunityColors()
  const t = useTranslations('loaders')
  
  // For contrast: use light color on dark theme, dark color on light theme
  const contrastColor = isDark 
    ? (communityColors[9] || communityColors[8] || '#fad541')
    : (communityColors[0] || communityColors[1] || '#011959')
  
  return (
    <div 
      className="flex items-center justify-center h-screen"
      style={{ backgroundColor: isDark ? '#0a0f1f' : '#f8fafc' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div 
          className="w-8 h-8 border-2 rounded-full animate-spin" 
          style={{ 
            borderLeftColor: contrastColor,
            borderRightColor: contrastColor,
            borderBottomColor: contrastColor,
            borderTopColor: 'transparent'
          }}
        />
      </div>
    </div>
  )
}

// Dynamic import for graph dashboard (heavy component)
const ReconnectGraphDashboard = dynamic(
  () => import('@/app/_components/graph/ReconnectGraphDashboard').then(mod => ({ default: mod.ReconnectGraphDashboard })),
  { 
    loading: () => <ReconnectLoader />,
    ssr: false 
  }
)

export default function ReconnectPage() {
  const {
    session,
    stats,
    globalStats,
    mastodonInstances,
    isMigrating,
    setIsMigrating,
    isAutomaticReconnect,
    migrationResults,
    handleAutomaticReconnection,
    handleStartMigration,
    setAccountsToProcess,
    toggleAutomaticReconnect,
    followingList,
    selectedAccounts,
    invalidTokenProviders,
    setInvalidTokenProviders,
    tokenErrorCode,
    selectedBreakdown,
  } = useReconnectState()

  const { update } = useSession()
  const newsletterData = useNewsletter()
  
  // Newsletter first seen modal state
  const [isNewsletterFirstSeenOpen, setIsNewsletterFirstSeenOpen] = useState(false)

  // Invalidate matching network cache on page mount to force fresh fetch
  // This ensures we get updated data when returning from upload page
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__matchingNetworkState) {
      console.log('🔄 [ReconnectPage] Invalidating matching network cache on mount');
      (window as any).__matchingNetworkState.fetched = false;
      (window as any).__matchingNetworkState.data = null;
      (window as any).__matchingNetworkState.promise = null;
    }
  }, []);

  // Show newsletter modal if user hasn't seen it yet
  useEffect(() => {
    if (!session?.user) return
    const hasSeen = !!session.user.have_seen_newsletter
    setIsNewsletterFirstSeenOpen(!hasSeen)
  }, [session?.user])

  return (
    <GraphDataProvider>
      <div className="relative w-full h-screen overflow-hidden">
        <ReconnectGraphDashboard
          session={session}
          stats={stats}
          accountsToProcess={followingList}
          setAccountsToProcess={setAccountsToProcess}
          isAutomaticReconnect={isAutomaticReconnect}
          isMigrating={isMigrating}
          migrationResults={migrationResults}
          onStartMigration={handleStartMigration}
          onToggleAutomaticReconnect={toggleAutomaticReconnect}
          onStartAutomaticReconnection={handleAutomaticReconnection}
          onStopMigration={() => setIsMigrating(false)}
          selectedAccountsCount={selectedAccounts.size}
          mastodonInstances={mastodonInstances}
          invalidTokenProviders={invalidTokenProviders}
          onClearInvalidTokenProviders={() => setInvalidTokenProviders([])}
          tokenErrorCode={tokenErrorCode}
          selectedBreakdown={selectedBreakdown}
          globalStats={globalStats}
        />
        
        <Header />
        <Footer />
        
        {/* Newsletter First Seen Modal - shown if user hasn't seen it yet */}
        {session?.user?.id && (
          <NewsLetterFirstSeen
            userId={session.user.id}
            newsletterData={newsletterData}
            isOpen={isNewsletterFirstSeenOpen}
            onClose={() => setIsNewsletterFirstSeenOpen(false)}
            onSubscribe={() => {
              setIsNewsletterFirstSeenOpen(false)
              update()
            }}
          />
        )}
      </div>
    </GraphDataProvider>
  )
}
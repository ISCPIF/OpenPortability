'use client'

import dynamic from 'next/dynamic'
import { useRouter, useParams } from 'next/navigation'
import { useCallback } from 'react'

import Header from '@/app/_components/layouts/Header'
import Footer from '@/app/_components/layouts/Footer'
import { useTheme } from '@/hooks/useTheme'
import { useCommunityColors } from '@/hooks/useCommunityColors'
import { PublicGraphDataProviderV3 } from '@/contexts/PublicGraphDataContextV3';

// Loading component with theme-aware colors
function DiscoverV3Loader() {
  const { isDark } = useTheme()
  const { colors: communityColors } = useCommunityColors()
  
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
        <p 
          className="font-mono tracking-wider text-sm"
          style={{ color: contrastColor }}
        >
          Chargement V3...
        </p>
      </div>
    </div>
  )
}

// Dynamic import for discover dashboard (lighter than full reconnect)
const DiscoverGraphDashboard = dynamic(
  () => import('@/app/_components/graph/DiscoverGraphDashboardV3').then(mod => ({ default: mod.DiscoverGraphDashboard })),
  { 
    loading: () => <DiscoverV3Loader />,
    ssr: false 
  }
)

/**
 * Public discover page - no authentication required.
 * Shows the graph in discover mode with labels only.
 * Users can explore the graph and click "Se connecter" to access personal features.
 */
export default function DiscoverPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'en'
  
  const handleLoginClick = useCallback(() => {
    // Redirect to signin page with locale
    router.push(`/${locale}/auth/signin`)
  }, [router, locale])

  return (
    <PublicGraphDataProviderV3>
      <div className="relative w-full h-screen overflow-hidden">
        <DiscoverGraphDashboard onLoginClick={handleLoginClick} />
        
        <Header />
        <Footer />
      </div>
    </PublicGraphDataProviderV3>
  )
}

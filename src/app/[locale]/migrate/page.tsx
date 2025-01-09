'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Header from '@/app/_components/Header'
import LoadingIndicator from '@/app/_components/LoadingIndicator'
import { supabase } from '@/lib/supabase'

export default function MigratePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations('migrate')
  const [isLoading, setIsLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)

  console.log("Session from migrate page ->",session)

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-100 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          {t('title')}
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-lg text-gray-700 mb-4">
            {t('description')}
          </p>
          {/* Ici, nous ajouterons les composants pour la migration des followers/following */}
        </div>
      </div>
    </div>
  )
}
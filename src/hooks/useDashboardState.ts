// src/hooks/useDashboardState.ts
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useStats } from './useStats';
import { useMastodonInstances } from './useMastodonInstances';
import { UserSession } from '@/lib/types/common';

export function useDashboardState() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { stats, globalStats, isLoading: statsLoading } = useStats();
  const mastodonInstances = useMastodonInstances();
  
  const [isLoading, setIsLoading] = useState(true);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_username;
  const hasBluesky = session?.user?.bluesky_username;
  const hasTwitter = session?.user?.twitter_username;
  const hasOnboarded = session?.user?.has_onboarded;
  const connectedServicesCount = [hasMastodon, hasBluesky, hasTwitter].filter(Boolean).length;
  
  // Gestion de l'authentification et du chargement
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
      return;
    }
    
    setIsLoading(status === "loading" || statsLoading);
  }, [status, router, statsLoading]);
  
  return {
    session,
    update,
    stats: stats || null,
    globalStats: globalStats || null,
    mastodonInstances,
    isLoading,
    setIsLoading,
    showNewsletterModal,
    setShowNewsletterModal,
    isShared,
    setIsShared,
    progress,
    setProgress,
    hasMastodon,
    hasBluesky,
    hasTwitter,
    hasOnboarded,
    connectedServicesCount
  };
}
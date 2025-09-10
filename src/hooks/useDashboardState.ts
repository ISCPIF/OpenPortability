// src/hooks/useDashboardState.ts
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useStats } from './useStats';
import { useMastodonInstances } from './useMastodonInstances';
import { UserSession } from '@/lib/types/common';
import { useNewsletter } from './useNewsLetter';

export function useDashboardState() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { stats, globalStats, isLoading: statsLoading } = useStats();
  const mastodonInstances = useMastodonInstances();
  const newsletterData = useNewsletter(); // Exposer toutes les données newsletter
  const hasRefreshed = useRef(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showBlueSkyDMNotification, setShowBlueSkyDMNotification] = useState(false);
  
  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_username;
  const hasBluesky = session?.user?.bluesky_username;
  const hasTwitter = session?.user?.twitter_username;
  const hasOnboarded = session?.user?.has_onboarded;
  const connectedServicesCount = [hasMastodon, hasBluesky, hasTwitter].filter(Boolean).length;
  
  // Gestion de l'authentification et du chargement
  useEffect(() => {
    if (status === "unauthenticated" || !session) {
      router.replace("/auth/signin");
      return;
    }

    // Si on a déjà actualisé la session, on peut afficher le dashboard
    if (hasRefreshed.current) {
      setIsLoading(false);
      return;
    }

    // Actualiser la session une seule fois
    const refreshSession = async () => {
      try {
        await update();
        hasRefreshed.current = true;
      } catch (error) {
        console.error('Erreur lors de l\'actualisation de la session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    refreshSession();
    
    // Timeout de sécurité pour éviter un chargement infini
    const timeout = setTimeout(() => {
      setIsLoading(false);
      hasRefreshed.current = true;
    }, 5000);

    return () => clearTimeout(timeout);
  }, [status, session, router, update]);
  
  // Vérifier si l'utilisateur a activé le support personnalisé et a un compte Bluesky lié
  useEffect(() => {
    if (newsletterData?.consents?.personalized_support && session?.user?.bluesky_username) {
      setShowBlueSkyDMNotification(true);
    } else {
      setShowBlueSkyDMNotification(false);
    }
  }, [newsletterData, session]);
  
  return {
    session,
    update,
    stats: stats || null,
    globalStats: globalStats || null,
    mastodonInstances,
    newsletterData, // Exposer les données newsletter
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
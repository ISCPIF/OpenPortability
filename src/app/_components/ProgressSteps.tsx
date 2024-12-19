'use client'

import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';

function ProgressStep({ 
  step, 
  title, 
  description, 
  isCompleted, 
  isLast = false,
  onClick
}: { 
  step: number;
  title: string;
  description: string;
  isCompleted: boolean;
  isLast?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex-1 relative">
      {/* Ligne de connexion */}
      {!isLast && (
        <div 
          className={`absolute left-[50%] top-6 h-0.5 w-full
            ${isCompleted ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-white/10'}`} 
        />
      )}
      
      {/* Contenu de l'étape */}
      <div 
        className={`relative flex flex-col items-center text-center px-4
          ${onClick ? 'cursor-pointer group' : ''}`}
        onClick={onClick}
      >
        {/* Cercle avec numéro ou check */}
        <div 
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 z-10
            transition-all duration-300 ease-out
            ${isCompleted 
              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-500/20' 
              : 'bg-white/5 text-white/40 border border-white/10'}
            ${onClick ? 'group-hover:scale-110' : ''}`}
        >
          {isCompleted ? <CheckCircle className="w-6 h-6" /> : step}
        </div>
        
        {/* Texte */}
        <div className="max-w-[150px]">
          <h3 className={`font-medium mb-1 text-sm
            ${isCompleted ? 'text-white' : 'text-white/60'}`}>
            {title}
          </h3>
          <p className={`text-xs leading-tight
            ${isCompleted ? 'text-white/80' : 'text-white/40'}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ProgressStepsProps {
  hasTwitter: boolean;
  hasBluesky: boolean;
  hasMastodon: boolean;
  hasOnboarded: boolean;
  stats: {
    following: number;
    followers: number;
  };
  onShare: () => void;
  isShared: boolean;
  onProgressChange?: (progress: number) => void; // 0, 25, 50, 75, ou 100
}

export default function ProgressSteps({ 
  hasTwitter, 
  hasBluesky, 
  hasMastodon,
  hasOnboarded,
  stats,
  onShare,
  isShared: initialIsShared,
  onProgressChange
}: ProgressStepsProps) {
  const { data: session } = useSession();
  const [hasSuccessfulShare, setHasSuccessfulShare] = useState(initialIsShared);

  useEffect(() => {
    async function checkShareStatus() {
      // console.log('🔍 Checking share status...');
      if (!session?.user?.id) {
        console.log('❌ No user session found');
        return;
      }
      const userId = session.user.id;
      // console.log('👤 User ID type:', typeof userId);
      // console.log('👤 User ID value:', userId);
      // console.log('👤 User session:', {
      //   id: session.user.id,
      //   email: session.user.email,
      // });

      try {
        // console.log('📊 Fetching share events...');
        
        const response = await fetch('/api/share', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch share events');
        }

        const { data } = await response.json();
        console.log('📦 Share events:', data);

        // Vérifier qu'au moins un partage est réussi
        const hasShared = Array.isArray(data) && data.length > 0 && data.some(event => event.success);
        console.log('✅ Share status:', hasShared ? 'Has shared' : 'Has not shared');
        setHasSuccessfulShare(hasShared);
      } catch (error) {
        console.error('❌ Failed to check share status:', error);
      }
    }

    checkShareStatus();
  }, [session?.user?.id, initialIsShared]);

  const getConnectedAccountsCount = () => {
    return [hasTwitter, hasBluesky, hasMastodon].filter(Boolean).length;
  };

  useEffect(() => {
    let progress = 0;
    let completedSteps = 0;

    if (hasTwitter) completedSteps++;
    if (getConnectedAccountsCount() >= 2) completedSteps++;
    if (hasOnboarded) completedSteps++;
    if (hasSuccessfulShare) completedSteps++;

    switch (completedSteps) {
      case 0:
        progress = 0;
        break;
      case 1:
        progress = 25;
        break;
      case 2:
        progress = 50;
        break;
      case 3:
        progress = 75;
        break;
      case 4:
        progress = 100;
        break;
    }

    onProgressChange?.(progress);
  }, [hasTwitter, hasBluesky, hasMastodon, hasOnboarded, hasSuccessfulShare, onProgressChange]);

  return (
    <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-8">
      <div className="flex items-start gap-4">
        <ProgressStep
          step={1}
          title="Dashboard"
          description="Connexion réussie à la plateforme HelloQuitteX !"
          isCompleted={true}
        />
        
        <ProgressStep
          step={2}
          title="Réseaux sociaux"
          description={"Ajoutez un réseau social"}
          isCompleted={getConnectedAccountsCount() >= 2}
        />
        
        <ProgressStep
          step={3}
          title="Import"
          description={
            hasOnboarded
              ? `${stats.following} abos, ${stats.followers} abonnés`
              : "Importez vos abonnements"
          }
          isCompleted={hasOnboarded}
        />
        
        <ProgressStep
          step={4}
          title="Partage"
          description="Aidez vos amis à migrer"
          isCompleted={hasSuccessfulShare}
          isLast={true}
          onClick={onShare}
        />
      </div>
    </div>
  );
}
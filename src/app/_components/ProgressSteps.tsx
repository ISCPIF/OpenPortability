'use client'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

import stepsOKIcon from '../../../public/newSVG/steps-OK.svg'
import stepsInitIcon from '../../../public/newSVG/steps-Init.svg'
import stepsPartialIcon from '../../../public/newSVG/steps-partiel.svg'

function ProgressStep({
  step,
  title,
  description,
  isCompleted,
  isPartiallyCompleted = false,
  isLast = false
}: {
  step: number;
  title: string;
  description?: string;
  isCompleted: boolean;
  isPartiallyCompleted?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex-1 relative flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center mb-3
          ${isCompleted
            ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-500/20'
            : 'bg-white/5 text-white/40 border border-white/10'}`}
      >
        {isCompleted ?
          <Image src={stepsOKIcon} alt="Completed" width={32} height={32} /> :
          isPartiallyCompleted ?
            <Image src={stepsPartialIcon} alt="Not started" width={32} height={32} /> :
            <Image src={stepsInitIcon} alt="Not started" width={32} height={32} />}
      </div>

      {/* Texte */}
      <div className="text-center px-2">
        <h3 className={`font-medium mb-1 text-sm
          ${isCompleted ? 'text-white' : 'text-white/60'}`}>
          {title}
        </h3>
        {description &&
          <p className={`text-xs leading-tight
          ${isCompleted ? 'text-white/80' : 'text-white/40'}`}>
            {description}
          </p>}
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
  isShared: boolean;
  onProgressChange?: (progress: number) => void;
}

export default function ProgressSteps({
  hasTwitter,
  hasBluesky,
  hasMastodon,
  hasOnboarded,
  stats,
  isShared: initialIsShared,
  onProgressChange
}: ProgressStepsProps) {
  const { data: session } = useSession();
  const [hasSuccessfulShare, setHasSuccessfulShare] = useState(initialIsShared);
  const t = useTranslations('progressSteps');

  useEffect(() => {
    async function checkShareStatus() {
      if (!session?.user?.id) {
        console.log('❌ No user session found');
        return;
      }
      const userId = session.user.id;

      try {
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

    if (session) completedSteps++;
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
      <div className="grid grid-cols-2 md:flex md:flex-row items-start gap-4">
        <ProgressStep
          step={1}
          title={t('dashboard.title')}
          isCompleted={true}
        />

        <ProgressStep
          step={2}
          title={t('socialNetworks.title')}
          isPartiallyCompleted={getConnectedAccountsCount() === 2}
          isCompleted={getConnectedAccountsCount() === 3}
        />

        <ProgressStep
          step={3}
          title={t('import.title')}
          description={
            hasOnboarded
              ? t('import.description.withStats', { following: stats.following, followers: stats.followers })
              : ""
          }
          isCompleted={hasOnboarded}
        />

        <ProgressStep
          step={4}
          title={t('share.title')}
          isCompleted={hasSuccessfulShare}
          isLast={true}
        />
      </div>
    </div>
  );
}

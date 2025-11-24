'use client'

import { Ship, Users, Globe } from 'lucide-react';
// import PartageButton from '../layouts/PartageButton';
import { useEffect, useState } from 'react';
// import { supabase } from '@/lib/supabase';
import { plex } from '../../fonts/plex';
import { useTranslations } from 'next-intl';
import { useSession } from "next-auth/react"
import PartageButton from '../layouts/PartageButton';

const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface TotalStats {
  total_followers: number;
  total_following: number;
  total_sources: number;
}

interface UploadResultsProps {
  stats: {
    totalUsers: number;
    following: number;
    followers: number;
  };
  onShare: (url: string, platform: string) => void;
  setIsModalOpen: (isOpen: boolean) => void;
  hasTwitter?: boolean;
  hasBluesky?: boolean;
  hasMastodon?: boolean;
  hasOnboarded?: boolean;
  userId?: string;
  twitter_username?: string;
  mastodon_username?: string;
  bluesky_username?: string;
  isLoading?: boolean;
  setIsLoading?: (loading: boolean) => void;
  showRedirectMessage?: boolean;
}

export default function UploadResults({ 
  showRedirectMessage = false,
  onShare,
  stats,
  hasTwitter = false,
  hasBluesky = false,
  hasMastodon = false,
  hasOnboarded = false,
  userId,
  twitter_username,
  mastodon_username,
  bluesky_username,
  isLoading,
  setIsLoading,
  setIsModalOpen,
}: UploadResultsProps) {
  const { data: session } = useSession();
  const t = useTranslations('uploadResults');
  const tShare = useTranslations('dashboard');  
  const [totalUsers, setTotalUsers] = useState<number>(stats.totalUsers);
  const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate completion status
  const totalSteps = 4; 
  const completedSteps = [hasTwitter, hasBluesky, hasMastodon, hasOnboarded].filter(Boolean).length;
  const isThreeQuartersComplete = completedSteps >= (totalSteps * 0.75);
  const username = twitter_username || mastodon_username || bluesky_username || '';

  useEffect(() => {
    if (setIsLoading) {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    const fetchTotalStats = async () => {
      try {
        const response = await fetch('/api/stats/total');
        if (!response.ok) {
          throw new Error('Failed to fetch total stats');
        }
        const data = await response.json();
        setTotalStats(data);
      } catch (err) {
        console.error('Error fetching total stats:', err);
        setError(t('errors.fetchStats'));
      }
    };

    fetchTotalStats();
  }, [t]);

  if (!session) {
    return null;
  }

  const handleShare = async (platform: string) => {
    const shareText = tShare('shareModal.shareText', { count: stats.followers + stats.following });
    let shareUrl = '';
    
    switch (platform) {
      case 'mastodon':
        shareUrl = `${session.user.mastodon_instance}/share?text=${encodeURIComponent(shareText)}`;
        break;
      case 'bluesky':
        shareUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }

    if (onShare) {
      onShare(shareUrl, platform);
    }
  };

  const totalProcessed = stats.followers + stats.following;
  const totalInDatabase = totalStats ? totalStats.total_followers + totalStats.total_following : 0;
  const totalReady = totalStats ? totalStats.total_sources : 0;

  return (
    <div className={`w-full max-w-2xl mx-auto mb-8 ${plex.className}`}>
      <div className="bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 
                    backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="bg-pink-500/20 p-3 rounded-full">
              <Ship className="w-6 h-6 text-pink-400" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-500 
                       bg-clip-text text-transparent">
              {t('congratulations', { username })}
            </h2>
          </div>
        </div>

        <p className="text-white/80 text-center">
          {t('importSuccess', { count: formatNumber(stats.following + stats.followers) })}
        </p>

        <div className="flex justify-center gap-4">
          <div className="bg-black/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-pink-500/20 p-2 rounded-full">
              <Users className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <p className="text-sm text-white/60">{t('stats.twitterAccounts.label')}</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(totalProcessed)}
              </p>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-pink-500/20 p-2 rounded-full">
              <Globe className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <p className="text-sm text-white/60">{t('stats.totalImported.label')}</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(totalInDatabase)}
              </p>
            </div>
          </div>
        </div>

        <p className="text-white/80 text-center">
          {t('inviteFriends')}
        </p>
        <div className={`flex items-center justify-center transition-opacity duration-300 ${isThreeQuartersComplete ? 'opacity-100' : 'opacity-70'}`}>
          <PartageButton 
            providers={{
              twitter: hasTwitter,
              bluesky: hasBluesky,
              mastodon: hasMastodon
            }}
            onShare={handleShare}
          />
        </div>
        {showRedirectMessage && (
          <p className="text-sm text-white/60 text-center mt-4">
            {t('redirecting')}
          </p>
        )}
      </div>
    </div>
  );
}
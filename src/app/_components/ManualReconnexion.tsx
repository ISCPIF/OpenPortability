'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { plex } from '@/app/fonts/plex';
import AccountToMigrate from './AccountToMigrate';

interface Match  {
  twitter_id: string
  bluesky_handle: string | null
  mastodon_handle?: string | null
  mastodon_username?: string | null
  mastodon_instance?: string | null
  relationship_type: 'follower' | 'following'
  mapping_date: string | null
  has_follow_bluesky: boolean
  has_follow_mastodon: boolean
}


interface ManualReconnexionProps {
  matches: Match[];
  onStartMigration: (selectedAccounts: string[]) => void;
  onToggleAutomaticReconnect: () => void;
}

export default function ManualReconnexion({ 
  matches, 
  onStartMigration,
  onToggleAutomaticReconnect 
}: ManualReconnexionProps) {
  const t = useTranslations('ManualReconnexion');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  console.log("currentMatches -->", matches)
  const handleToggleAccount = (twitterId: string) => {
    setSelectedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(twitterId)) {
        newSet.delete(twitterId);
      } else {
        newSet.add(twitterId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedAccounts.size === matches.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(matches.map(match => match.twitter_id)));
    }
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMatches = matches.slice(startIndex, endIndex);
  const totalPages = Math.ceil(matches.length / itemsPerPage);

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#1A237E] rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className={`${plex.className} text-xl text-white`}>
          {t('title')}
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onToggleAutomaticReconnect()}
            className="flex items-center text-white hover:text-gray-200"
          >
            <span className="mr-2">▶</span>
            {t('automaticReconnect')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handleSelectAll}
            className="text-[#2a39a9] hover:text-[#1A237E] font-semibold"
          >
            {t('selectAll')}
          </button>
          {selectedAccounts.size > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onStartMigration(Array.from(selectedAccounts))}
              className="bg-[#d6356f] text-white px-6 py-2 rounded-full font-bold hover:bg-[#FF1F59] transition-colors"
            >
              {t('connect', { count: selectedAccounts.size })}
            </motion.button>
          )}
        </div>

        <div className="space-y-2">
          {currentMatches.map((match) => (
            <AccountToMigrate
              key={match.twitter_id}
              twitterId={match.twitter_id}
              blueskyHandle={match.bluesky_handle}
              mastodonHandle={match.mastodon_handle || null}
              mastodonUsername={match.mastodon_username || null}
              mastodonInstance={match.mastodon_instance || null}
              isSelected={selectedAccounts.has(match.twitter_id)}
              onToggle={() => handleToggleAccount(match.twitter_id)}
              hasFollowBluesky={match.has_follow_bluesky}
              hasFollowMastodon={match.has_follow_mastodon}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="text-[#2a39a9] disabled:text-gray-400"
            >
              ← {t('prev')}
            </button>
            <div className="flex gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-full ${
                    currentPage === i + 1
                      ? 'bg-[#2a39a9] text-white'
                      : 'text-[#2a39a9] hover:bg-gray-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="text-[#2a39a9] disabled:text-gray-400"
            >
              {t('next')} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { plex } from '@/app/fonts/plex';

interface Match {
  twitter_id: string;
  bluesky_handle: string | null;
  mastodon_handle?: string | null;
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


  console.log("currentMatches -->",matches)
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
              className="bg-[#FF3366] text-white px-6 py-2 rounded-full font-bold hover:bg-[#FF1F59] transition-colors"
            >
              {t('connect', { count: selectedAccounts.size })}
            </motion.button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 px-4 text-gray-600 border-b">
            <div className="flex-1">
              {t('xAccountPseudo')}
            </div>
            <div className="flex-1 text-right">
              {t('mastodonBlueskyCorrespondence')}
            </div>
          </div>
          {currentMatches.map((match) => (
            <div key={match.twitter_id} className="flex items-center justify-between p-4 bg-white rounded-lg hover:bg-gray-50">
              <div className="flex items-center space-x-4">
                <input
                  type="checkbox"
                  checked={selectedAccounts.has(match.twitter_id)}
                  onChange={() => handleToggleAccount(match.twitter_id)}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <span className="font-medium text-black">
                    {match.bluesky_handle ? `@${match.bluesky_handle}` : (match.mastodon_handle ? `@${match.mastodon_handle}` : '@' + match.twitter_id)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {match.bluesky_handle && (
                  <button 
                    onClick={() => window.open(`https://bsky.app/profile/${match.bluesky_handle}`, '_blank')}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    {t('followOnBluesky')}
                  </button>
                )}
                {match.mastodon_handle && (
                  <button 
                    onClick={() => window.open(`https://${match.mastodon_handle.split('@')[1]}/@${match.mastodon_handle.split('@')[0]}`, '_blank')}
                    className="px-3 py-1 text-sm bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
                  >
                    {t('followOnMastodon')}
                  </button>
                )}
              </div>
            </div>
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
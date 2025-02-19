'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { plex } from '@/app/fonts/plex';
import AccountToMigrate from './AccountToMigrate';
import { MatchingTarget, MatchedFollower } from '@/lib/types/matching';

type Match = MatchingTarget | MatchedFollower;

function isMatchingTarget(match: Match): match is MatchingTarget {
  return 'target_twitter_id' in match;
}

function isMatchedFollower(match: Match): match is MatchedFollower {
  return 'source_twitter_id' in match;
}

interface ManualReconnexionProps {
  matches: Match[];
  onStartMigration: (selectedAccounts: string[]) => void;
  onToggleAutomaticReconnect: () => void;
  session: {
    user: {
      bluesky_username: string | null
      mastodon_username: string | null
    }
  }
}

export default function ManualReconnexion({ 
  matches, 
  onStartMigration,
  onToggleAutomaticReconnect,
  session
}: ManualReconnexionProps) {
  const t = useTranslations('ManualReconnexion');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Filter matches based on user's connected accounts
  const filteredMatches = matches.filter(match => {
    const blueskyHandle = isMatchingTarget(match) ? match.bluesky_handle : match.bluesky_handle;
    const mastodonUsername = isMatchingTarget(match) ? match.mastodon_username : match.mastodon_username;
    const mastodonHandle = isMatchingTarget(match) ? match.mastodon_handle : null;

    if (blueskyHandle && !session.user.bluesky_username) {
      return false;
    }
    if ((mastodonHandle || mastodonUsername) && !session.user.mastodon_username) {
      return false;
    }
    return true;
  });

  const handleToggleAccount = (targetTwitterId: string) => {
    if (!targetTwitterId) {
      console.error('Attempted to toggle account with undefined target_twitter_id');
      return;
    }
    
    console.log('Before toggle - Selected accounts:', Array.from(selectedAccounts));
    console.log('Toggling account:', targetTwitterId);
    
    const newSet = new Set(selectedAccounts);
    if (newSet.has(targetTwitterId)) {
      console.log('Removing account from selection');
      newSet.delete(targetTwitterId);
    } else {
      console.log('Adding account to selection');
      newSet.add(targetTwitterId);
    }
    
    console.log('After toggle - Selected accounts:', Array.from(newSet));
    setSelectedAccounts(newSet);
  };

  const handleSelectAll = () => {
    const currentPageMatches = currentMatches.map(match => 
      isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id
    ).filter(Boolean);
    setSelectedAccounts(prev => {
      const newSet = new Set(prev);
      const allCurrentSelected = currentPageMatches.every(id => newSet.has(id));
      
      if (allCurrentSelected) {
        // Unselect all on current page
        currentPageMatches.forEach(id => newSet.delete(id));
      } else {
        // Select all on current page
        currentPageMatches.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMatches = filteredMatches.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredMatches.length / itemsPerPage);

  console.log("currentMatches FULL DATA -->", currentMatches);
  console.log("currentMatches detailed -->", currentMatches.map(m => ({
    id: isMatchingTarget(m) ? m.target_twitter_id : m.source_twitter_id,
    bluesky: m.bluesky_handle,
    mastodon: isMatchingTarget(m) ? m.mastodon_handle : m.mastodon_username,
    mastodon_id: m.mastodon_id,
    mastodon_instance: m.mastodon_instance,
    type: isMatchingTarget(m) ? 'MatchingTarget' : 'MatchedFollower',
    has_follow_bluesky: isMatchingTarget(m) ? m.has_follow_bluesky : m.has_been_followed_on_bluesky,
    has_follow_mastodon: isMatchingTarget(m) ? m.has_follow_mastodon : m.has_been_followed_on_mastodon
  })));

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
              onClick={() => {
                // Convert Set to array of strings (target_twitter_ids)
                const selectedAccountIds = Array.from(selectedAccounts);
                onStartMigration(selectedAccountIds);
              }}
              className="bg-[#d6356f] text-white px-6 py-2 rounded-full font-bold hover:bg-[#FF1F59] transition-colors"
            >
              {t('connect', { count: selectedAccounts.size })}
            </motion.button>
          )}
        </div>

        <div className="space-y-2">
          {currentMatches.map((match) => {
            const targetTwitterId = isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id;
            if (!targetTwitterId) {
              console.error('Match missing target_twitter_id:', match);
              return null;
            }
            
            // console.log(`Rendering account ${targetTwitterId}, isSelected:`, selectedAccounts.has(targetTwitterId));
            return (
              <AccountToMigrate
                key={isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id}
                twitterId={isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id}
                blueskyHandle={match.bluesky_handle}
                mastodonHandle={isMatchingTarget(match) ? match.mastodon_handle : null}
                mastodonUsername={match.mastodon_username || null}
                mastodonInstance={match.mastodon_instance || null}
                isSelected={selectedAccounts.has(isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id)}
                onToggle={() => handleToggleAccount(isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id)}
                hasFollowBluesky={isMatchingTarget(match) ? match.has_follow_bluesky : match.has_been_followed_on_bluesky}
                hasFollowMastodon={isMatchingTarget(match) ? match.has_follow_mastodon : match.has_been_followed_on_mastodon}
              />
            );
          })}
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
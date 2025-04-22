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
  const [showOnlyNotFollowed, setShowOnlyNotFollowed] = useState(true);
  const itemsPerPage = 50;


  // Filter matches based on user's connected accounts
  const filteredMatches = matches.filter(match => {
    const blueskyHandle = isMatchingTarget(match) ? match.bluesky_handle : match.bluesky_handle;
    const mastodonUsername = isMatchingTarget(match) ? match.mastodon_username : match.mastodon_username;
    const mastodonHandle = isMatchingTarget(match) ? match.mastodon_handle : null;
    const hasFollowBluesky = isMatchingTarget(match) ? match.has_follow_bluesky : match.has_been_followed_on_bluesky;
    const hasFollowMastodon = isMatchingTarget(match) ? match.has_follow_mastodon : match.has_been_followed_on_mastodon;

    // If user has Bluesky connected, show accounts with Bluesky handles that aren't followed
    const showForBluesky = session.user.bluesky_username && blueskyHandle && !hasFollowBluesky;
    
    // If user has Mastodon connected, show accounts with Mastodon handles that aren't followed
    const showForMastodon = session.user.mastodon_username && (mastodonHandle || mastodonUsername) && !hasFollowMastodon;

    // Show accounts that match either condition when showOnlyNotFollowed is true
    if (showOnlyNotFollowed) {
      return showForBluesky || showForMastodon;
    }
    // When showOnlyNotFollowed is false, show accounts that have been followed on either platform
    else {
      return hasFollowBluesky || hasFollowMastodon;
    }
  });
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMatches = filteredMatches.slice(startIndex, endIndex);

  const handleToggleAccount = (targetTwitterId: string) => {
    if (!targetTwitterId) {
      console.error('Attempted to toggle account with undefined target_twitter_id');
      return;
    }
    const newSet = new Set(selectedAccounts);
    if (newSet.has(targetTwitterId)) {
      newSet.delete(targetTwitterId);
    } else {
      newSet.add(targetTwitterId);
    }
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

  const handleToggleSwitch = () => {
    setShowOnlyNotFollowed(!showOnlyNotFollowed);
    setSelectedAccounts(new Set()); // Reset selection when switching
  };


  return (
    <div className="w-full max-w-4xl mx-auto bg-[#1A237E] rounded-lg p-3 sm:p-6 mt-4 sm:mt-12">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
        <h2 className={`${plex.className} text-lg sm:text-xl text-white`}>
          {t('title')}
        </h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyNotFollowed}
              onChange={handleToggleSwitch}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[50%] after:translate-y-[-50%] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d6356f]"></div>
            <span className="ml-3 text-sm sm:text-base text-white">{t('showOnlyNotFollowed', 'Show not followed')}</span>
          </label>
          <button
            onClick={() => onToggleAutomaticReconnect()}
            className="flex items-center text-white text-sm sm:text-base hover:text-gray-200"
          >
            <span className="mr-2">▶</span>
            {t('automaticReconnect')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 sm:mb-4 gap-2 sm:gap-0">
          <button
            onClick={handleSelectAll}
            className="text-[#2a39a9] text-sm sm:text-base hover:text-[#1A237E] font-semibold"
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
              className="bg-[#d6356f] text-white px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base rounded-full font-bold hover:bg-[#FF1F59] transition-colors w-full sm:w-auto"
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

            const hasFollowBluesky = isMatchingTarget(match) ? match.has_follow_bluesky : match.has_been_followed_on_bluesky;
            const hasFollowMastodon = isMatchingTarget(match) ? match.has_follow_mastodon : match.has_been_followed_on_mastodon;
            
            return (
              <AccountToMigrate
                key={isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id}
                targetTwitterId={isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id}
                blueskyHandle={match.bluesky_handle}
                mastodonHandle={isMatchingTarget(match) ? match.mastodon_handle : null}
                mastodonUsername={isMatchingTarget(match) ? match.mastodon_username : match.mastodon_username}
                mastodonInstance={match.mastodon_instance}
                mastodonId={match.mastodon_id}
                isSelected={selectedAccounts.has(isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id)}
                onToggle={() => handleToggleAccount(isMatchingTarget(match) ? match.target_twitter_id : match.source_twitter_id)}
                hasFollowBluesky={hasFollowBluesky}
                hasFollowMastodon={hasFollowMastodon}
                session={session}
              />
            );
          })}
        </div>

        {filteredMatches.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 sm:mt-6 gap-3 sm:gap-0">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="text-[#2a39a9] text-sm sm:text-base disabled:text-gray-400 order-2 sm:order-1"
            >
              ← {t('prev')}
            </button>
            <div className="flex gap-1 sm:gap-2 order-1 sm:order-2 overflow-x-auto py-1 sm:py-0 max-w-full">
              {(() => {
                const totalPages = Math.ceil(filteredMatches.length / itemsPerPage);
                const pageNumbers = [];
                
                if (totalPages <= 5) {
                  // Si moins de 5 pages, on affiche tout
                  for (let i = 1; i <= totalPages; i++) {
                    pageNumbers.push(i);
                  }
                } else {
                  // Toujours afficher les 2 premières pages
                  pageNumbers.push(1, 2);
                  
                  // Ajouter les points de suspension si on n'est pas proche du début
                  if (currentPage > 3) {
                    pageNumbers.push('...');
                  }
                  
                  // Ajouter la page courante si elle n'est pas déjà incluse
                  if (currentPage > 2 && currentPage < totalPages - 1) {
                    pageNumbers.push(currentPage);
                  }
                  
                  // Ajouter les points de suspension si on n'est pas proche de la fin
                  if (currentPage < totalPages - 2) {
                    pageNumbers.push('...');
                  }
                  
                  // Toujours afficher les 2 dernières pages
                  pageNumbers.push(totalPages - 1, totalPages);
                }
                
                return pageNumbers.map((pageNum, index) => {
                  if (pageNum === '...') {
                    return <span key={`ellipsis-${index}`} className="text-[#d6356f] text-sm sm:text-base">...</span>;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum as number)}
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full text-sm ${
                        currentPage === pageNum
                          ? 'bg-[#d6356f] text-white'
                          : 'text-[#d6356f] hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredMatches.length / itemsPerPage), p + 1))}
              disabled={currentPage === Math.ceil(filteredMatches.length / itemsPerPage)}
              className="text-[#2a39a9] text-sm sm:text-base disabled:text-gray-400 order-3"
            >
              {t('next')} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { plex } from '@/app/fonts/plex';
import AccountToMigrate from './AccountToMigrate';
import { MatchingTarget, MatchedFollower } from '@/lib/types/matching';
import { toast } from 'sonner';

type Match = MatchingTarget | MatchedFollower;

function isMatchingTarget(match: Match): match is MatchingTarget {
  return 'node_id' in match;
}

function isMatchedFollower(match: Match): match is MatchedFollower {
  return 'source_twitter_id' in match;
}

// Composant Toast personnalisé pour les notifications
const CustomToast = ({ platform, message, buttonText }: { platform: string; message: string; buttonText: string }) => (
  <div className={`${plex.className} flex flex-col space-y-3 p-4 bg-[#d6356f] text-white rounded-lg`}>
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 bg-white rounded-full" />
      <span className="font-medium text-white/90">{platform}</span>
    </div>
    <p className="text-sm text-white/80">{message}</p>
    {buttonText && (
      <button 
        onClick={() => window.location.href = '/dashboard'}
        className="px-4 py-2 bg-white text-[#d6356f] rounded-md text-sm font-medium hover:bg-white/90 transition-colors"
      >
        {buttonText}
      </button>
    )}
  </div>
);

interface ManualReconnexionProps {
  matches: Match[];
  setMatches?: (matches: Match[]) => void;
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
  setMatches,
  onStartMigration,
  onToggleAutomaticReconnect,
  session
}: ManualReconnexionProps) {
  const t = useTranslations('ManualReconnexion');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyNotFollowed, setShowOnlyNotFollowed] = useState(true);
  const [activeView, setActiveView] = useState<'notFollowed' | 'followed' | 'ignored'>('notFollowed');
  const itemsPerPage = 50;

  // Filter matches based on user's connected accounts and active view
  const filteredMatches = matches.filter(match => {
    const blueskyHandle = isMatchingTarget(match) ? match.bluesky_handle : match.bluesky_handle;
    const mastodonUsername = isMatchingTarget(match) ? match.mastodon_username : match.mastodon_username;
    const mastodonHandle = isMatchingTarget(match) ? match.mastodon_handle : null;
    const hasFollowBluesky = isMatchingTarget(match) ? match.has_follow_bluesky : match.has_been_followed_on_bluesky;
    const hasFollowMastodon = isMatchingTarget(match) ? match.has_follow_mastodon : match.has_been_followed_on_mastodon;
    const isDismissed = isMatchingTarget(match) && (match as MatchingTarget).dismissed;



    // Si on est dans la vue des comptes ignorés
    if (activeView === 'ignored') {
      return isDismissed;
    }
    
    // Si on est dans la vue des comptes suivis
    if (activeView === 'followed') {
      const result = (hasFollowBluesky || hasFollowMastodon) && !isDismissed;
      return result;
    }
    
    // Vue par défaut: comptes non suivis
    // If user has Bluesky connected, show accounts with Bluesky handles that aren't followed
    const showForBluesky = session.user.bluesky_username && blueskyHandle && !hasFollowBluesky;
    
    // If user has Mastodon connected, show accounts with Mastodon handles that aren't followed
    const showForMastodon = session.user.mastodon_username && (mastodonHandle || mastodonUsername) && !hasFollowMastodon;


    // Show account if it matches criteria for either platform and isn't dismissed
    return (showForBluesky || showForMastodon) && !isDismissed;
  });
  
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMatches = filteredMatches.slice(startIndex, endIndex);

  const handleToggleAccount = (targetTwitterId: string) => {
    
    if (!targetTwitterId) {
      console.error('Attempted to toggle account with undefined node_id');
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
      isMatchingTarget(match) ? match.node_id.toString() : match.source_twitter_id
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

  const handleIgnoreAccount = async (targetTwitterId: string) => {
    try {
      const response = await fetch("/api/migrate/ignore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          targetTwitterId,
          action: "ignore" 
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to ignore account");
      }
      
      // Mettre à jour l'état local pour marquer le compte comme ignoré
      setMatches?.(matches.map(match => {
        if (isMatchingTarget(match) && match.node_id.toString() === targetTwitterId) {
          // Marquer le compte comme ignoré
          return { ...match, dismissed: true };
        } else if (isMatchedFollower(match) && match.source_twitter_id === targetTwitterId) {
          // Cas peu probable mais pour être complet
          return { ...match, dismissed: true };
        }
        return match;
      }));
      
      // Retirer de la sélection si présent
      if (selectedAccounts.has(targetTwitterId)) {
        const newSelectedAccounts = new Set(selectedAccounts);
        newSelectedAccounts.delete(targetTwitterId);
        setSelectedAccounts(newSelectedAccounts);
      }
      
      // Afficher une notification de succès
      toast.success(
        <CustomToast 
          platform="OpenPortability" 
          message={t('accountIgnored')} 
          buttonText=""
        />,
        { duration: 3000 }
      );
      
    } catch (error) {
      console.error("Error ignoring account:", error);
      toast.error(t('errorIgnoringAccount'));
    } finally {
      // setIsLoading(false);
    }
  };

  const handleUnignoreAccount = async (targetTwitterId: string) => {
    try {      
      const response = await fetch("/api/migrate/ignore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          targetTwitterId,
          action: "unignore" 
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to unignore account");
      }
      
      // Mettre à jour l'état local pour marquer le compte comme non ignoré
      setMatches?.(matches.map(match => {
        if (isMatchingTarget(match) && match.node_id.toString() === targetTwitterId) {
          // Marquer le compte comme non ignoré
          return { ...match, dismissed: false };
        } else if (isMatchedFollower(match) && match.source_twitter_id === targetTwitterId) {
          // Cas peu probable mais pour être complet
          return { ...match, dismissed: false };
        }
        return match;
      }));
      
      // Si nous sommes dans la vue des ignorés, changer automatiquement
      if (activeView === 'ignored') {
        setActiveView('notFollowed');
      }
      
      // Afficher une notification de succès
      toast.success(
        <CustomToast 
          platform="OpenPortability" 
          message={t('accountRestored')} 
          buttonText=""
        />,
        { duration: 3000 }
      );
      
    } catch (error) {
      console.error("Error unignoring account:", error);
      toast.error(t('errorRestoringAccount'));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#1A237E] rounded-lg p-3 sm:p-6 mt-4 sm:mt-12">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
        <h2 className={`${plex.className} text-lg sm:text-xl text-white`}>
          {t('title')}
        </h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex bg-[#2a3190] rounded-full p-1 shadow-md">
            <button
              onClick={() => setActiveView('notFollowed')}
              className={`text-sm sm:text-base transition-all duration-200 ease-in-out rounded-full py-1.5 sm:py-2 px-4 sm:px-6 flex items-center justify-center min-w-[100px] sm:min-w-[120px] ${
                activeView === 'notFollowed' 
                ? 'bg-[#d6356f] text-white shadow-sm' 
                : 'text-white hover:bg-[#3a41a0] hover:text-white'
              }`}
            >
              {t('notFollowed')}
            </button>
            <button
              onClick={() => setActiveView('followed')}
              className={`text-sm sm:text-base transition-all duration-200 ease-in-out rounded-full py-1.5 sm:py-2 px-4 sm:px-6 flex items-center justify-center min-w-[100px] sm:min-w-[120px] ${
                activeView === 'followed' 
                ? 'bg-[#d6356f] text-white shadow-sm' 
                : 'text-white hover:bg-[#3a41a0] hover:text-white'
              }`}
            >
              {t('followed')}
            </button>
            <button
              onClick={() => setActiveView('ignored')}
              className={`text-sm sm:text-base transition-all duration-200 ease-in-out rounded-full py-1.5 sm:py-2 px-4 sm:px-6 flex items-center justify-center min-w-[100px] sm:min-w-[120px] ${
                activeView === 'ignored' 
                ? 'bg-[#d6356f] text-white shadow-sm' 
                : 'text-white hover:bg-[#3a41a0] hover:text-white'
              }`}
            >
              {t('ignored')}
            </button>
          </div>
          <button
            onClick={() => onToggleAutomaticReconnect()}
            className="flex items-center text-white text-sm sm:text-base hover:text-gray-200 transition-colors"
          >
            <span className="mr-2 text-[#d6356f]">▶</span>
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
                // Convert Set to array of strings (node_ids)
                const selectedAccountIds = Array.from(selectedAccounts);
                onStartMigration(selectedAccountIds as string[]);
              }}
              className="bg-[#d6356f] text-white px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base rounded-full font-bold hover:bg-[#FF1F59] transition-colors w-full sm:w-auto"
            >
              {t('connect', { count: selectedAccounts.size })}
            </motion.button>
          )}
        </div>

        <div className="space-y-2">
          {currentMatches.map((match, index) => {
            const targetTwitterId = isMatchingTarget(match) ? match.node_id.toString() : match.source_twitter_id;
            const blueskyHandle = isMatchingTarget(match) ? match.bluesky_handle : match.bluesky_handle;
            const hasFollowBluesky = isMatchingTarget(match) ? match.has_follow_bluesky : match.has_been_followed_on_bluesky;
            const hasFollowMastodon = isMatchingTarget(match) ? match.has_follow_mastodon : match.has_been_followed_on_mastodon;
            const isDismissed = isMatchingTarget(match) && (match as MatchingTarget).dismissed;
            
            if (!targetTwitterId) return null;
            
            return (
              <AccountToMigrate
                key={`${targetTwitterId}-${index}`}
                targetTwitterId={targetTwitterId}
                blueskyHandle={blueskyHandle}
                mastodonHandle={isMatchingTarget(match) ? match.mastodon_handle : null}
                mastodonUsername={isMatchingTarget(match) ? match.mastodon_username : match.mastodon_username}
                mastodonInstance={match.mastodon_instance}
                mastodonId={match.mastodon_id}
                isSelected={selectedAccounts.has(targetTwitterId)}
                onToggle={() => handleToggleAccount(targetTwitterId)}
                onIgnore={handleIgnoreAccount}
                onUnignore={handleUnignoreAccount}
                hasFollowBluesky={hasFollowBluesky}
                hasFollowMastodon={hasFollowMastodon}
                isDismissed={isDismissed}
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
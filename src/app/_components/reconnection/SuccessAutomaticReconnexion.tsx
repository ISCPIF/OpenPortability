'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import BSLogo from '../../../../public/v2/statut=BS-defaut.svg';
import MastoLogo from '../../../../public/v2/statut=Masto-Defaut.svg';
import { plex } from '../../fonts/plex'
import { handleShare } from '@/lib/utils';
import PartageButton from '../layouts/PartageButton';
import BlueSkyPreviewModal from '../modales/BlueSkyPreviewModal';


interface SuccessAutomaticReconnexionProps {
  session: {
    user: {
      twitter_username?: string;
      bluesky_username?: string;
      mastodon_username?: string;
      mastodon_instance?: string;
      has_onboarded?: boolean;
    };
  };
  stats: {
    connections: {
      followers: number;
      following: number;
      totalEffectiveFollowers: number;
    };
    matches: {
      bluesky: {
        total: number;
        hasFollowed: number;
        notFollowed: number;
      };
      mastodon: {
        total: number;
        hasFollowed: number;
        notFollowed: number;
      };
    };
    updated_at: string;
  };
  onSuccess: () => void;
}

export default function SuccessAutomaticReconnexion({
  session,
  stats,
  onSuccess,
}: SuccessAutomaticReconnexionProps) {

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const username = session.user.twitter_username || session.user.bluesky_username || session.user.mastodon_username;
  const t = useTranslations('SuccessAutomaticReconnexion');
  const totalReconnected = (session.user.bluesky_username ? stats.matches.bluesky.hasFollowed : 0) + 
                          (session.user.mastodon_username ? stats.matches.mastodon.hasFollowed : 0);

  const onShareClick = (platform: string) => {
    const message = t('shareMessage', {
      count: totalReconnected,
      effectiveFollowers: stats.connections.totalEffectiveFollowers || 0
    });
    
    if (platform === 'bluesky') {
      // Pour BlueSky, on stocke le message et on ouvre la modale
      setShareMessage(message);
      setShowPreviewModal(true);
    } else {
      // Pour les autres plateformes, comportement normal
      handleShare(message, platform, session, () => {}, () => {});
    }
  };

  const handleShowBlueSkyPreview = () => {
    const message = t('shareMessage', {
      count: totalReconnected,
      effectiveFollowers: stats.connections.totalEffectiveFollowers || 0
    });
    setShareMessage(message);
    setShowPreviewModal(true);
  };
                           
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8 bg-[#2a39a9] rounded-lg shadow-lg"
    >
      {/* Structure en une seule colonne */}
      <div className="w-full flex flex-col items-center gap-6 sm:gap-8">
        {/* Message de félicitations */}
        <div className="flex flex-col justify-center items-center text-center w-full">
        <h2 className={`${plex.className} text-xl sm:text-2xl font-bold mb-4 text-[#ebece7]`}>
          {t('congratulations')} <span className="text-[#d6356f]">@{username}</span> !{' '}
          {session.user.has_onboarded 
            ? t('secondObjective', { count: totalReconnected })
            : (
                <>
                  {t('reconnectWithoutOnboarding', { count: totalReconnected })
                    .split('\n')
                    .map((line, index) => (
                      <span key={index} className="block">
                        {line}
                      </span>
                    ))}
                </>
              )
          }
        </h2>

        {!session.user.has_onboarded && (
          <div className="mt-2 mb-4">
            <Link 
              href="/upload" 
              className="inline-flex items-center border border-transparent rounded-full p-3 text-base font-medium shadow-sm text-white bg-[#d6356f] hover:bg-[#c02a61] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d6356f]"
            >
              {t('uploadArchiveButton')}
            </Link>
          </div>
        )}

                  {/* Boutons de partage */}
                  <div className="w-full p-4">
                    <PartageButton
                      onShare={onShareClick}
                      onShowBlueSkyPreview={handleShowBlueSkyPreview}
                      providers={{
                        bluesky: !!session.user.bluesky_username,
                        mastodon: !!session.user.mastodon_username,
                        twitter: !!session.user.twitter_username
                      }}
                    />
                  </div>

                  <BlueSkyPreviewModal
            isOpen={showPreviewModal}
                        onClose={() => setShowPreviewModal(false)}
                        message={shareMessage}
                        session={session}
                        onSuccess={() => {}}
                    onError={() => {}}
                  />
                  
          <p className=" justify-center items-center text-center text-base md:text-lg text-[#ebece7]">
            {t('notification')}
          </p>
        </div>

        {/* Statistiques */}
        <div className={`w-auto ${
          session.user.bluesky_username && session.user.mastodon_username
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12'
            : 'flex justify-center'
        }`}>
          {session.user.mastodon_username && (
            <div className="inline-flex items-center py-3 px-4 rounded-xl bg-[#1f2498]/30  mx-auto">
              <div className="flex items-center gap-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 relative">
                  <Image
                    src={MastoLogo}
                    alt="Mastodon Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="bg-[#d6356f] text-white text-sm font-bold rounded-full min-w-[24px] min-h-[24px] flex items-center justify-center px-1.5 shadow-sm border border-[#1f2498]/30">
                  +{stats.matches.mastodon.hasFollowed}
                </div>
              </div>
            </div>
          )}
          {session.user.bluesky_username && (
            <div className="inline-flex items-center py-3 px-4 rounded-xl bg-[#1f2498]/30 mx-auto">
              <div className="flex items-center gap-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 relative">
                  <Image
                    src={BSLogo}
                    alt="Bluesky Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="bg-[#d6356f] text-white text-sm font-bold rounded-full min-w-[24px] min-h-[24px] flex items-center justify-center px-1.5 shadow-sm border border-[#1f2498]/30">
                  +{stats.matches.bluesky.hasFollowed}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Badge premier objectif et bouton */}
        {/* <div className="mt-6 flex flex-col items-center">
          
          <p className={`${plex.className} text-lg sm:text-xl font-medium text-[#ebece7] text-center mb-6`}>
            {t('firstObjective')}
          </p> */}
          
          {/* Only show button if there are notFollowed matches on any connected platform */}
          {((session.user.bluesky_username && stats.matches.bluesky.notFollowed > 0) || 
            (session.user.mastodon_username && stats.matches.mastodon.notFollowed > 0)) && (
            <button 
              onClick={() => {
                // Compter le nombre de services connectés
                const connectedServicesCount = [
                  !!session.user.twitter_username,
                  !!session.user.bluesky_username,
                  !!session.user.mastodon_username
                ].filter(Boolean).length;
                
                // Rediriger vers /dashboard si:
                // - L'utilisateur n'a pas fait son onboarding OU
                // - L'utilisateur est connecté à moins de 3 services
                if (!session.user.has_onboarded || connectedServicesCount < 3) {
                  window.location.href = '/dashboard';
                } else {
                  window.location.reload();
                }
              }}
              className="inline-block w-fit py-3 px-4 sm:p-4 bg-[#d6356f] text-[#ebece7] text-sm sm:text-base rounded-full hover:bg-[#c02d61] transition-colors"
            >
              {t('goToDashboard')}
            </button>
          )}
        {/* </div> */}
      </div>
    </motion.div>
  );
}
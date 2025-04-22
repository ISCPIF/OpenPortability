// src/app/_components/dashboard/NewsletterSection.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail } from 'lucide-react';
import Image from 'next/image';
import NewsletterRequest from '@/app/_components/NewsletterRequest';
import NewsletterFirstSeen from '@/app/_components/NewsLetterFirstSeen';
import notificationIcon from '../../../../public/newSVG/notif.svg';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useNewsletter } from '@/hooks/useNewsLetter';

type NewsletterSectionProps = {
  userId: string;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onUpdate: () => void;
  haveSeenNewsletter: boolean;
  onModalOpenChange?: (isOpen: boolean) => void;
};

export default function NewsletterSection({ 
  userId, 
  showModal, 
  setShowModal, 
  onUpdate,
  haveSeenNewsletter,
  onModalOpenChange
}: NewsletterSectionProps) {
  const t = useTranslations('dashboard');
  const { hqxNewsletter: hasNewsletterConsent } = useNewsletter();

  // Ne rien afficher si l'utilisateur a déjà consenti
  if (hasNewsletterConsent) {
    return null;
  }

  return (
    <>
      {/* Newsletter button */}
      <div className="flex flex-col items-center text-center px-4">
        <Image
          src={notificationIcon}
          alt=""
          width={18}
          height={18}
          className="text-white mb-2"
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setShowModal(true);
            if (onModalOpenChange) onModalOpenChange(true);
          }}
          className="group inline-flex items-center gap-2 sm:gap-3 text-indigo-200 hover:text-white transition-colors underline decoration-indigo-500"
        >
          <span className={`${plex.className} text-base sm:text-lg`}>{t('newsletter.subscribe')}</span>
        </motion.button>
      </div>
      
      {/* First seen newsletter modal */}
      <AnimatePresence>
        {!haveSeenNewsletter && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative my-4 w-full max-w-md md:max-w-3xl mx-auto"
              >
              <NewsletterFirstSeen
                userId={userId}
                onClose={() => {
                  onUpdate();
                  if (onModalOpenChange) onModalOpenChange(false);
                }}
                onSubscribe={() => {
                  setShowModal(false);
                  onUpdate();
                  if (onModalOpenChange) onModalOpenChange(false);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Newsletter modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
                if (onModalOpenChange) onModalOpenChange(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md md:max-w-3xl mx-auto"
              >
              <NewsletterRequest
                userId={userId}
                onClose={() => {
                  setShowModal(false);
                  if (onModalOpenChange) onModalOpenChange(false);
                }}
                onSubscribe={() => {
                  setShowModal(false);
                  onUpdate();
                  if (onModalOpenChange) onModalOpenChange(false);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
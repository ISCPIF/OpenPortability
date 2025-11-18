import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import NewsletterRequest from '@/app/_components/modales/NewsletterRequest';
import notificationIcon from '../../../../../public/newSVG/notif.svg';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/hooks/useTheme';

type NewsletterSectionProps = {
  userId: string;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onUpdate: () => void;
  haveSeenNewsletter: boolean;
  newsletterData: any; // Données newsletter passées en props
};

export default function NewsletterSection({ 
  userId, 
  showModal, 
  setShowModal, 
  onUpdate,
  haveSeenNewsletter,
  newsletterData
}: NewsletterSectionProps) {
  const t = useTranslations('dashboard');
  const { isDark } = useTheme();
  const hasNewsletterConsent = newsletterData?.consents?.hqx_newsletter;

  // Ne rien afficher si l'utilisateur a déjà consenti
  if (hasNewsletterConsent) {
    return null;
  }

  return (
    <>
      {/* Newsletter button */}
      <div
        className={`flex flex-col items-center text-center rounded-2xl transition-colors ${
          isDark
            ? 'bg-transparent px-4 py-4'
            : 'bg-transparent backdrop-blur-sm px-2 py-2'
        }`}
      >
        <Image
          src={notificationIcon}
          alt=""
          width={18}
          height={18}
          className={`${isDark ? 'text-white' : 'text-indigo-700'} mb-2`}
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowModal(true)}
          className={`group inline-flex items-center gap-2 sm:gap-3 transition-colors underline ${
            isDark
              ? 'text-indigo-200 hover:text-white decoration-indigo-500'
              : 'text-indigo-700 hover:text-indigo-900 decoration-indigo-700'
          }`}
        >
          <span className={`${plex.className} text-base sm:text-lg`}>{t('newsletter.subscribe')}</span>
        </motion.button>
      </div>
      
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
                }}
                onSubscribe={() => {
                  setShowModal(false);
                  onUpdate();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
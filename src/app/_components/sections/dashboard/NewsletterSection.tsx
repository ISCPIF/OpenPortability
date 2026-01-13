import { motion } from 'framer-motion';
import NewsletterRequest from '@/app/_components/modales/NewsletterRequest';
import { plex } from '@/app/fonts/plex';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/hooks/useTheme';
import { ShieldCheck, ArrowUpRight, Clock3 } from 'lucide-react';

type NewsletterSectionProps = {
  userId: string;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  onUpdate: () => void;
  haveSeenNewsletter: boolean;
  newsletterData: any;
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

  const trustBadges = [
    {
      icon: ShieldCheck,
      text: 'Privacy-first opt-in'
    },
    {
      icon: Clock3,
      text: '3 min recap max'
    }
  ];

  // Ne rien afficher si l'utilisateur a déjà consenti
  if (hasNewsletterConsent) {
    return null;
  }

  return (
    <>
      {/* Newsletter button */}
      <div
        className="relative overflow-hidden rounded-2xl border p-6 sm:p-8 transition-all duration-300 hover:-translate-y-0.5"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
          boxShadow: isDark
            ? '0 8px 24px rgba(0,0,0,0.25), 0 0 14px rgba(255,79,168,0.25)'
            : '0 8px 24px rgba(15,23,42,0.08), 0 0 14px rgba(255,79,168,0.18)'
        }}
      >
        <div className="relative flex-colun gap-6 md:grid-cols-[1.2fr_0.8fr] items-center">
          <div className="relative space-y-4">
            <div className="space-y-2">
              <p className={`${plex.className} text-sm uppercase tracking-[0.25em] opacity-70`}>
                opt-in securely
              </p>
              <p className="text-base">
                Plug your email to be notified. You can tweak or revoke consent anytime in Settings.
              </p>
            </div>

            <div className="space-y-3">
              {trustBadges.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm opacity-80">
                  <Icon className="h-4 w-4" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff4fa8] via-[#ff8acb] to-[#ffd6f0] px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_15px_35px_rgba(255,79,168,0.35)]"
            >
              {t('newsletter.subscribe')}
              <ArrowUpRight className="h-4 w-4" />
            </motion.button>

            <p className="text-xs opacity-70">
              Never spam. You will receive a recap email to confirm before anything goes live.
            </p>
          </div>
        </div>
      </div>
      
      {/* Newsletter modal - using ModalShell */}
      <NewsletterRequest
        userId={userId}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubscribe={() => {
          setShowModal(false);
          onUpdate();
        }}
      />
    </>
  );
}
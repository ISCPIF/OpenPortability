'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/app/_components/Header';
import NewsletterRequest from '@/app/_components/NewsletterRequest';
import Image from 'next/image'
import { supabase } from '@/lib/supabase';
import BlueSkyLogin from '@/app/_components/BlueSkyLogin';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts';
import MatchedBlueSkyProfiles from '@/app/_components/MatchedBlueSkyProfiles';
import UploadResults from '@/app/_components/UploadResults';
import ProgressSteps from '@/app/_components/ProgressSteps';
import PartageButton from '@/app/_components/PartageButton';
import DahsboardSea from '@/app/_components/DashboardSea';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Ship, Link } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { plex } from '../../fonts/plex';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';
import LoadingIndicator from '@/app/_components/LoadingIndicator';
import { FaTwitter, FaMastodon } from 'react-icons/fa';
import { SiBluesky } from "react-icons/si";
import { Share2, Mail, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import logoHQX from '../../../public/logoxHQX/HQX-rose-FR.svg';
import  Footer from '@/app/_components/Footer';
import { useTranslations } from 'next-intl';


// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
// );



type MatchedProfile = {
  bluesky_username: string
}

const LoginButton = ({ provider, onClick, children }: { provider: string, onClick: () => void, children: React.ReactNode }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-400 to-blue-500 
               text-white font-semibold rounded-xl shadow-lg hover:from-sky-500 hover:to-blue-600 
               transition-all duration-300 mb-4 w-full justify-center"
  >
    {children}
  </motion.button>
);

export default function DashboardPage() {
  const { data: session, status, update } = useSession(); // Ajoutez status
  // console.log('session par ici:', session)
  const router = useRouter();
  const params = useParams();

  const t = useTranslations('dashboard');

  const [stats, setStats] = useState({
    matchedCount: 0,
    totalUsers: 0,
    following: 0,
    followers: 0,
  });
  const [matchedProfiles, setMatchedProfiles] = useState<MatchedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true)
  const [isShared, setIsShared] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [showLoginButtonsModal, setShowLoginButtonsModal] = useState(false);

  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_id;
  const hasBluesky = session?.user?.bluesky_id;
  const hasTwitter = session?.user?.twitter_id;
  const hasOnboarded = session?.user?.has_onboarded;

  const connectedServicesCount = [hasMastodon, hasBluesky, hasTwitter].filter(Boolean).length;

    // Ajoutez cette vérification
    useEffect(() => {
      if (status === "unauthenticated" ) {
        router.replace("/auth/signin");
        return;
      }

    if (status !== "loading") {
      setIsLoading(false);
    }
  }, [status, router]);

  useEffect(() => {
    update()
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchStats();
    }
  }, [session]);

  // Si en chargement ou pas de session, afficher le loader
  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator msg={t('loading')} />
            </div>
          </div>
        </div>
      </div>
    );
  }


  const handleShare = async (url: string, platform: string) => {
    update()

    if (!session?.user?.id) {
      console.log('❌ No user session found, returning');
      return;
    }

    try {
      // Ouvrir l'URL dans un nouvel onglet
      window.open(url, '_blank');
      console.log('✅ URL opened in new tab');

      // Enregistrer via l'API
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          success: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record share event');
      }
      setIsShared(true);
    } catch (error) {
      console.error('❌ Error during share process:', error);

      await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          success: false
        })
      }).catch(console.error);
    }
  };

  const shareText = t('shareModal.shareText', { count: stats.followers + stats.following });

  const shareOptions = [
    {
      name: 'Twitter',
      icon: <FaTwitter className="w-5 h-5" />,
      color: 'bg-gradient-to-r from-pink-500 to-rose-600',
      isAvailable: !!session?.user?.twitter_id,
      shareUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    },
    {
      name: 'Bluesky',
      icon: <SiBluesky className="w-5 h-5" />,
      color: 'bg-gradient-to-r from-pink-400 to-pink-600',
      isAvailable: !!session?.user?.bluesky_id,
      shareUrl: `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText)}`
    },
    {
      name: 'Mastodon',
      icon: <FaMastodon className="w-5 h-5" />,
      color: 'bg-gradient-to-r from-rose-400 to-rose-600',
      isAvailable: !!session?.user?.mastodon_id,
      shareUrl: session?.user?.mastodon_instance
        ? `${session.user.mastodon_instance}/share?text=${encodeURIComponent(shareText)}`
        : ''
    },
    {
      name: 'Email',
      icon: <Mail className="w-5 h-5" />,
      color: 'bg-gradient-to-r from-pink-300 to-pink-500',
      isAvailable: true,
      shareUrl: `mailto:?subject=${encodeURIComponent('Ma migration avec HelloQuitteX')}&body=${encodeURIComponent(shareText)}`
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator msg={t('loading')} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const daysLeft = Math.ceil((new Date('2025-01-20').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));


  return (
    <div className="min-h-screen bg-[#2a39a9] mt-4 relative w-full max-w-[90rem] m-auto">
      <Header />
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <DahsboardSea progress={progress} />
      </div>

      <div className="relative min-h-[calc(100vh-4rem)] pt-80">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 md:mb-20 relative z-10">
              {progress === 100 ? (
                <div className="space-y-2 mt-12">
                  <h2 className={`${plex.className} text-xl font-semibold text-indigo-100`}>
                    {t('migrationStep.completed')}
                  </h2>
                  <p className={`${plex.className} text-indigo-200`}>
                    {t('migrationStep.daysLeft', { count: daysLeft })}
                  </p>
                </div>
              ) : (
                <h2 className={`${plex.className} text-xl font-semibold text-indigo-100`}>
                  {t('migrationStep.nextSteps')}
                </h2>
              )}
            </div>

            <div className="mb-4 md:mb-8 relative z-10">
              <ProgressSteps
                hasTwitter={hasTwitter}
                hasBluesky={hasBluesky}
                hasMastodon={hasMastodon}
                hasOnboarded={hasOnboarded}
                stats={stats}
                isShared={isShared}
                onProgressChange={setProgress}
                setIsModalOpen={setIsModalOpen}
              />
            </div>

            {stats && session?.user?.has_onboarded && (
              <div className="relative z-10">
                <UploadResults
                  stats={stats}
                  onShare={handleShare}
                  setIsModalOpen={setIsModalOpen}
                  twitter_username={session?.user?.twitter_username ?? undefined}
                  mastodon_username={session?.user?.mastodon_username ?? undefined}
                  bluesky_username={session?.user?.bluesky_username ?? undefined}
                />
              </div>
            )}

            <>
              <div className="flex justify-center relative z-10">
                <div className="w-full max-w-2xl flex gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsModalOpen(true)}
                    className={`flex-1 flex flex-col items-center justify-center gap-3 px-6 py-4 h-[120px]
                               bg-gradient-to-br from-blue-500 to-indigo-500 hover:bg-gradient-to-r hover:from-pink-500 hover:to-purple-500
                               text-white rounded-2xl shadow-lg 
                               transition-all duration-300 ${plex.className}`}
                  >
                    <span className="text-lg font-semibold">{t('addSocialNetwork')}</span>
                    <Link className="w-6 h-6 opacity-90" />
                  </motion.button>
                  {!hasOnboarded && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const locale = params.locale as string || 'fr';
                        router.push(`/${locale}/upload`);
                      }}
                      className={`flex-1 flex flex-col items-center justify-center gap-3 px-6 py-4 h-[120px]
                               bg-gradient-to-br from-blue-500 to-indigo-500 hover:bg-gradient-to-r hover:from-pink-500 hover:to-purple-500
                               text-white rounded-2xl shadow-lg 
                               transition-all duration-300 ${plex.className}`}
                    >
                      <span className="text-lg font-semibold">{t('importButton')}</span>
                      <Ship className="w-6 h-6 opacity-90" />
                    </motion.button>
                  )}
                </div>
              </div>

              {session?.user?.id && (
                <>
                  <div className="flex justify-center mt-4 relative z-10 mb-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowNewsletterModal(true)}
                      className={`flex flex-col items-center justify-center gap-3 px-6 py-4 w-full max-w-2xl h-[120px]
                          bg-gradient-to-br from-blue-500 to-indigo-500 hover:bg-gradient-to-r hover:from-pink-500 hover:to-purple-500
                          text-white rounded-2xl shadow-lg 
                          transition-all duration-300 ${plex.className}`}
                    >
                      <span className="text-lg font-semibold">{t('newsletter.subscribe')}</span>
                      <Mail className="w-6 h-6 opacity-90" />
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {showNewsletterModal && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={(e) => {
                          if (e.target === e.currentTarget) setShowNewsletterModal(false)
                        }}
                      >
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.95, opacity: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <NewsletterRequest
                            userId={session.user.id}
                            onClose={() => setShowNewsletterModal(false)}
                            onSubscribe={() => {
                              setShowNewsletterModal(false);
                              update();
                            }}
                          />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 max-w-lg w-full mx-4 relative
                        shadow-xl border border-slate-700/50"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-700/50 text-slate-400 hover:text-white
                          transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 p-3 rounded-xl mb-4">
                  <Link className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{t('addSocialNetwork')}</h3>
                <p className="text-slate-400 text-sm max-w-sm">
                  {t('addSocialNetworkDescription')}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <DashboardLoginButtons
                  connectedServices={{
                    twitter: !!session?.user?.twitter_id,
                    bluesky: !!session?.user?.bluesky_id,
                    mastodon: !!session?.user?.mastodon_id
                  }}
                  hasUploadedArchive={!!stats}
                  onLoadingChange={setIsLoading}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
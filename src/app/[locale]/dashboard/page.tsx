'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/app/_components/Header';
import NewsletterRequest from '@/app/_components/NewsletterRequest';
import Image from 'next/image'
import { supabase } from '@/lib/supabase';
import BlueSkyLogin from '@/app/_components/BlueSkyLogin';
import MastodonLogin from '@/app/_components/MastodonLogin';
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
  console.log('session par ici:', session)
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

  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_id;
  const hasBluesky = session?.user?.bluesky_id;
  const hasTwitter = session?.user?.twitter_id;
  const hasOnboarded = session?.user?.has_onboarded;

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

    // useEffect(() => {
    //   if (session?.user && !session.user.twitter_id && !session.user.mastodon_id && !session.user.bluesky_id) {
    //     // Si la session est incomplète, forcer une mise à jour
    //     update();
    //   }
    // }, [session, update]);

    useEffect(() => {
      update()
    }, []);
  
    useEffect(() => {
      const fetchStats = async () => {
        try {
          setIsLoading(true);
          // await new Promise(resolve => setTimeout(resolve, 2000))
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
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <p className="text-white/60">{t('loading')}</p>
          </motion.div>
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

      // Enregistrer l'échec via l'API
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
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-12 h-12 text-white animate-spin" />
          <p className="text-white/60">{t('loading')}</p>
        </motion.div>
      </div>
    )
  }

  const daysLeft = Math.ceil((new Date('2025-01-20').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));


  return (
    <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <Header />
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <DahsboardSea progress={progress} />
      </div>

      <div className="relative min-h-[calc(100vh-4rem)] pt-80">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-20 relative z-10">
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

            <div className="mb-24 relative z-10">
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
          </div>
        </div>

        <div className="container mx-auto px-4 pb-20">
          <div className="max-w-2xl mx-auto space-y-16">
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

{!hasOnboarded && (
              <div className="flex items-center justify-center gap-4 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const locale = params.locale as string || 'fr';
                    router.push(`/${locale}/upload`);
                  }}
                  className={`flex flex-col items-center justify-center gap-3 px-6 py-4 w-[250px] h-[120px]
                           ${(hasTwitter && hasMastodon) || (hasBluesky && hasMastodon) || (hasBluesky && hasTwitter)
                      ? 'bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600'
                      : 'bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600'}
                           text-white font-semibold rounded-xl shadow-lg 
                           transition-all duration-300 ${plex.className}`}
                >
                  <span>{t('importButton')}</span>
                  <Ship className="w-6 h-6" />
                </motion.button>

                <div className="w-[250px] h-[120px]">
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

                {session?.user?.id && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowNewsletterModal(true)}
                      className="flex flex-col items-center justify-center gap-3 px-6 py-4 w-[250px] h-[120px]
                               bg-gradient-to-r from-indigo-400 to-purple-500 hover:from-indigo-500 hover:to-purple-600
                               text-white font-semibold rounded-xl shadow-lg 
                               transition-all duration-300"
                    >
                      <span>{t('newsletter.subscribe')}</span>
                      <Mail className="w-6 h-6" />
                    </motion.button>

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
              </div>
            )}

            {/* <div className="max-w-md mx-auto relative z-10">
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

            {!hasOnboarded && (
              <div className="text-center relative z-10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const locale = params.locale as string || 'fr';
                    router.push(`/${locale}/upload`);
                  }}
                  className={`inline-flex items-center gap-3 px-8 py-4 
                           ${(hasTwitter && hasMastodon) || (hasBluesky && hasMastodon) || (hasBluesky && hasTwitter)
                      ? 'bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600'
                      : 'bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600'}
                           text-white font-semibold rounded-xl shadow-lg 
                           transition-all duration-300 ${plex.className}`}
                >
                  <Ship className="w-6 h-6" />
                  {t('importButton')}
                </motion.button>
              </div>
            )} */}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-2xl font-bold mb-6">{t('shareModal.title')}</h3>
              <div className="space-y-4">
                {shareOptions.map((option, index) => (
                  option.isAvailable && (
                    <motion.button
                      key={option.name}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        handleShare(option.shareUrl, option.name.toLowerCase());
                        setIsModalOpen(false);
                      }}
                      className={`w-full py-3 px-4 rounded-xl text-white flex items-center gap-3 
                                ${option.color} transition-all duration-200`}
                    >
                      {option.icon}
                      <span>{t('shareModal.shareOn', { platform: option.name })}</span>
                    </motion.button>
                  )
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
'use client'

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/app/_components/Header';
import NewsletterRequest from '@/app/_components/NewsletterRequest';
import NewsletterFirstSeen from '@/app/_components/NewsLetterFirstSeen';
import Image from 'next/image'
import { supabase } from '@/lib/supabase';
import BlueSkyLogin from '@/app/_components/BlueSkyLogin';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts';
import MatchedBlueSkyProfiles from '@/app/_components/MatchedBlueSkyProfiles';
import UploadResults from '@/app/_components/UploadResults';
import LaunchReconnection from '@/app/_components/LaunchReconnection';
import DahsboardSea from '@/app/_components/DashboardSea';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Upload, Link } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { plex } from '../../fonts/plex';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';
import LoadingIndicator from '@/app/_components/LoadingIndicator';
import { FaTwitter, FaMastodon } from 'react-icons/fa';
import { SiBluesky } from "react-icons/si";
import { Share2, Mail, X, Play } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import notificationIcon from '../../../../public/newSVG/notif.svg';
import Footer from '@/app/_components/Footer';
import { useTranslations } from 'next-intl';
import { GlobalStats, UserCompleteStats } from '@/lib/types/stats';
import ProgressSteps from '@/app/_components/ProgressSteps';
import LoginSea from "@/app/_components/LoginSea"
import MigrateStats from '@/app/_components/MigrateStats';

type MatchedProfile = {
  bluesky_username: string
}

type DashboardStats = {
  userStats: UserCompleteStats;
  globalStats: GlobalStats;
}

export default function DashboardPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('dashboard');

  const [stats, setStats] = useState<DashboardStats>({
    userStats: {
      connections: {
        followers: 0,
        following: 0,
      },
      matches: {
        bluesky: {
          total: 0,
          hasFollowed: 0,
          notFollowed: 0,
        },
        mastodon: {
          total: 0,
          hasFollowed: 0,
          notFollowed: 0,
        }
      },
      updated_at: new Date().toISOString()
    },
    globalStats: {
      users: {
        total: 0,
        onboarded: 0
      },
      connections: {
        followers: 0,
        following: 0,
        withHandle: 0
      },
      updated_at: new Date().toISOString()
    }
  });
  const [matchedProfiles, setMatchedProfiles] = useState<MatchedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShared, setIsShared] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [mastodonInstances, setMastodonInstances] = useState<string[]>([])

  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_id;
  const hasBluesky = session?.user?.bluesky_id;
  const hasTwitter = session?.user?.twitter_id;
  const hasOnboarded = session?.user?.has_onboarded;

  const connectedServicesCount = [hasMastodon, hasBluesky, hasTwitter].filter(Boolean).length;

  useEffect(() => {
    const fetchMastodonInstances = async () => {
      try {
        const response = await fetch('/api/auth/mastodon')
        const data = await response.json()
        if (data.success) {
          setMastodonInstances(data.instances)
        }
      } catch (error) {
        console.error('Error fetching Mastodon instances:', error)
      }
    }

    fetchMastodonInstances()
  }, [])

  useEffect(() => {
    // Ne vérifier que lors du montage initial
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
      return;
    }

    // Ne mettre à jour le loading que si nécessaire
    if (status === "loading" && !isLoading) {
      setIsLoading(true);
    } else if (status !== "loading" && isLoading) {
      setIsLoading(false);
    }
  }, [status, router, isLoading]);

  useEffect(() => {
    const fetchStats = async () => {
      // Ne pas setIsLoading(true) ici, car cela pourrait causer un re-render
      try {
        const [userStatsResponse, globalStatsResponse] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/stats/total')
        ]);

        if (!userStatsResponse.ok || !globalStatsResponse.ok) {
          throw new Error('Failed to fetch stats');
        }

        const [userStats, globalStats] = await Promise.all([
          userStatsResponse.json(),
          globalStatsResponse.json()
        ]);

        setStats({
          userStats,
          globalStats
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    // Ne charger les stats que si l'utilisateur est authentifié
    if (status === "authenticated") {
      fetchStats();
    }
  }, [status]);


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
    );
  }

  return (
    <div className="min-h-screen bg-[#2a39a9] mt-4 relative w-full max-w-[80rem] m-auto">
      <div className="relative z-40">
        <Header />
      </div>
      <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
      <LoginSea />
      </div>

      <AnimatePresence>
        {session?.user && !session.user.have_seen_newsletter && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative my-4"
            >
              <NewsletterFirstSeen
                userId={session.user.id}
                onClose={() => {
                  update();
                  session.user.have_seen_newsletter = true;
                }}
                onSubscribe={() => {
                  setShowNewsletterModal(false);
                  update();
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative min-h-[calc(100vh-4rem)] pt-[250px]">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">

            <div className="mb-4 md:mb-8 relative z-10">
              {session?.user?.has_onboarded && (session?.user?.mastodon_username || session?.user?.bluesky_username) ? (
          <>
          <LaunchReconnection
            session={{
              user: {
                twitter_username: session.user.twitter_username,
                bluesky_username: session.user.bluesky_username,
                mastodon_username: session.user.mastodon_username,
                mastodon_instance: session.user.mastodon_instance
              }
            }}
            totalProcessed={stats.globalStats.users.total}
            totalInDatabase={stats.globalStats.connections.following + stats.globalStats.connections.followers}
            userStats={stats.userStats}
            mastodonInstances={mastodonInstances}
          />
          <div className="mb-4">
            <DashboardLoginButtons
              connectedServices={{
                twitter: true,
                bluesky: !!session?.user?.bluesky_username,
                mastodon: !!session?.user?.mastodon_username
              }}
              hasUploadedArchive={true}
              onLoadingChange={setIsLoading}
              mastodonInstances={mastodonInstances}
            />
          </div>
          </>
              ) : (

                
                <>
                  {/* <div className="text-center mb-8 md:mb-10 relative z-10"> */}
                    {/* {progress === 100 ? (
                      <div className="space-y-2 mt-12">
                        <h2 className={`${plex.className} text-xl font-semibold text-indigo-100 text-balance`}>
                          {t('migrationStep.completed1')}
                        </h2>
                        <p className={`${plex.className} text-indigo-200 text-balance whitespace-pre-line`}>
                          {t('migrationStep.completed2', { count: daysLeft }).split('\n').join('\n')}
                        </p>
                      </div>
                    ) : (
                      <h2 className={`${plex.className} text-xl font-semibold text-indigo-100 mt-16`}>
                        {t('migrationStep.nextSteps')}
                      </h2>
                    )} */}
                  {/* </div> */}
                </>
              )}
            </div>

            {(connectedServicesCount < 3 || !hasOnboarded) &&
              <div className="w-full flex justify-center mt-[100px]">
                <div className="inline-block backdrop-blur-xs rounded-2xl p-4">
                  {!hasOnboarded && (
                   <div className="flex flex-col items-center justify-center text-center">
                   <motion.button
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     onClick={() => {
                       router.push('/upload');
                     }}
                     className="w-full flex items-center justify-between px-8 py-4 bg-white rounded-full text-black font-medium  relative overflow-hidden group"
                   >
                     <div className="flex text-center gap-2 mx-auto">
                       <Upload className="w-6 h-6" />
                       <span className={plex.className}>{t('importButton')}</span>
                     </div>
                   </motion.button>
                   <button
                     onClick={() => router.push('/reconnect')}
                     className={`mt-6 text-sm text-white text-center hover:text-[#d6356f] transition-colors ${plex.className} mb-6`}
                     style={{ fontStyle: 'italic' }}
                   >
                     {t('no_archive_yet')}
                   </button>

                   {/* <DashboardLoginButtons
              connectedServices={{
                twitter: true,
                bluesky: !!session?.user?.bluesky_username,
                mastodon: !!session?.user?.mastodon_username
              }}
              hasUploadedArchive={true}
              onLoadingChange={setIsLoading}
              mastodonInstances={mastodonInstances}
            /> */}
                 </div>
                  )}
                </div>
              </div>
            }

            <div className=" space-y-16 mt-16 mb-16">
              {session?.user?.id && (
                <div className="flex flex-col items-center text-center">
                  <Image
                    src={notificationIcon}
                    alt=""
                    width={20}
                    height={20}
                    className=" text-white mb-2"
                  />
                  {/* <h2 className={`${plex.className} text-2xl font-medium text-white mb-2`}>{t('newsletter.title')}</h2> */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowNewsletterModal(true)}
                    className="group inline-flex items-center gap-3 text-indigo-200 hover:text-white transition-colors underline decoration-indigo-500"
                  >
                    {/* <Mail className="w-5 h-5" /> */}
                    <span className={`${plex.className} text-lg`}>{t('newsletter.subscribe')}</span>
                  </motion.button>
                </div>
              )}

              {progress < 100 &&
                <div className="flex flex-col items-center text-center space-y-4 mb-4">
                  <h2 className={`${plex.className} text-lg font-medium text-white`}>
                    {t('tutorial.title')}
                  </h2>
                  <motion.a
                    href={params.locale === 'fr' 
                      ? "https://indymotion.fr/w/jLkPjkhtjaSQ9htgyu8FXR"
                      : "https://indymotion.fr/w/nQZrRgP3ceQKQV3ZuDJBAZ"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-3 text-indigo-200 hover:text-white transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play className="w-5 h-5" />
                    <span className={`${plex.className} text-lg underline decoration-indigo-500`}>{t('tutorial.watchVideo')}</span>

                  </motion.a>
                </div>
              }
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
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

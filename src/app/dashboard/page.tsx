'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/_components/Header';
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
import { plex } from '../fonts/plex';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';
import { FaTwitter, FaMastodon } from 'react-icons/fa';
import { SiBluesky } from "react-icons/si";
import { Share2, Mail, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

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
            <p className="text-white/60">Chargement de vos données...</p>
          </motion.div>
        </div>
      );
    }


  const handleShare = async (url: string, platform: string) => {
    console.log('🚀 handleShare started');
    console.log('Platform:', platform, 'URL:', url);
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

      console.log('✅ Share event recorded successfully');
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

  const shareText = `🔥L'exode de X est massif ! Ne perdez pas un seul de vos followers. Grâce à #HelloQuitX j'ai inscrit ${stats.followers + stats.following} nouveaux passagers pour un voyage vers #BlueSky & #Mastodon. Embarquez vous aussi et retrouvez automatiquement vos communautés le #20Janvier ! https://app.beta.helloquitx.com `;

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
          <p className="text-white/60">Chargement de vos données...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <Header />
      <DahsboardSea progress={progress} />

      <div className="mx-auto px-4 my-[30rem]">
        {/* Frise chronologique */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Message conditionnel basé sur le progrès */}
            <div className="text-center mb-8 z-50 relative">
              {progress === 100 ? (
                <div className="space-y-2">
                  <h2 className={`${plex.className} text-xl font-semibold text-indigo-100`}>
                    Vous avez réalisé la première étape de votre migration
                  </h2>
                  <p className={`${plex.className} text-indigo-200`}>
                    {Math.ceil((new Date('2025-01-20').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} restants jours avant le grand départ
                  </p>
                </div>
              ) : (
                <h2 className={`${plex.className} text-xl font-semibold text-indigo-100`}>
                  Effectuez les étapes suivantes pour voguer vers de nouveaux rivages !
                </h2>
              )}
            </div>

            <ProgressSteps
              hasTwitter={hasTwitter}
              hasBluesky={hasBluesky}
              hasMastodon={hasMastodon}
              hasOnboarded={hasOnboarded}
              stats={stats}
              onShare={handleShare}
              isShared={isShared}
              onProgressChange={setProgress}
              setIsModalOpen={setIsModalOpen}
            />
          </div>
        </div>
        <div className="max-w-2xl mx-auto space-y-8">
          {stats && session?.user?.has_onboarded && (
            <UploadResults
              stats={stats}
              onShare={handleShare}
              setIsModalOpen={setIsModalOpen}
            />
          )}
          {!((hasTwitter && hasMastodon) || (hasBluesky && hasMastodon) || (hasBluesky && hasTwitter)) && (
            <div className="max-w-md mx-auto">
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
          )}
          {/* Removed old button since it's now handled by DashboardLoginButtons */}
          {/* Afficher le bouton d'upload si l'utilisateur n'a pas encore onboarded */}
          {!hasOnboarded && (
            <div className="text-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/upload')}
                className={`inline-flex items-center gap-3 px-8 py-4 
                         ${(hasTwitter && hasMastodon) || (hasBluesky && hasMastodon) || (hasBluesky && hasTwitter)
                    ? 'bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600'
                    : 'bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600'}
                         text-white font-semibold rounded-xl shadow-lg 
                         transition-all duration-300 mb-4 ${plex.className}`}
              >
                <Ship className="w-6 h-6" />
                Importer mon archive Twitter pour continuer mon voyage
              </motion.button>
            </div>
          )}
          {/* Boutons de connexion pour les autres services */}
          {/* {renderLoginButtons()} */}

          {/* <ConnectedAccounts
            hasTwitter={hasTwitter}
            hasMastodon={hasMastodon}
            hasBluesky={hasBluesky}
          /> */}

          {/* Afficher les profils BlueSky correspondants */}
          {/* {hasTwitter && (
            <MatchedBlueSkyProfiles
              matchedCount={stats.matchedCount}
              totalUsers={stats.totalUsers}
              profiles={matchedProfiles}
            />
          )} */}
        </div>
      </div>

      {/* Modale de partage */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0" style={{ zIndex: 9999 }}>
            <div
              className="fixed inset-0 bg-[#0D0D0D] opacity-50"
              onClick={() => setIsModalOpen(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`relative w-full max-w-md mx-4 ${plex.className}`}
              >
                <div className="bg-[#0D0D0D] rounded-2xl border border-pink-500/20 
                            shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-pink-500/20 bg-[#0D0D0D]">
                    <h3 className="text-lg font-medium text-white">Partager votre migration</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModalOpen(false);
                      }}
                      className="p-1 hover:bg-pink-500/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-pink-400" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3 bg-[#0D0D0D]">
                    {shareOptions
                      .filter(option => option.isAvailable)
                      .map((option) => (
                        <motion.button
                          key={option.name}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleShare(option.shareUrl, option.name)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-white 
                                transition-all duration-200 ${option.color} 
                                hover:brightness-110 shadow-lg ${plex.className}`}
                        >
                          {option.icon}
                          <span>Partager sur {option.name}</span>
                        </motion.button>
                      ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

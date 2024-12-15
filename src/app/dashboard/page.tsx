'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Header from '@/app/_components/Header';
import Image from 'next/image'
import BlueSkyLogin from '@/app/_components/BlueSkyLogin';
import MastodonLogin from '@/app/_components/MastodonLogin';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts';
import MatchedBlueSkyProfiles from '@/app/_components/MatchedBlueSkyProfiles';
import UploadResults from '@/app/_components/UploadResults';
import ProgressSteps from '@/app/_components/ProgressSteps';
import PartageButton from '@/app/_components/PartageButton';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { CheckCircle, Link } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import seaBackground from '../../../public/sea.svg'
import boat1 from '../../../public/boats/boat-1.svg'
import progress0 from '../../../public/progress/progress-0.svg'
import progress33 from '../../../public/progress/progress-33.svg'
import progress66 from '../../../public/progress/progress-66.svg'
import progress100 from '../../../public/progress/progress-100.svg'
import { plex } from '../fonts/plex';
import logoHQX from '../../../public/BannerHQX-rose_FR.svg'


type MatchedProfile = {
  bluesky_handle: string
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
  const { data: session } = useSession()
  console.log('session:', session)
  const router = useRouter();
  const [stats, setStats] = useState({
    matchedCount: 0,
    totalUsers: 0,
    following: 0,
    followers: 0,
  });
  const [matchedProfiles, setMatchedProfiles] = useState<MatchedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true)

  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_id;
  const hasBluesky = session?.user?.bluesky_id;
  const hasTwitter = session?.user?.twitter_id;
  const hasOnboarded = session?.user?.has_onboarded;

  const handleShare = async (url: string, platform: string) => {
    if (session?.user?.id) {
      try {
        const { data, error } = await supabase
          .from('share_events')
          .insert({
            user_id: session.user.id,
            platform,
            shared_at: new Date().toISOString(),
            success: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          console.error('Supabase error:', error.message, error.details)
          throw error
        }

        console.log('Share event created:', data)
      } catch (error: any) {
        console.error('Error tracking share:', {
          message: error?.message,
          details: error?.details,
          error
        })
      }
    }

    // Toujours ouvrir l'URL, même en cas d'erreur
    window.open(url, '_blank')
  }

  useEffect(() => {
    async function fetchStats() {
      if (session?.user?.twitter_id) {
        try {
          // Simuler un chargement de 3 secondes
          await new Promise(resolve => setTimeout(resolve, 4000))

          // Récupérer les correspondances BlueSky pour l'utilisateur
          const { data: matches, error: matchError } = await supabase
            .from('matched_bluesky_mappings')
            .select('bluesky_handle')
            .eq('source_twitter_id', session.user.twitter_id);

          if (matchError) {
            console.error('Erreur lors de la récupération des correspondances:', matchError);
          } else {
            setMatchedProfiles(matches || []);
            setStats(s => ({ ...s, matchedCount: matches?.length || 0 }));
          }

          // Récupérer le nombre total d'utilisateurs connectés
          const { count: totalConnectedUsers, error: usersError } = await supabase
            .from('connected_users_bluesky_mapping')
            .select('*', { count: 'exact' });

          if (usersError) {
            console.log(usersError)
            console.error('Erreur lors de la récupération du nombre total d\'utilisateurs:', usersError);
          } else {
            setStats(s => ({ ...s, totalUsers: totalConnectedUsers || 0 }));
          }

          // Récupérer le nombre de following
          const { data: followingStats, error: followingError } = await supabase
            .from('sources_targets')
            .select('target_twitter_id')
            .eq('source_id', session.user.id);

          console.log('followingStats:', followingStats);

          // Récupérer le nombre de followers
          const { data: followerStats, error: followerError } = await supabase
            .from('sources_followers')
            .select('follower_id')
            .eq('source_id', session.user.id);

          console.log('followerStats:', followerStats);

          if (!followingError && !followerError) {
            setStats(s => ({
              ...s,
              following: followingStats?.length || 0,
              followers: followerStats?.length || 0
            }));
          } else {
            console.error('Erreur lors de la récupération des stats:', { followingError, followerError });
          }

        } catch (error) {
          console.error('Erreur inattendue:', error);
        } finally {
          setIsLoading(false)
        }
      } else {
        setIsLoading(false)
      }
    }

    fetchStats();
  }, [session, hasOnboarded]);

  const renderLoginButtons = () => {
    const remainingButtons = [];

    if (!hasTwitter) {
      remainingButtons.push(
        <LoginButton key="connect-twitter" provider="twitter" onClick={() => signIn("twitter")}>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z" />
          </svg>
          Se connecter avec Twitter
        </LoginButton>
      );
    }

    if (!hasMastodon) {
      remainingButtons.push(
        <LoginButton key="connect-mastodon" provider="mastodon" onClick={() => signIn("mastodon")}>
          Se connecter avec Mastodon
        </LoginButton>
      );
    }

    if (!hasBluesky) {
      remainingButtons.push(
        <div key="connect-bluesky" className="w-full">
          <BlueSkyLogin onLoginComplete={() => {
            // Optionally handle successful login
            router.refresh();
          }} />
        </div>
      );
    }

    return remainingButtons.length > 0 ? (
      <div className="space-y-4">
        <p className="text-lg text-gray-300 mb-4">
          Connectez d'autres comptes pour enrichir votre expérience
        </p>
        <div className="space-y-4">
          {remainingButtons}
        </div>
      </div>
    ) : null;
  };

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
    <div className="bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
      <Header />
      <div className="absolute top-0 w-full h-[35rem]">
        <Image src={seaBackground} fill alt="" className="object-cover"></Image>
        <Image
          src={logoHQX}
          alt="HelloQuitteX Logo"
          width={306}
          height={125}
          className="mx-auto lg:mt-8 relative"
        />
        <div className="container flex flex-col mx-auto text-center gap-y-4 px-6 lg:gap-y-8 text-[#282729] relative my-8 lg:my-14 max-w-[50rem]">
          <h1 className={`${plex.className} text-2xl lg:text-3xl font-light`}>Bienvenue à bord d’HelloQuitX !</h1>
          <p className={`${plex.className} text-lg lg:text-xl font-normal`}>Effectuez les étapes suivantes pour voguer vers de nouveaux horizons et enfin QUITTER X !</p>
        </div>
        <motion.div className="absolute top-[65%] left-[46.5%]" style={{ originX: 0.5, originY: 1 }}
          transition={{
            repeatType: 'reverse',
            repeat: Infinity,
            duration: 2,
            ease: "linear"
          }}
          initial={{ rotateZ: "-5deg" }}
          animate={{ rotateZ: "5deg" }}
          exit={{ rotateZ: 0 }}
        >
          <Image src={boat1} width={110} height={88} alt="" className=""></Image>
        </motion.div>
        <Image src={progress0} width={80} height={82} alt="" className="absolute top-[87%] left-[48%]"></Image>
      </div>
      <div className="mx-auto px-4 my-[30rem]">
        {/* Frise chronologique */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto space-y-6">
            <ProgressSteps
              hasTwitter={hasTwitter}
              hasBluesky={hasBluesky}
              hasMastodon={hasMastodon}
              hasOnboarded={hasOnboarded}
              stats={stats}
            />

            {/* Bouton de partage
          <div className="flex justify-center mb-8">
            <PartageButton onShare={handleShare} />
          </div> */}
          </div>
        </div>
        <div className="max-w-2xl mx-auto space-y-8">
          {hasOnboarded && (
            <UploadResults
              stats={{
                following: stats.following,
                followers: stats.followers
              }}
              onShare={handleShare}
            />
          )}

          {/* Afficher le bouton d'upload si l'utilisateur n'a pas encore onboarded */}
          {!hasOnboarded && hasTwitter && (
            <div className="text-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/upload')}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-400 to-blue-500 
                         text-white font-semibold rounded-xl shadow-lg hover:from-sky-500 hover:to-blue-600 
                         transition-all duration-300 mb-4"
              >
                <CheckCircle className="w-6 h-6" />
                Importer mes abonnements Twitter
              </motion.button>
            </div>
          )}

          {/* Boutons de connexion pour les autres services */}
          {renderLoginButtons()}

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
    </div >
  );
}

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
import Sea from '@/app/_components/Sea';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { CheckCircle, Link } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { plex } from '../fonts/plex';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
// );



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
  const { data: session, update } = useSession()
  // console.log('session:', session)
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

  // Déterminer quels comptes sont connectés
  const hasMastodon = session?.user?.mastodon_id;
  const hasBluesky = session?.user?.bluesky_id;
  const hasTwitter = session?.user?.twitter_id;
  const hasOnboarded = session?.user?.has_onboarded;


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

  useEffect(() => {
    update()
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 4000))
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
      <Sea progress={progress} />

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
                  Effectuez les étapes suivantes pour voguer vers de nouveaux horizons et enfin quitter X
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
              userId={session?.user?.id}
              twitterId={session?.user?.twitter_id}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        </div>
        <div className="max-w-2xl mx-auto space-y-8">
          {stats && session?.user?.has_onboarded && (
            <UploadResults
              stats={stats}
              onShare={handleShare}
            />
          )}
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
          {/* Removed old button since it's now handled by DashboardLoginButtons */}
          {/* Afficher le bouton d'upload si l'utilisateur n'a pas encore onboarded */}
          {!hasOnboarded && (
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
                Importer mon archive Twitter pour continuer ma migration
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
    </div >
  );
}

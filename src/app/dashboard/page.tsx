'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Header from '@/app/_components/Header';
import BlueSkyLogin from '@/app/_components/BlueSkyLogin';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts'
import MatchedBlueSkyProfiles from '@/app/_components/MatchedBlueSkyProfiles'
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

type MatchedProfile = {
  bluesky_handle: string
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const needsBlueSkyLogin = session?.user?.twitter_id && !session?.user?.bluesky_id
  const [stats, setStats] = useState({
    matchedCount: 0,
    totalUsers: 0,
  });
  const [matchedProfiles, setMatchedProfiles] = useState<MatchedProfile[]>([]);

  useEffect(() => {
    async function fetchStats() {
      if (session?.user?.twitter_id) {
        try {
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
            console.error('Erreur lors de la récupération du nombre total d\'utilisateurs:', usersError);
          } else {
            setStats(s => ({ ...s, totalUsers: totalConnectedUsers || 0 }));
          }
        } catch (error) {
          console.error('💥 Erreur inattendue:', error);
        }
      }
    }

    fetchStats();
  }, [session]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text mb-6">
              Bienvenue sur HelloQuitteX
            </h1>
            {!session?.user?.twitter_id && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <p className="text-lg text-gray-300 mb-4">
                  Connectez d'abord votre compte Twitter pour commencer
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signIn("twitter")}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-sky-400 to-blue-500 
                           text-white font-semibold rounded-xl shadow-lg hover:from-sky-500 hover:to-blue-600 
                           transition-all duration-300"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/>
                  </svg>
                  Se connecter avec Twitter
                </motion.button>
              </motion.div>
            )}
            {!session?.user?.has_onboarded && session?.user?.twitter_id && (
              <>
                <p className="text-lg text-gray-300 mb-8">
                  Prêt à migrer vos abonnements Twitter vers BlueSky ?
                </p>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <a
                    href="/upload"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 
                             text-white font-semibold rounded-xl shadow-lg hover:from-blue-600 hover:to-purple-700 
                             transition-all duration-300"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5L12 19M12 5L6 11M12 5L18 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Commencer votre migration
                  </a>
                </motion.div>
              </>
            )}
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 text-center border border-white/10">
              <p className="text-2xl font-bold text-white">{stats.matchedCount}</p>
              <p className="text-sm text-white/60">Correspondances BlueSky</p>
              <MatchedBlueSkyProfiles profiles={matchedProfiles} />
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 text-center border border-white/10">
              <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              <p className="text-sm text-white/60">Utilisateur·rice·s Connecté·e·s</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 text-center border border-white/10">
              <ConnectedAccounts />
            </div>
          </div>
        </div>

        {/* Section de connexion BlueSky */}
        {needsBlueSkyLogin && (
          <section className="max-w-md mx-auto">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">
                Connectez votre compte BlueSky
              </h2>
              <BlueSkyLogin onLoginComplete={() => window.location.reload()} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
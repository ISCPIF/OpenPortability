'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Header from '@/app/_components/Header';
import BlueSkyLogin from '@/app/_components/BlueSkyLogin';
import ConnectedAccounts from '@/app/_components/ConnectedAccounts'
import MatchedBlueSkyProfiles from '@/app/_components/MatchedBlueSkyProfiles'
import { useSession } from 'next-auth/react';
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
          {/* Animation de succès */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.5,
              ease: [0, 0.71, 0.2, 1.01]
            }}
            className="text-center mb-12"
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="inline-block mb-6"
            >
              <CheckCircle className="w-16 h-16 text-green-500" />
            </motion.div>
            
            <motion.h1 
              className="text-3xl font-bold text-white mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              Première étape terminée !
            </motion.h1>
            
            <motion.p 
              className="text-lg text-white/60"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              Vos comptes Twitter et BlueSky sont maintenant connectés
            </motion.p>
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
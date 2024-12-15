'use client'

import { motion } from 'framer-motion';
import { CheckCircle, Users, UserPlus, Globe } from 'lucide-react';
import PartageButton from './PartageButton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UploadStats {
  following: number;
  followers: number;
}

interface UploadResultsProps {
  stats: UploadStats;
  showRedirectMessage?: boolean;
  onShare: (url: string, platform: string) => void;
}

export default function UploadResults({ 
  stats, 
  showRedirectMessage = false,
  onShare 
}: UploadResultsProps) {
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    async function fetchTotalUsers() {
      try {
        const { count } = await supabase
          .from('connected_users_bluesky_mapping')
          .select('*', { count: 'exact', head: true });
        
        setTotalUsers(count || 0);
      } catch (error) {
        console.error('Error fetching total users:', error);
      }
    }

    fetchTotalUsers();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto mb-8"
    >
      <div className="bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 
                    backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-green-500/20 p-3 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 
                       bg-clip-text text-transparent">
            Félicitations !
          </h2>
        </div>

        <p className="text-white/80">
          Vous avez commencé votre migration avec succès. Voici un résumé de vos données importées :
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-blue-500/20 p-2 rounded-full">
              <UserPlus className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-white/60">Following</p>
              <p className="text-2xl font-bold text-white">{stats.following}</p>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-purple-500/20 p-2 rounded-full">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-white/60">Followers</p>
              <p className="text-2xl font-bold text-white">{stats.followers}</p>
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-emerald-500/20 p-2 rounded-full">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-white/60">Total Migrés</p>
              <p className="text-2xl font-bold text-white">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center pt-6 border-t border-white/10">
          <p className="text-sm text-white/60 mb-4">
            Partagez votre migration avec votre communauté
          </p>
          <PartageButton onShare={onShare} />
        </div>

        {showRedirectMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-white/60 text-center mt-4"
          >
            Redirection vers le tableau de bord...
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
'use client';

import { signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function MastodonLogin() {
  const [isLoading, setIsLoading] = useState(false);

  const handleMastodonLogin = async () => {
    setIsLoading(true);
    try {
      await signIn('mastodon', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Erreur de connexion Mastodon:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.button
        onClick={handleMastodonLogin}
        disabled={isLoading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 
                 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl
                 hover:from-purple-600 hover:to-indigo-600 
                 transition-all duration-300 shadow-lg hover:shadow-purple-500/20
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin" />
            <span>Redirection vers Mastodon...</span>
          </div>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 216.4144 232.00976">
              <path fill="currentColor" d="M211.80734 139.0875c-3.18125 16.36625-28.4925 34.2775-57.5625 37.74875-15.15875 1.80875-30.08375 3.47125-45.99875 2.74125-26.0275-1.1925-46.565-6.2125-46.565-6.2125 0 2.53375.15625 4.94625.46875 7.2025 3.38375 25.68625 25.47 27.225 46.39125 27.9425 21.11625.7225 39.91875-5.20625 39.91875-5.20625l.8675 19.09s-14.77 7.93125-41.08125 9.39c-14.50875.7975-32.52375-.365-53.50625-5.91875C9.23234 213.82 1.40609 165.31125.20859 116.09125c-.365-14.61375-.14-28.39375-.14-39.91875 0-50.33 32.97625-65.0825 32.97625-65.0825C49.67234 3.45375 78.20359.2425 107.86484 0h.72875c29.66125.2425 58.21125 3.45375 74.8375 11.09 0 0 32.975 14.7525 32.975 65.0825 0 0 .41375 37.13375-4.59875 62.915"/>
            </svg>
            Continuer avec Mastodon
          </>
        )}
      </motion.button>
    </motion.div>
  );
}
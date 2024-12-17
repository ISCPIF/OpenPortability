'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BskyAgent } from '@atproto/api';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { SiBluesky } from "react-icons/si";

interface BlueSkyLoginProps {
  onLoginComplete?: (agent: BskyAgent) => void;
}

export default function BlueSkyLogin({ onLoginComplete }: BlueSkyLoginProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const clearSensitiveData = useCallback(() => {
    if (passwordRef.current) {
      passwordRef.current.value = '';
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const identifier = identifierRef.current?.value;
      const password = passwordRef.current?.value;

      if (!identifier || !password) {
        throw new Error('Veuillez remplir tous les champs');
      }

      const response = await fetch('/api/auth/bluesky', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await response.json();

      console.log("Response from /api/auth/bluesky:", data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      if (onLoginComplete) {
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        await agent.login({ identifier, password });
        onLoginComplete(agent);
      }

      clearSensitiveData();
      
      // Mettre à jour la session NextAuth
      await signIn('credentials', {
        redirect: false,
        identifier: data.user.bluesky_handle,
        id: data.user.id
      });
      
      router.refresh();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      clearSensitiveData();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full"
    >
      <div className="flex flex-col items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <SiBluesky className="w-10 h-10 text-sky-400" />
          <h2 className={`${plex.className} text-2xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 text-transparent bg-clip-text`}>
            Connectez-vous à BlueSky
          </h2>
          <button
            type="button"
            className="relative group"
            aria-label="Informations sur la connexion"
          >
            <div className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-500 text-gray-400 hover:text-sky-400 hover:border-sky-400">
              ?
            </div>
            <div className="invisible group-hover:visible absolute z-10 w-72 p-4 bg-gray-800 rounded-lg shadow-lg -right-2 mt-2 text-sm text-gray-300">
              <p className="mb-2">Nous ne stockons jamais votre mot de passe. Nous utilisons uniquement les tokens d'authentification sécurisés fournis par BlueSky.</p>
              <p>
                Pas encore de compte BlueSky ?{' '}
                <a
                  href="https://bsky.app/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300"
                >
                  Créez-en un ici
                </a>
              </p>
            </div>
          </button>
        </div>

        <p className={`${plex.className} text-gray-300 text-center max-w-md text-sm`}>
          Connectez votre compte BlueSky pour synchroniser vos données et profiter d'une expérience complète.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="identifier" className={`${plex.className} block text-sm font-medium text-gray-200 mb-1`}>
              Identifiant BlueSky
            </label>
            <input
              ref={identifierRef}
              type="text"
              id="identifier"
              placeholder="vous@handle.bsky.social"
              className={`${plex.className} w-full px-4 py-2 bg-white/10 border border-gray-300/20 rounded-lg 
                         focus:ring-2 focus:ring-sky-400 focus:border-transparent
                         placeholder-gray-400 text-white transition-all duration-200`}
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className={`${plex.className} block text-sm font-medium text-gray-200 mb-1`}>
              Mot de passe d'application
            </label>
            <input
              ref={passwordRef}
              type="password"
              id="password"
              placeholder="••••••••"
              className={`${plex.className} w-full px-4 py-2 bg-white/10 border border-gray-300/20 rounded-lg 
                         focus:ring-2 focus:ring-sky-400 focus:border-transparent
                         placeholder-gray-400 text-white transition-all duration-200`}
              disabled={isLoading}
            />
            <p className={`${plex.className} mt-1 text-xs text-gray-400`}>
              Créez un mot de passe d'application sur 
              <a 
                href="https://bsky.app/settings/app-passwords" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 ml-1"
              >
                bsky.app/settings/app-passwords
              </a>
            </p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-200"
            >
              <AlertCircle className="w-5 h-5" />
              <p className={`${plex.className} text-sm`}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-3 px-4 py-3 
                     bg-gradient-to-r from-sky-400 to-blue-500 rounded-xl 
                     hover:from-sky-500 hover:to-blue-600 
                     transition-all duration-300 shadow-lg hover:shadow-sky-500/20
                     disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <SiBluesky className="w-5 h-5" />
          )}
          Se connecter
        </motion.button>
      </form>
    </motion.div>
  );
}
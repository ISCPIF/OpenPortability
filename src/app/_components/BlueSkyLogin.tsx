'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BskyAgent } from '@atproto/api';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { SiBluesky } from "react-icons/si";
import { useTranslations, useLocale } from 'next-intl';

interface BlueSkyLoginProps {
  onLoginComplete?: (agent: BskyAgent) => void;
}

export default function BlueSkyLogin({ onLoginComplete }: BlueSkyLoginProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('blueskyLogin');

  const locale = useLocale();

  
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
      let identifier = identifierRef.current?.value.trim();
      if (identifier?.[0] === "@") {
        identifier = identifier.slice(1);
      }
      const password = passwordRef.current?.value;

      if (!identifier || !password) {
        throw new Error(t('form.errors.missingFields'));
      }

      // First authenticate with Bluesky
      const response = await fetch('/api/auth/bluesky', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error);
        return;
      }
      
      const result = await signIn('bluesky', {
        ...data.user,
        redirect: false
      });
      
      console.log('SignIn result:', result);

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.ok) {
        console.log('Redirecting to dashboard...');
        router.push(`/${locale}/dashboard`);
      } else {
        console.log('Sign in failed:', result);
      }

    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : t('form.errors.default'));
    } finally {
      setIsLoading(false);
      clearSensitiveData();
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" }
    },
    exit: { 
      opacity: 0,
      y: -20,
      transition: { duration: 0.3 }
    }
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } },
    blur: { scale: 1, transition: { duration: 0.2 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full max-w-md mx-auto backdrop-blur-lg bg-white p-8 rounded-2xl shadow-xl"
    >
      <div className="flex flex-col items-center gap-6 mb-8">
          <h2 className={`${plex.className} text-xl font-bold bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 text-transparent bg-clip-text`}>
            {t('title')}
          </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="identifier" className={`${plex.className} block text-sm font-medium text-gray-500 mb-2`}>
              {t('form.identifier.label')}
            </label>
              <input
                ref={identifierRef}
                type="text"
                id="identifier"
                placeholder={t('form.identifier.placeholder')}
                className={`${plex.className} w-full pl-11 pr-4 py-3 bg-white/10 border-2 border-gray-300/20 rounded-xl
                           focus:ring-2 focus:ring-sky-400 focus:border-transparent
                           placeholder-gray-400 text-black transition-all duration-200`}
                disabled={isLoading}
              />
            {/* </motion.div> */}
          </div>
          
          <div>
            <label htmlFor="password" className={`${plex.className} block text-sm font-medium text-gray-600 mb-2`}>
              {t('form.password.label')}
            </label>
            <motion.div 
              className="relative"
              variants={inputVariants}
              whileFocus="focus"
              initial="blur"
            >
              <input
                ref={passwordRef}
                type="password"
                id="password"
                placeholder={t('form.password.placeholder')}
                className={`${plex.className} w-full pl-11 pr-4 py-3 bg-white/10 border-2 border-gray-300/20 rounded-xl
                           focus:ring-2 focus:ring-sky-400 focus:border-transparent
                           placeholder-gray-400 text-black transition-all duration-200`}
                disabled={isLoading}
              />
            </motion.div>
            <p className={`${plex.className} mt-2 text-xs text-gray-400`}>
              {t('form.password.help')}{' '}
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
          {t('form.submit')}
        </motion.button>
      </form>
    </motion.div>
  );
}

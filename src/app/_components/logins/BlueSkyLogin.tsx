'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BskyAgent } from '@atproto/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, AtSign, ArrowRight } from 'lucide-react';
import { quantico } from '@/app/fonts/plex';
import { SiBluesky } from "react-icons/si";
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from '@/hooks/useTheme';

interface BlueSkyLoginProps {
  onLoginComplete?: (agent: BskyAgent) => void;
  userId?: string; // Pass userId for account linking
}

export default function BlueSkyLogin({ onLoginComplete, userId }: BlueSkyLoginProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const t = useTranslations('blueskyLogin');
  const locale = useLocale();
  const { isDark } = useTheme();

  const identifierRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let identifier = identifierRef.current?.value.trim();
      if (identifier?.[0] === "@") {
        identifier = identifier.slice(1);
      }

      if (!identifier) {
        throw new Error(t('form.errors.missingFields'));
      }

      // Encode state with pathname and userId for account linking
      const stateData = {
        redirect: window.location.pathname,
        userId: userId || undefined
      };
      const state = btoa(JSON.stringify(stateData));
      const url = `/api/auth/bluesky/oauth?handle=${encodeURIComponent(identifier)}&state=${encodeURIComponent(state)}`;
      window.location.href = url;

    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.errors.default'));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = isDark
    ? 'bg-white/5 border-white/20 text-white placeholder-white/40 focus:border-sky-400'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-lg shadow-sky-500/25">
          <SiBluesky className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className={`${quantico.className} text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('title')}
          </h3>
          <p className={`text-xs ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
            Enter your handle to authenticate
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input */}
        <div className="space-y-2">
          <label htmlFor="identifier" className={`${quantico.className} block text-xs font-medium uppercase tracking-wider ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
            {t('form.identifier.label')}
          </label>
          <div className="relative">
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              <AtSign className="h-4 w-4" />
            </div>
            <input
              ref={identifierRef}
              type="text"
              id="identifier"
              placeholder={t('form.identifier.placeholder')}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={`${quantico.className} w-full pl-11 pr-4 py-3 rounded-xl border-2 transition-all duration-200 outline-none ${inputClasses}`}
              disabled={isLoading}
            />
            {isFocused && (
              <motion.div
                layoutId="focus-ring"
                className="absolute inset-0 rounded-xl border-2 border-sky-400 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}
            >
              <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
              <p className={`${quantico.className} text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button
          type="submit"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          disabled={isLoading}
          className={`${quantico.className} w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>{t('form.submit')}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
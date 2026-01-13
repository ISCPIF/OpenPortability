'use client';

import { useState, ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { isValidEmail } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from './ModalShell';
import { Button } from '../ui/Button';

interface NewsletterRequestProps {
  userId: string;
  isOpen: boolean;
  onSubscribe?: () => void;
  onClose: () => void;
}

export default function NewsletterRequest({ userId, isOpen, onSubscribe, onClose }: NewsletterRequestProps) {
  const t = useTranslations('dashboard.newsletter');
  const { isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async () => {
    if (!email || !isValidEmail(email)) {
      setError(t('errors.invalidEmail'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/newsletter/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email,
          type: 'email_newsletter',
          value: true
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error && typeof data.error === 'object') {
          throw new Error(data.error.details || 'Failed to update newsletter preferences');
        }
        throw new Error(data.error || 'Failed to update newsletter preferences');
      }

      onSubscribe?.();
      onClose();
    } catch (error) {
      console.error('Error updating newsletter preferences:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      theme={isDark ? 'dark' : 'light'}
      size="md"
      ariaLabel={t('title')}
    >
      <ModalHeader className="text-center">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
          isDark ? 'bg-rose-500/20' : 'bg-rose-100'
        }`}>
          <Mail className={`h-6 w-6 ${isDark ? 'text-rose-400' : 'text-rose-500'}`} />
        </div>
        <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('title')}
        </h2>
        <p className={`mt-2 text-sm ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
          {t('description')}
        </p>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
              {t('emailLabel')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${
                isDark ? 'text-white/40' : 'text-slate-400'
              }`} />
              <input
                type="email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                  isDark
                    ? 'border border-white/20 bg-slate-900 text-white placeholder:text-white/40'
                    : 'border border-slate-200 bg-white text-slate-800 placeholder:text-slate-500'
                }`}
              />
            </div>
          </div>

          {error && (
            <div className={`text-sm p-3 rounded-lg ${
              isDark ? 'text-rose-300 bg-rose-500/20' : 'text-rose-600 bg-rose-50'
            }`}>
              {error}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter className="flex-col sm:flex-row sm:justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            isDark
              ? 'text-white/70 hover:text-white hover:bg-white/10'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          {t('cancel')}
        </button>
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`px-6 py-2 text-sm font-semibold rounded-lg transition disabled:opacity-50 ${
            isDark
              ? 'bg-rose-500 hover:bg-rose-600 text-white'
              : 'bg-rose-500 hover:bg-rose-600 text-white'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {t('saving')}
            </span>
          ) : (
            t('save')
          )}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}

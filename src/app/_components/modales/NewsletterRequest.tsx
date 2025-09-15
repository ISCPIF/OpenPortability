'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { plex } from '@/app/fonts/plex';
import { isValidEmail } from '@/lib/utils';

interface NewsletterRequestProps {
  userId: string;
  onSubscribe?: () => void;
  onClose?: () => void;
}

export default function NewsletterRequest({ userId, onSubscribe, onClose }: NewsletterRequestProps) {
  const t = useTranslations('dashboard.newsletter');
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
        // Si l'erreur a une structure détaillée
        if (data.error && typeof data.error === 'object') {
          throw new Error(data.error.details || 'Failed to update newsletter preferences');
        }
        throw new Error(data.error || 'Failed to update newsletter preferences');
      }

      onSubscribe?.();
      onClose?.();
    } catch (error) {
      console.error('Error updating newsletter preferences:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Overlay avec backdrop blur */}
      <div 
        className="fixed inset-0 bg-[#2a39a9]/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div 
          className="bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-6">
            <div>
              <h2 className={`${plex.className} text-xl font-semibold text-gray-900`}>
                {t('title')}
              </h2>
              <p className={`${plex.className} mt-2 text-sm text-gray-600`}>
                {t('description')}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`${plex.className} block text-sm font-medium text-gray-900 mb-1`}>
                  {t('emailLabel')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d6356f] focus:border-transparent placeholder:text-gray-500"
                  />
                </div>
              </div>

              {error && (
                <div className={`${plex.className} text-red-600 text-sm p-3 bg-red-50 rounded-lg`}>
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className={`${plex.className} px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
              >
                {t('cancel')}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={isLoading}
                className={`${plex.className} px-4 py-2 text-sm font-medium text-white bg-[#d6356f] rounded-lg hover:bg-[#b02c5c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d6356f] ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? t('saving') : t('save')}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { validateSupportFormClient, type SupportFormData } from '@/lib/security-utils';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const t = useTranslations('support');
  const [formData, setFormData] = useState<SupportFormData>({
    subject: '',
    message: '',
    email: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validation en temps réel
  const validateForm = () => {
    const validation = validateSupportFormClient(formData);
    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  const handleInputChange = (field: keyof SupportFormData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Validation en temps réel pour une meilleure UX
    const validation = validateSupportFormClient(newFormData);
    setValidationErrors(validation.errors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    // Validation finale côté client
    if (!validateForm()) {
      setIsSubmitting(false);
      return;
    }
    
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Gestion des erreurs de sécurité
        if (response.status === 400 && result.error?.includes('validation')) {
          throw new Error('Your message contains content that cannot be processed. Please review and try again.');
        }
        throw new Error(result.error || t('modal.error.send'));
      }

      // Succès - fermer la modale et réinitialiser
      onClose();
      setFormData({ subject: '', message: '', email: '' });
      setValidationErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modal.error.unknown'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full mx-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('modal.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {t('modal.description')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('modal.form.email.label')}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder={t('modal.form.email.placeholder')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validationErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('modal.form.subject.label')}
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder={t('modal.form.subject.placeholder')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validationErrors.subject ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={200}
              required
            />
            {validationErrors.subject && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.subject}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.subject.length}/200 characters
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('modal.form.message.label')}
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              placeholder={t('modal.form.message.placeholder')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[120px] ${
                validationErrors.message ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={2000}
              required
            />
            {validationErrors.message && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.message.length}/2000 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || Object.keys(validationErrors).length > 0}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t('modal.form.submitting') : t('modal.form.submit')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Mail, MessageSquare, AlertCircle, CheckCircle, Anchor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { validateSupportFormClient, type SupportFormData } from '@/lib/security-utils';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const t = useTranslations('support');
  const [formData, setFormData] = useState<SupportFormData>({
    message: '',
    email: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

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

      // Succès - afficher le message de succès
      setSuccess(true);
      setFormData({ subject: '', message: '', email: '' });
      setValidationErrors({});
      
      // Auto-fermeture après succès
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modal.error.unknown'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fond avec le style OpenPortability */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm">
        {/* Vagues animées en arrière-plan */}
        <div className="absolute bottom-0 left-0 w-full h-32 opacity-20">
          <svg viewBox="0 0 1200 120" className="w-full h-full">
            <path d="M0,60 C300,120 600,0 1200,60 L1200,120 L0,120 Z" fill="rgba(255,255,255,0.1)">
              <animate attributeName="d" dur="4s" repeatCount="indefinite" 
                values="M0,60 C300,120 600,0 1200,60 L1200,120 L0,120 Z;
                        M0,60 C300,0 600,120 1200,60 L1200,120 L0,120 Z;
                        M0,60 C300,120 600,0 1200,60 L1200,120 L0,120 Z"/>
            </path>
          </svg>
        </div>
        
        {/* Particules flottantes */}
        <div className="absolute top-20 left-1/4 w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-1/3 w-1 h-1 bg-cyan-300 rounded-full animate-bounce"></div>
        <div className="absolute bottom-40 left-1/5 w-1.5 h-1.5 bg-pink-300 rounded-full animate-pulse"></div>
      </div>

      {/* Modale avec animation Framer Motion */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border border-white/20"
      >
        
        {/* Header avec le style OpenPortability */}
        <div className="relative p-8 text-center">
          {/* Logo/Icône stylisé */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-red-500 rounded-full flex items-center justify-center">
                <Anchor className="w-8 h-8 text-white" />
              </div>
              {/* Effet de mouvement */}
              <div className="absolute -top-2 -right-2 w-6 h-6">
                <div className="w-full h-full border-2 border-pink-500 rounded-full animate-ping"></div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('modal.title')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                {t('modal.description')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="px-8 pb-8">
          {success ? (
            /* État de succès */
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Message sent successfully!
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                We'll get back to you soon to help with your journey.
              </p>
            </motion.div>
          ) : (
            /* Formulaire */
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-3 p-4 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('modal.form.email.label')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder={t('modal.form.email.placeholder')}
                    className={`w-full pl-12 pr-4 py-4 border-2 rounded-2xl focus:ring-2 focus:ring-[#4338ca] focus:border-transparent transition-all duration-200 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder-gray-400 ${
                      validationErrors.email ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    required
                  />
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                {validationErrors.email && (
                  <p className="text-sm text-red-500 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{validationErrors.email}</span>
                  </p>
                )}
              </div>

             
              
              {/* Message */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('modal.form.message.label')}
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  placeholder={t('modal.form.message.placeholder')}
                  rows={4}
                  className={`w-full px-4 py-4 border-2 rounded-2xl focus:ring-2 focus:ring-[#4338ca] focus:border-transparent transition-all duration-200 dark:bg-gray-800 dark:border-gray-600 dark:text-white placeholder-gray-400 resize-none min-h-[120px] ${
                    validationErrors.message ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  maxLength={2000}
                  required
                />
                <div className="flex justify-between items-center">
                  {validationErrors.message && (
                    <p className="text-sm text-red-500 flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{validationErrors.message}</span>
                    </p>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">
                    {formData.message.length}/2000 characters
                  </span>
                </div>
              </div>

              {/* Bouton dans le style OpenPortability */}
              <button
                type="submit"
                disabled={isSubmitting || Object.keys(validationErrors).length > 0}
                className="w-full bg-[#4338ca] hover:bg-[#3730a3] text-white font-medium py-4 px-6 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>{t('modal.form.submitting')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>{t('modal.form.submit')}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
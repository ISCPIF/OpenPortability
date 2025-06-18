'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Mail, MessageSquare, AlertCircle, CheckCircle, Anchor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { validateSupportFormClient, type SupportFormData } from '@/lib/security-utils';
import { plex } from '@/app/fonts/plex';

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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const validateForm = () => {
    const validation = validateSupportFormClient(formData);
    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  const handleInputChange = (field: keyof SupportFormData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    if (attemptedSubmit) {
      const validation = validateSupportFormClient(newFormData);
      setValidationErrors(validation.errors);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setAttemptedSubmit(true);
    
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
        if (response.status === 400 && result.error?.includes('validation')) {
          throw new Error('Your message contains content that cannot be processed. Please review and try again.');
        }
        throw new Error(result.error || t('modal.error.send'));
      }

      setSuccess(true);
      setFormData({ subject: '', message: '', email: '' });
      setValidationErrors({});
      
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm">
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border border-white/20"
      >
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-50"
        >
          <X className="w-5 h-5 text-gray-800" />
        </button>

        <div className="px-8 pb-8">
          {success ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className={`${plex.className} text-xl font-semibold text-gray-900 mb-2`}>
              {t('modal.success')}
              </h3>
              <p className={`${plex.className} text-gray-900`}>
              {t('modal.success2')}
              </p>
            </motion.div>
          ) : (
            <>
                <div className="relative p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-16 h-16 bg-[#2a39a9] rounded-full flex items-center justify-center">
                        <Anchor className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

              <div className="mb-6">
                <h2 className={`${plex.className} text-2xl font-bold text-gray-900 mb-2`}>
                  {t('modal.title')}
                </h2>
                <p className={`${plex.className} text-gray-900 text-sm leading-relaxed`}>
                  {t('modal.description')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-3 p-4 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className={`${plex.className} text-sm `}>{error}</span>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className={`${plex.className} block text-sm font-medium text-gray-900`}>
                    {t('modal.form.email.label')}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder={t('modal.form.email.placeholder')}
                      className={`${plex.className} w-full pl-12 pr-4 py-4 border-2 rounded-2xl focus:ring-2 focus:ring-[#4338ca] focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                        attemptedSubmit && validationErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-900'
                      }`}
                      required
                    />
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-900" />
                  </div>
                  {attemptedSubmit && validationErrors.email && (
                    <p className={`${plex.className} text-sm text-red-500 flex items-center space-x-1`}>
                      <AlertCircle className="w-4 h-4" />
                      <span>{validationErrors.email}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className={`${plex.className} block text-sm font-medium text-gray-900`}>
                    {t('modal.form.message.label')}
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    placeholder={t('modal.form.message.placeholder')}
                    rows={4}
                    className={`${plex.className} w-full px-4 py-4 border-2 rounded-2xl focus:ring-2 focus:ring-[#4338ca] focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 resize-none min-h-[120px] ${
                      attemptedSubmit && validationErrors.message ? 'border-red-300 bg-red-50' : 'border-gray-900'
                    }`}
                    maxLength={2000}
                    required
                  />
                  <div className="flex justify-between items-center">
                    {attemptedSubmit && validationErrors.message && (
                      <p className={`${plex.className} text-sm text-red-500 flex items-center space-x-1`}>
                        <AlertCircle className="w-4 h-4" />
                        <span>{validationErrors.message}</span>
                      </p>
                    )}
                    <span className={`${plex.className} text-xs text-gray-900 ml-auto`}>
                      {formData.message.length}/2000
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || (attemptedSubmit && Object.keys(validationErrors).length > 0)}
                  className={`${plex.className} w-full bg-[#d6356f] text-white font-medium py-4 px-6 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed  flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      {/* {t('modal.form.sending')} */}
                      {/* <Send className="w-5 h-5" /> */}
                    </>
                  ) : (
                    <>
                      {/* <Send className="w-5 h-5" /> */}
                      {t('modal.form.submit')} 
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
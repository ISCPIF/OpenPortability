'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Mail, MessageSquare, AlertCircle, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { validateSupportFormClient, type SupportFormData } from '@/lib/security-utils';
import { cn } from '../ui/utils';
import { quantico } from '@/app/fonts/plex';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const t = useTranslations('support');
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState<SupportFormData>({
    message: '',
    email: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      setFormData({ message: '', email: '' });
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

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className={cn(
              quantico.className,
              'relative w-full max-w-lg bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-xl overflow-hidden'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-800 transition-colors z-10"
            >
              <X className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>

            {success ? (
              <div className="px-6 py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t('modal.success')}
                </h3>
                <p className="text-[13px] text-slate-400">
                  {t('modal.success2')}
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-700/50 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <HelpCircle className="w-6 h-6 text-blue-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-white tracking-wide">
                    {t('modal.title')}
                  </h2>
                  <p className="mt-2 text-[12px] text-slate-400">
                    {t('modal.description')}
                  </p>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/20 border border-rose-500/30 text-[12px] text-rose-300"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    {/* Email field */}
                    <div className="space-y-2">
                      <label className="block text-[12px] font-medium text-slate-300">
                        {t('modal.form.email.label')} <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
                          placeholder={t('modal.form.email.placeholder')}
                          className={cn(
                            'w-full pl-10 pr-4 py-2.5 rounded-lg text-[13px] bg-slate-800/50 border border-slate-700/30 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all',
                            attemptedSubmit && validationErrors.email && 'border-rose-500/50 bg-rose-500/10'
                          )}
                          required
                        />
                      </div>
                      {attemptedSubmit && validationErrors.email && (
                        <p className="text-[11px] text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>{validationErrors.email}</span>
                        </p>
                      )}
                    </div>

                    {/* Message field */}
                    <div className="space-y-2">
                      <label className="block text-[12px] font-medium text-slate-300">
                        {t('modal.form.message.label')} <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <textarea
                          value={formData.message}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleInputChange('message', e.target.value)}
                          placeholder={t('modal.form.message.placeholder')}
                          rows={4}
                          className={cn(
                            'w-full pl-10 pr-4 py-2.5 rounded-lg text-[13px] bg-slate-800/50 border border-slate-700/30 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 resize-none transition-all',
                            attemptedSubmit && validationErrors.message && 'border-rose-500/50 bg-rose-500/10'
                          )}
                          maxLength={2000}
                          required
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        {attemptedSubmit && validationErrors.message && (
                          <p className="text-[11px] text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{validationErrors.message}</span>
                          </p>
                        )}
                        <span className="text-[10px] text-slate-500 ml-auto">
                          {formData.message.length}/2000
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-700/50">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-[12px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                      >
                        {t('modal.form.cancel') || 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || (attemptedSubmit && Object.keys(validationErrors).length > 0)}
                        className="px-6 py-2.5 text-[13px] font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          </span>
                        ) : (
                          t('modal.form.submit')
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
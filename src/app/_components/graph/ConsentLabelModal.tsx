'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Eye,
  EyeOff,
  Globe,
  Check,
  Loader2,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useGraphDataOptional } from '@/contexts/GraphDataContext';

type ConsentLevel = 'no_consent' | 'only_to_followers_of_followers' | 'all_consent';

interface ConsentLabelModalProps {
  onDismiss: () => void;
  onConsentSaved?: (level: ConsentLevel) => void;
  currentConsent?: ConsentLevel | null;
}

export function ConsentLabelModal({ onDismiss, onConsentSaved, currentConsent }: ConsentLabelModalProps) {
  const t = useTranslations('consentLabelModal');
  const { isDark } = useTheme();
  const graphData = useGraphDataOptional();
  const [selectedLevel, setSelectedLevel] = useState<ConsentLevel>(currentConsent || 'no_consent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consentOptions: { level: ConsentLevel; icon: typeof Eye; titleKey: string; descriptionKey: string }[] = [
    {
      level: 'no_consent',
      icon: EyeOff,
      titleKey: 'options.noConsent.title',
      descriptionKey: 'options.noConsent.description',
    },
    {
      level: 'all_consent',
      icon: Globe,
      titleKey: 'options.allConsent.title',
      descriptionKey: 'options.allConsent.description',
    },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/graph/consent_labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_level: selectedLevel }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update consent');
      }

      const data = await response.json();
      
      if (data.success) {
        // Invalidate labels cache and refetch
        if (graphData?.invalidateLabelsCache) {
          await graphData.invalidateLabelsCache();
          // Refetch labels with new consent
          graphData.fetchPersonalLabels?.();
        }
        onConsentSaved?.(selectedLevel);
        onDismiss();
      } else {
        throw new Error(data.error || 'Failed to update consent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100]">
        {/* Dark overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60"
          onClick={onDismiss}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[90vw] rounded-lg shadow-xl overflow-hidden ${
            isDark 
              ? 'bg-slate-900 border border-slate-700' 
              : 'bg-white border border-slate-200'
          }`}
        >
          {/* Close button */}
          <button
            onClick={onDismiss}
            className={`absolute top-3 right-3 p-1.5 transition-colors rounded ${
              isDark 
                ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-1">
              <Eye className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('title')}
              </h2>
            </div>
            
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('description')}
            </p>

            {/* Consent options */}
            <div className="space-y-2 mb-5">
              {consentOptions.map((option) => {
                const IconComponent = option.icon;
                const isSelected = selectedLevel === option.level;
                
                return (
                  <button
                    key={option.level}
                    onClick={() => setSelectedLevel(option.level)}
                    className={`w-full p-3 rounded-lg border transition-colors text-left ${
                      isSelected
                        ? isDark
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-blue-500 bg-blue-50'
                        : isDark
                          ? 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                        isDark ? 'bg-slate-700' : 'bg-slate-100'
                      }`}>
                        <IconComponent className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {t(option.titleKey)}
                          </h3>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {t(option.descriptionKey)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark
                    ? 'bg-white text-slate-900 hover:bg-slate-100'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {t('save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ArrowRight,
  Compass,
  Network,
  UserCheck,
  Sparkles,
  Lasso,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface IntroOverlayProps {
  onDismiss: () => void;
  onStepChange?: (step: number) => void;
  initialStep?: number;
  hintMode?: boolean; // If true, only show current step and dismiss on click anywhere
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function IntroOverlay({ onDismiss, onStepChange, initialStep = 0, hintMode = false }: IntroOverlayProps) {
  const t = useTranslations('introOverlay');
  const { isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  
  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  // Define steps with their target selectors
  const steps = [
    {
      icon: Compass,
      titleKey: 'step1.title',
      descriptionKey: 'step1.description',
      controlsKey: 'step1.controls',
      color: 'from-blue-500 to-cyan-500',
      selector: '[data-intro="graph-canvas"]', // The main graph area
      position: 'center' as const,
    },
    {
      icon: Network,
      titleKey: 'step2.title',
      descriptionKey: 'step2.description',
      controlsKey: null,
      color: 'from-purple-500 to-pink-500',
      selector: '[data-intro="view-modes"]', // View mode buttons
      position: 'bottom' as const,
    },
    {
      icon: Lasso,
      titleKey: 'step3.title',
      descriptionKey: 'step3.description',
      controlsKey: 'step3.controls',
      color: 'from-amber-500 to-orange-500',
      selector: '[data-intro="lasso-panel"]', // Lasso selection panel
      position: 'left' as const,
    },
    {
      icon: UserCheck,
      titleKey: 'step4.title',
      descriptionKey: 'step4.description',
      controlsKey: null,
      color: 'from-emerald-500 to-teal-500',
      selector: '[data-intro="accounts-panel"]', // Accounts panel
      position: 'left' as const,
    },
  ];

  // Find and highlight the target element
  const updateHighlight = useCallback(() => {
    const currentSelector = steps[currentStep]?.selector;
    if (!currentSelector) {
      setHighlightRect(null);
      return;
    }

    const element = document.querySelector(currentSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8;
      setHighlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    updateHighlight();
    // Update on resize
    window.addEventListener('resize', updateHighlight);
    return () => window.removeEventListener('resize', updateHighlight);
  }, [updateHighlight]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onDismiss();
    }
  };

  const handleSkip = () => {
    onDismiss();
  };

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData.icon;

  // Calculate card position based on highlight and step position preference
  const getCardStyle = () => {
    if (!highlightRect) {
      return { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const cardWidth = 400;
    const cardHeight = 320;
    const margin = 24;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferLeft = currentStepData.position === 'left';

    let top = highlightRect.top;
    let left: number;

    if (preferLeft) {
      // For right-side panels (lasso, accounts), position card to the left
      left = highlightRect.left - cardWidth - margin;
    } else {
      // Default: position to the right
      left = highlightRect.left + highlightRect.width + margin;
    }

    // If card would go off right edge, position to the left
    if (left + cardWidth > viewportWidth - margin) {
      left = highlightRect.left - cardWidth - margin;
    }

    // If card would go off left edge, center it below
    if (left < margin) {
      left = Math.max(margin, (viewportWidth - cardWidth) / 2);
      top = highlightRect.top + highlightRect.height + margin;
    }

    // If card would go off bottom, position above
    if (top + cardHeight > viewportHeight - margin) {
      top = Math.max(margin, highlightRect.top - cardHeight - margin);
    }

    // Ensure minimum top
    top = Math.max(margin, top);

    return { position: 'fixed' as const, top, left };
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100]"
        onClick={hintMode ? onDismiss : undefined}
      >
        {/* Dark overlay with cutout for highlighted element */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`absolute inset-0 ${hintMode ? 'cursor-pointer' : ''}`}
          style={{
            background: hintMode
              // Hint mode: Diagonal light beam from top-right to bottom-left
              ? `linear-gradient(225deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.75) 35%, transparent 48%, transparent 52%, rgba(0,0,0,0.75) 65%, rgba(0,0,0,0.6) 100%)`
              : currentStep === 0
                // Step 1: Large circular spotlight in center of screen for graph
                ? `radial-gradient(circle at 50% 50%, transparent 20%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.9) 60%)`
                : (currentStep === 2 || currentStep === 3) && highlightRect
                  // Steps 3 & 4: Diagonal light beam from top-right to bottom-left toward the panel
                  ? `linear-gradient(225deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 40%, transparent 50%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.9) 100%)`
                  : highlightRect
                    ? `radial-gradient(ellipse at ${highlightRect.left + highlightRect.width / 2}px ${highlightRect.top + highlightRect.height / 2}px, transparent ${Math.max(highlightRect.width, highlightRect.height) / 2}px, rgba(0,0,0,0.85) ${Math.max(highlightRect.width, highlightRect.height)}px)`
                    : 'rgba(0,0,0,0.85)',
          }}
        />

        {/* Arrow at top-right of diagonal pointing down toward lasso panel - only in hint mode */}
        {hintMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="absolute pointer-events-none"
            style={{
              top: '84%',
              right: '11%',
            }}
          >
            {/* Arrow pointing down */}
            <div className="relative flex flex-col items-center">
              {/* Vertical line */}
              <div 
                className="w-1 h-16 bg-amber-400"
                style={{
                  boxShadow: '0 0 15px rgba(245, 158, 11, 0.6)',
                }}
              />
              {/* Arrow head pointing down */}
              <div 
                className="w-0 h-0 -mt-1"
                style={{
                  borderLeft: '12px solid transparent',
                  borderRight: '12px solid transparent',
                  borderTop: '16px solid #f59e0b',
                  filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.6))',
                }}
              />
              {/* Animated glow */}
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 flex flex-col items-center"
                style={{ filter: 'blur(6px)' }}
              >
                <div className="w-1 h-16 bg-amber-300" />
                <div 
                  className="w-0 h-0 -mt-1"
                  style={{
                    borderLeft: '12px solid transparent',
                    borderRight: '12px solid transparent',
                    borderTop: '16px solid #fcd34d',
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Highlight border around target element - hide in hint mode */}
        {highlightRect && !hintMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute pointer-events-none"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
              borderRadius: '12px',
              boxShadow: `0 0 0 4px ${currentStep === 0 ? '#3b82f6' : currentStep === 1 ? '#a855f7' : currentStep === 2 ? '#f59e0b' : '#10b981'}, 0 0 30px 10px ${currentStep === 0 ? 'rgba(59,130,246,0.3)' : currentStep === 1 ? 'rgba(168,85,247,0.3)' : currentStep === 2 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
            }}
          />
        )}

        {/* Arrow pointing to lasso tool on step 3 (lasso panel) - hide in hint mode */}
        {currentStep === 2 && !hintMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="absolute pointer-events-none"
            style={{
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(45deg)',
            }}
          >
            {/* Arrow shape pointing bottom-left */}
            <div className="relative">
              <div 
                className="w-16 h-16 border-b-4 border-l-4 border-amber-400"
                style={{
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
                }}
              />
              {/* Animated pulse */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 w-16 h-16 border-b-4 border-l-4 border-amber-300"
                style={{ filter: 'blur(4px)' }}
              />
            </div>
          </motion.div>
        )}

        {/* Close button */}
        <button
          onClick={handleSkip}
          className={`absolute top-4 right-4 z-10 p-2 transition-colors rounded-full ${
            isDark 
              ? 'text-white/60 hover:text-white bg-black/50' 
              : 'text-slate-600 hover:text-slate-900 bg-white/80'
          }`}
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Main card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className={`w-[400px] backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden ${
            isDark 
              ? 'bg-slate-900/95 border border-slate-700/50' 
              : 'bg-white/95 border border-slate-200'
          }`}
          style={getCardStyle()}
        >
          {/* Gradient header */}
          <div className={`h-2 bg-gradient-to-r ${currentStepData.color}`} />

          <div className="p-6">
            {/* Icon + Step indicator row */}
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${currentStepData.color} flex items-center justify-center shadow-lg`}>
                <IconComponent className="w-6 h-6 text-white" />
              </div>
              
              <div className="flex items-center gap-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentStep 
                        ? isDark ? 'w-6 bg-white' : 'w-6 bg-slate-800'
                        : index < currentStep 
                          ? isDark ? 'w-3 bg-white/60' : 'w-3 bg-slate-600'
                          : isDark ? 'w-3 bg-white/20' : 'w-3 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t(currentStepData.titleKey)}
            </h2>
            <p className={`text-sm leading-relaxed mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t(currentStepData.descriptionKey)}
            </p>
            
            {/* Controls hint */}
            {currentStepData.controlsKey && (
              <div className={`rounded-lg px-4 py-3 mb-4 border ${
                isDark 
                  ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/60 border-slate-600/50' 
                  : 'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-200'
              }`}>
                <p className={`text-sm font-medium whitespace-pre-line leading-relaxed ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}>
                  {t(currentStepData.controlsKey)}
                </p>
              </div>
            )}

            {/* Actions */}
            {/* Actions - hide in hint mode */}
            {!hintMode && (
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className={`text-sm transition-colors ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t('skip')}
              </button>

              <button
                onClick={handleNext}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r ${currentStepData.color} text-white font-medium hover:shadow-lg hover:scale-105 transition-all text-sm`}
              >
                {currentStep < steps.length - 1 ? (
                  <>
                    {t('next')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    {t('start')}
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            )}
            
            {/* Hint mode - click anywhere to dismiss */}
            {hintMode && (
              <p className={`text-center text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Click anywhere to dismiss
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

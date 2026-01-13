'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { 
  Upload, 
  ChevronDown, 
  ChevronUp,
  Compass,
  Sparkles,
} from 'lucide-react';

interface FloatingDiscoverPanelProps {
  // When true, removes absolute positioning for use in flex containers (mobile)
  inline?: boolean;
}

/**
 * Panel shown to users without twitter_id and not onboarded.
 * Invites them to upload their archive to unlock the full potential.
 */
export function FloatingDiscoverPanel({ inline = false }: FloatingDiscoverPanelProps) {
  const t = useTranslations('floatingDiscoverPanel');
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div 
      className={`${inline ? '' : 'absolute top-16 left-2 right-2 md:left-6 md:right-auto'} w-auto md:w-80 bg-slate-900/95 backdrop-blur-sm rounded border border-slate-700/50 shadow-xl overflow-hidden transition-all duration-300`}
      style={{ maxHeight: isExpanded ? '450px' : '44px' }}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 border-b border-slate-700/50 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Compass className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
            {t('header')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Main message */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <p className="text-[13px] text-slate-300 leading-relaxed">
              {t('message')}
            </p>
          </div>

          {/* Upload CTA */}
          <Link
            href="/upload"
            className="flex items-center gap-3 py-3 px-4 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 transition-all group"
          >
            <Upload className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
            <div className="flex-1">
              <span className="text-[12px] text-white font-medium block">
                {t('uploadButton')}
              </span>
              <span className="text-[10px] text-slate-400">
                {t('uploadSubtext')}
              </span>
            </div>
          </Link>

          {/* Features list */}
          <div className="space-y-2 pt-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
              {t('featuresTitle')}
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {t('feature1')}
              </li>
              <li className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                {t('feature2')}
              </li>
              <li className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {t('feature3')}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

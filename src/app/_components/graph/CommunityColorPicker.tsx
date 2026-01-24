'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { CRAMERI_PALETTES, MIN_POINT_SIZE, MAX_POINT_SIZE, DEFAULT_POINT_SIZE } from '@/hooks/useCommunityColors';
import { RotateCcw, Palette, ChevronDown, Move, Database } from 'lucide-react';
import { DEFAULT_TILE_CONFIG } from '@/lib/types/graph';

// Type for the hook return value
interface CommunityColorsHook {
  colors: string[];
  palette: string;
  pointSize: number;
  setPalette: (palette: string) => void;
  setColor: (index: number, color: string) => void;
  resetColor: (index: number) => void;
  setPointSize: (size: number) => void;
  resetAll: () => void;
  isCustomized: (index: number) => boolean;
  hasCustomizations: boolean;
  palettes: typeof CRAMERI_PALETTES;
}

interface CommunityColorPickerProps {
  communityLabels: Record<number, string>;
  className?: string;
  colorHook: CommunityColorsHook;
  // Optional: Node limit controls
  currentNodeCount?: number;
  maxMemoryNodes?: number;
  onMaxMemoryNodesChange?: (value: number) => void;
}

type ActiveDropdown = 'palettes' | 'colors' | null;

export function CommunityColorPicker({ 
  communityLabels, 
  className = '', 
  colorHook,
  currentNodeCount,
  maxMemoryNodes,
  onMaxMemoryNodesChange,
}: CommunityColorPickerProps) {
  const t = useTranslations('communityColorPicker');
  const {
    colors,
    palette,
    pointSize,
    setPalette,
    setColor,
    resetColor,
    setPointSize,
    resetAll,
    isCustomized,
    hasCustomizations,
    palettes,
  } = colorHook;

  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const [isMobile, setIsMobile] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render on mobile
  if (isMobile) {
    return null;
  }

  const toggleDropdown = (dropdown: ActiveDropdown) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  return (
    <div ref={containerRef} className={`bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg ${className}`}>
      {/* Horizontal layout: Palette name (with dropdown containing palettes + colors) | Point size */}
      <div className="flex items-center gap-1 p-2">
        
        {/* Section 1: Palette selector (dropdown contains both palettes and community colors) */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('palettes')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              activeDropdown === 'palettes' 
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="font-medium">{palettes[palette]?.name || palette}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'palettes' ? 'rotate-180' : ''}`} />
          </button>

          {/* Combined dropdown: Palettes + Community colors */}
          {activeDropdown === 'palettes' && (
            <div className="absolute bottom-full left-0 mb-2 w-[420px] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-50">
              <div className="flex gap-4">
                {/* Left: Palette selection */}
                <div className="flex-1">
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    {t('palette')}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto modal-scrollbar-light dark:modal-scrollbar-dark">
                    {Object.entries(palettes).map(([key, { name, colors: paletteColors }]) => (
                      <button
                        key={key}
                        onClick={() => setPalette(key)}
                        className={`flex flex-col gap-1 p-1.5 rounded-md border transition-all ${
                          palette === key
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <span className="text-[9px] font-medium text-gray-700 dark:text-gray-300 text-left truncate">
                          {name}
                        </span>
                        <div className="flex gap-0.5">
                          {paletteColors.slice(0, 10).map((color, i) => (
                            <div
                              key={i}
                              className="w-2 h-2.5 rounded-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px bg-gray-200 dark:bg-gray-700" />

                {/* Right: Community colors customization */}
                <div className="w-44">
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    {t('communities')}
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto modal-scrollbar-light dark:modal-scrollbar-dark">
                    {Object.entries(communityLabels).map(([indexStr, label]) => {
                      const index = parseInt(indexStr, 10);
                      const color = colors[index] || '#888888';
                      const customized = isCustomized(index);

                      return (
                        <div key={index} className="flex items-center gap-1.5 group">
                          <div className="relative">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => setColor(index, e.target.value)}
                              className="w-4 h-4 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                              title={t('changeColorOf', { label })}
                            />
                            {customized && (
                              <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-blue-500 rounded-full" />
                            )}
                          </div>
                          <span className="flex-1 text-[10px] text-gray-700 dark:text-gray-300 truncate">
                            {label}
                          </span>
                          {customized && (
                            <button
                              onClick={() => resetColor(index)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                              title={t('resetThisColor')}
                            >
                              <RotateCcw className="w-2 h-2" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hasCustomizations && (
                    <button
                      onClick={resetAll}
                      className="w-full flex items-center justify-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-[9px] text-red-600 dark:text-red-400 hover:text-red-700"
                    >
                      <RotateCcw className="w-2 h-2" />
                      {t('resetAllColors')}
                    </button>
                  )}
                </div>
              </div>

              {onMaxMemoryNodesChange && maxMemoryNodes !== undefined && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    <input
                      type="range"
                      min={50_000}
                      max={660_000}
                      step={10_000}
                      value={maxMemoryNodes}
                      onChange={(e) => onMaxMemoryNodesChange(parseInt(e.target.value, 10))}
                      className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      title={t('maxNodes')}
                    />
                    <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 w-12 text-right">
                      {maxMemoryNodes >= 660_000 ? 'Max' : `${(maxMemoryNodes / 1000).toFixed(0)}k`}
                    </span>
                    {maxMemoryNodes !== DEFAULT_TILE_CONFIG.MAX_MEMORY_NODES && (
                      <button
                        onClick={() => onMaxMemoryNodesChange(DEFAULT_TILE_CONFIG.MAX_MEMORY_NODES)}
                        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title={t('resetMaxNodes')}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  {currentNodeCount !== undefined && (
                    <div className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
                      {(currentNodeCount / 1000).toFixed(0)}k
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

        {/* Section 2: Point size */}
        <div className="flex items-center gap-2 px-2">
          <Move className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <input
            type="range"
            min={MIN_POINT_SIZE}
            max={MAX_POINT_SIZE}
            step={1}
            value={pointSize}
            onChange={(e) => setPointSize(parseInt(e.target.value, 10))}
            className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 w-5">
            {pointSize}px
          </span>
          {pointSize !== DEFAULT_POINT_SIZE && (
            <button
              onClick={() => setPointSize(DEFAULT_POINT_SIZE)}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('resetPointSize')}
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client'

import React from 'react';
import { useTranslations } from 'next-intl';
import { useGraphMode, GraphMode } from './GraphModeProvider';

interface HamburgerMenuProps {
  className?: string;
}

export function HamburgerMenu({ className = '' }: HamburgerMenuProps) {
  const t = useTranslations('graph');
  const { 
    currentMode, 
    setMode, 
    showLabels, 
    toggleLabels, 
    isMenuOpen, 
    toggleMenu, 
    resetZoom 
  } = useGraphMode();

  const modes: { key: GraphMode; label: string; icon: string; color: string }[] = [
    {
      key: 'anonyme',
      label: t('modes.overview') || 'Vue d\'ensemble',
      icon: '🗺️',
      color: 'bg-pink-500'
    },
    {
      key: 'connexions',
      label: t('modes.myConnections') || 'Mes amarres',
      icon: '⚓',
      color: 'bg-green-400'
    },
    {
      key: 'migrations',
      label: t('modes.newPorts') || 'Nouveaux ports',
      icon: '🚢',
      color: 'bg-red-400'
    }
  ];

  const handleModeChange = (mode: GraphMode) => {
    setMode(mode);
    // Fermer le menu sur mobile après sélection
    if (window.innerWidth <= 768) {
      toggleMenu();
    }
  };

  return (
    <div className={`fixed left-4 md:left-8 top-1/2 transform -translate-y-1/2 z-40 ${className}`}>
      <div className="bg-blue-900/95 backdrop-blur-[20px] rounded-2xl p-4 md:p-6 border border-white/20 shadow-2xl transition-all duration-300 ease-out">
        {/* Hamburger Button */}
        <button
          onClick={toggleMenu}
          className="text-white text-2xl cursor-pointer p-4 rounded-xl transition-all duration-200 flex items-center justify-center hover:bg-white/10 w-full"
          aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          <span className="transform transition-transform duration-300">
            {isMenuOpen ? '✕' : '☰'}
          </span>
        </button>

        {/* Menu Content */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          {/* Modes de vue */}
          <div className="pt-4 border-t border-white/10 mt-4">
            <div className="text-white/80 text-sm font-semibold mb-3 uppercase tracking-wider">
              🗺️ {t('viewModes') || 'Modes de vue'}
            </div>
            <div className="flex flex-col gap-2">
              {modes.map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => handleModeChange(mode.key)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left
                    ${currentMode === mode.key 
                      ? 'bg-pink-500 text-white shadow-lg' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                    }
                  `}
                >
                  <span 
                    className={`w-4 h-4 rounded-full flex-shrink-0 ${
                      currentMode === mode.key ? 'bg-white/30' : mode.color
                    }`}
                  ></span>
                  <span className="text-sm font-medium">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contrôles d'affichage */}
          <div className="pt-4 border-t border-white/10 mt-4">
            <div className="text-white/80 text-sm font-semibold mb-3 uppercase tracking-wider">
              ⚙️ {t('display') || 'Affichage'}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={toggleLabels}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-left"
              >
                <span className="text-lg">🏷️</span>
                <span className="text-sm font-medium">
                  {showLabels ? t('hideLabels') || 'Masquer étiquettes' : t('showLabels') || 'Afficher étiquettes'}
                </span>
              </button>
              
              <button
                onClick={resetZoom}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200 text-left"
              >
                <span className="text-lg">🔍</span>
                <span className="text-sm font-medium">
                  {t('recenter') || 'Recentrer'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type GraphMode = 'anonyme' | 'connexions' | 'migrations';

interface GraphModeContextType {
  // Mode de vue actuel
  currentMode: GraphMode;
  setMode: (mode: GraphMode) => void;
  
  // Contrôles d'affichage
  showLabels: boolean;
  toggleLabels: () => void;
  
  // État du menu
  isMenuOpen: boolean;
  toggleMenu: () => void;
  
  // Fonction de reset/recentrage
  resetZoom: () => void;
  onResetZoom?: () => void;
  setResetZoomHandler: (handler: () => void) => void;
  
  // Nouveaux callbacks pour connecter à la logique métier
  onModeChange?: (mode: GraphMode) => void;
  setModeChangeHandler: (handler: (mode: GraphMode) => void) => void;
}

const GraphModeContext = createContext<GraphModeContextType | undefined>(undefined);

interface GraphModeProviderProps {
  children: ReactNode;
  initialMode?: GraphMode;
}

export function GraphModeProvider({ 
  children, 
  initialMode = 'anonyme' 
}: GraphModeProviderProps) {
  const [currentMode, setCurrentMode] = useState<GraphMode>(initialMode);
  const [showLabels, setShowLabels] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [onResetZoom, setOnResetZoom] = useState<(() => void) | undefined>();
  const [onModeChange, setOnModeChange] = useState<((mode: GraphMode) => void) | undefined>();

  const setMode = useCallback((mode: GraphMode) => {
    setCurrentMode(mode);
    // Appeler le callback de changement de mode si défini
    if (onModeChange) {
      onModeChange(mode);
    }
    console.log('Mode changé vers:', mode);
  }, [onModeChange]);

  const toggleLabels = useCallback(() => {
    setShowLabels(prev => !prev);
    console.log('Toggle labels');
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const resetZoom = useCallback(() => {
    if (onResetZoom) {
      onResetZoom();
    }
    console.log('Reset zoom');
  }, [onResetZoom]);

  const setResetZoomHandler = useCallback((handler: () => void) => {
    setOnResetZoom(() => handler);
  }, []);

  const setModeChangeHandler = useCallback((handler: (mode: GraphMode) => void) => {
    setOnModeChange(() => handler);
  }, []);

  const value: GraphModeContextType = {
    currentMode,
    setMode,
    showLabels,
    toggleLabels,
    isMenuOpen,
    toggleMenu,
    resetZoom,
    onResetZoom,
    setResetZoomHandler,
    onModeChange,
    setModeChangeHandler,
  };

  return (
    <GraphModeContext.Provider value={value}>
      {children}
    </GraphModeContext.Provider>
  );
}

export function useGraphMode() {
  const context = useContext(GraphModeContext);
  if (context === undefined) {
    throw new Error('useGraphMode must be used within a GraphModeProvider');
  }
  return context;
}

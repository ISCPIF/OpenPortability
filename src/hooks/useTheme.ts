'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeColors {
  background: string;
  text: string;
  primary: string;
  secondary: string;
  accent: string;
  particleHub: string;
  particleNode: string;
  particleConnector: string;
  particleEdge: string;
}

const darkTheme: ThemeColors = {
  background: '#0a0f1f',
  text: '#ffffff',
  primary: '#2a39a9',
  secondary: '#d6356f',
  accent: '#ff9d00',
  particleHub: '#d6356f',
  particleNode: '#2a39a9',
  particleConnector: '#ff9d00',
  particleEdge: '#2a39a9',
};

const lightTheme: ThemeColors = {
  background: '#ffffff',
  text: '#0a0f1f',
  primary: '#4a5fc1',
  secondary: '#e85a8f',
  accent: '#ffb84d',
  particleHub: '#c91e5f',
  particleNode: '#1a2a7f',
  particleConnector: '#ff8c00',
  particleEdge: '#1a2a7f',
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [colors, setColors] = useState<ThemeColors>(darkTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Détecter la préférence système
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = (isDark: boolean) => {
      const newTheme = isDark ? 'dark' : 'light';
      setTheme(newTheme);
      setColors(isDark ? darkTheme : lightTheme);
    };

    // Initialiser avec la préférence actuelle
    updateTheme(mediaQuery.matches);
    setMounted(true);

    // Écouter les changements
    const listener = (e: MediaQueryListEvent) => {
      updateTheme(e.matches);
    };

    mediaQuery.addEventListener('change', listener);

    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  return {
    theme,
    colors,
    isDark: theme === 'dark',
    mounted,
  };
}

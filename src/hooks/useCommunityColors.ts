'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// Fabio Crameri Scientific Color Palettes
// https://www.fabiocrameri.ch/colourmaps/
// ============================================================================

export const CRAMERI_PALETTES: Record<string, { name: string; colors: string[] }> = {
  batlow: {
    name: 'Batlow',
    colors: [
      '#011959', '#0e3268', '#234b6e', '#3d6370', '#577a6e',
      '#749166', '#97a65c', '#c0b84f', '#ebc844', '#fad541',
    ],
  },
  roma: {
    name: 'Roma',
    colors: [
      '#7e1900', '#a44b00', '#c57d00', '#e0b000', '#f4e300',
      '#c8e87a', '#8de4a8', '#4fd8c7', '#00c4d8', '#00a8d8',
    ],
  },
  vik: {
    name: 'Vik',
    colors: [
      '#001261', '#003380', '#00559e', '#0078bb', '#009cd6',
      '#f5d5c8', '#f0a89a', '#e67b6d', '#d44d42', '#b91f1a',
    ],
  },
  berlin: {
    name: 'Berlin',
    colors: [
      '#9eb0ff', '#7a9df7', '#5489ec', '#2a74de', '#005ecc',
      '#ffad9e', '#ff8a7a', '#f46757', '#e24336', '#c91f18',
    ],
  },
  lisbon: {
    name: 'Lisbon',
    colors: [
      '#e6e5ff', '#b8b8e6', '#8b8ccc', '#5f61b3', '#333899',
      '#c9d4a5', '#a3b87c', '#7d9c54', '#58802e', '#336409',
    ],
  },
  tofino: {
    name: 'Tofino',
    colors: [
      '#dee5e5', '#b3c7c9', '#88aaad', '#5d8d91', '#327175',
      '#e8d5c8', '#d4b09e', '#bf8b75', '#a9664d', '#924127',
    ],
  },
  hawaii: {
    name: 'Hawaii',
    colors: [
      '#8c0273', '#a32a6b', '#b85263', '#cb7a5b', '#dca253',
      '#e5c94b', '#c9d961', '#9de07f', '#6de39f', '#3ae3bf',
    ],
  },
  buda: {
    name: 'Buda',
    colors: [
      '#b300ff', '#c033e6', '#cc66cc', '#d999b3', '#e5cc99',
      '#f2ff80', '#d4e680', '#b6cc80', '#98b380', '#7a9980',
    ],
  },
  tokyo: {
    name: 'Tokyo',
    colors: [
      '#190c05', '#3d2317', '#613a2a', '#85523e', '#a96a53',
      '#cd8369', '#e89d80', '#f4b898', '#fad3b1', '#ffeecb',
    ],
  },
  lapaz: {
    name: 'La Paz',
    colors: [
      '#1a0c3c', '#2d1f5e', '#403380', '#5347a2', '#665cc4',
      '#8e7fd4', '#b6a2e4', '#dec5f4', '#f5e8ff', '#ffffff',
    ],
  },
  signin: {
    name: 'Sign In',
    colors: [
      // Twitter/X - zinc/dark grays
      '#18181b', '#27272a', '#3f3f46',
      // Bluesky - blues
      '#0085FF', '#38bdf8', '#0ea5e9',
      // Mastodon - violets
      '#6364FF', '#8b5cf6', '#a78bfa',
      // Accent
      '#f472b6',
    ],
  },
};

// Default palette key
export const DEFAULT_PALETTE = 'berlin';

// Palette for signin page
export const SIGNIN_PALETTE = 'signin';

// Cookie name
const COOKIE_NAME = 'community_colors';
const COOKIE_EXPIRY_DAYS = 365;

// Point size defaults
export const DEFAULT_POINT_SIZE = 2;
export const MIN_POINT_SIZE = 1;
export const MAX_POINT_SIZE = 8;

// Special colors (indices 10-16) - these don't change with palette
const SPECIAL_COLORS = {
  10: '#10b981', // HelloQuitteX members - emerald green
  11: '#ec4899', // personal network - à suivre (has matching) - pink
  12: '#fbbf24', // followers (non-members) / already followed - yellow
  13: '#22c55e', // current user - green
  14: '#3b82f6', // connected (lasso) - blue
  15: '#ef4444', // followers (members) - red
  16: '#6b7280', // personal network - no matching found - gray
};

interface CommunityColorsState {
  palette: string;
  customColors: Record<number, string>; // Override specific community colors
  pointSize: number; // User-defined point size for graph
}

// Helper to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

// Helper to set cookie
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

// Helper to delete cookie
function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export function useCommunityColors() {
  const [state, setState] = useState<CommunityColorsState>({
    palette: DEFAULT_PALETTE,
    customColors: {},
    pointSize: DEFAULT_POINT_SIZE,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from cookie on mount
  useEffect(() => {
    const cookieValue = getCookie(COOKIE_NAME);
    if (cookieValue) {
      try {
        const parsed = JSON.parse(cookieValue) as CommunityColorsState;
        setState({
          palette: parsed.palette || DEFAULT_PALETTE,
          customColors: parsed.customColors || {},
          pointSize: parsed.pointSize ?? DEFAULT_POINT_SIZE,
        });
      } catch {
        // Invalid cookie, use defaults
        console.warn('Invalid community colors cookie, using defaults');
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to cookie when state changes
  useEffect(() => {
    if (isLoaded) {
      setCookie(COOKIE_NAME, JSON.stringify(state), COOKIE_EXPIRY_DAYS);
    }
  }, [state, isLoaded]);

  // Get the final colors array (palette + custom overrides + special colors)
  const colors = useMemo(() => {
    const paletteColors = CRAMERI_PALETTES[state.palette]?.colors || CRAMERI_PALETTES[DEFAULT_PALETTE].colors;
    
    // Start with palette colors
    const result = [...paletteColors];
    
    // Apply custom overrides
    Object.entries(state.customColors).forEach(([index, color]) => {
      const idx = parseInt(index, 10);
      if (idx >= 0 && idx < 10) {
        result[idx] = color;
      }
    });
    
    // Add special colors (indices 10-15)
    result.push(SPECIAL_COLORS[10]);
    result.push(SPECIAL_COLORS[11]);
    result.push(SPECIAL_COLORS[12]);
    result.push(SPECIAL_COLORS[13]);
    result.push(SPECIAL_COLORS[14]);
    result.push(SPECIAL_COLORS[15]);
    
    return result;
  }, [state.palette, state.customColors]);

  // Set the entire palette
  const setPalette = useCallback((paletteName: string) => {
    if (CRAMERI_PALETTES[paletteName]) {
      setState(prev => ({
        ...prev,
        palette: paletteName,
        customColors: {}, // Reset custom colors when changing palette
      }));
    }
  }, []);

  // Set a single community color (custom override)
  const setColor = useCallback((communityIndex: number, color: string) => {
    if (communityIndex >= 0 && communityIndex < 10) {
      setState(prev => ({
        ...prev,
        customColors: {
          ...prev.customColors,
          [communityIndex]: color,
        },
      }));
    }
  }, []);

  // Reset a single community color to palette default
  const resetColor = useCallback((communityIndex: number) => {
    setState(prev => {
      const newCustomColors = { ...prev.customColors };
      delete newCustomColors[communityIndex];
      return {
        ...prev,
        customColors: newCustomColors,
      };
    });
  }, []);

  // Set point size
  const setPointSize = useCallback((size: number) => {
    const clampedSize = Math.max(MIN_POINT_SIZE, Math.min(MAX_POINT_SIZE, size));
    setState(prev => ({
      ...prev,
      pointSize: clampedSize,
    }));
  }, []);

  // Reset everything to defaults
  const resetAll = useCallback(() => {
    setState({
      palette: DEFAULT_PALETTE,
      customColors: {},
      pointSize: DEFAULT_POINT_SIZE,
    });
    deleteCookie(COOKIE_NAME);
  }, []);

  // Check if a specific color has been customized
  const isCustomized = useCallback((communityIndex: number) => {
    return communityIndex in state.customColors;
  }, [state.customColors]);

  // Check if any customization has been made
  const hasCustomizations = useMemo(() => {
    return state.palette !== DEFAULT_PALETTE || 
           Object.keys(state.customColors).length > 0 || 
           state.pointSize !== DEFAULT_POINT_SIZE;
  }, [state.palette, state.customColors, state.pointSize]);

  return {
    colors,
    palette: state.palette,
    customColors: state.customColors,
    pointSize: state.pointSize,
    setPalette,
    setColor,
    resetColor,
    setPointSize,
    resetAll,
    isCustomized,
    hasCustomizations,
    isLoaded,
    palettes: CRAMERI_PALETTES,
  };
}

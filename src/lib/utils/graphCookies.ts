/**
 * Centralized graph UI state management using sessionStorage
 * 
 * Uses sessionStorage instead of cookies so state is cleared when the tab closes.
 * Falls back to legacy cookies for backward compatibility (read-only).
 * 
 * Storage: sessionStorage (cleared on tab close)
 * Legacy: Reads from old cookies for migration, but never writes to them
 */

export const GRAPH_UI_STORAGE_KEY = 'graph_ui_state';

// Legacy cookie names (read-only for backward compatibility during migration)
const LEGACY_VIEW_MODE_COOKIE = 'graph_view_mode';
const LEGACY_VIEWPORT_COOKIE = 'graph_viewport_state';
const LEGACY_UI_STATE_COOKIE = 'graph_ui_state';

export type ViewMode = 'discover' | 'followings' | 'followers';

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface GraphUiState {
  viewMode?: ViewMode;
  viewport?: ViewportState;
}

// Helper to get sessionStorage value
function getStorageValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

// Helper to set sessionStorage value
function setStorageValue(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage might be full or disabled
  }
}

// Helper to remove sessionStorage value
function removeStorageValue(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

// Helper to get legacy cookie value (read-only for migration)
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

// Helper to delete legacy cookie
function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Get the current graph UI state from sessionStorage
 * Falls back to legacy cookies for backward compatibility (one-time migration)
 */
export function getGraphUiState(): GraphUiState {
  // Try sessionStorage first
  const savedUi = getStorageValue(GRAPH_UI_STORAGE_KEY);
  if (savedUi) {
    try {
      const parsed = JSON.parse(savedUi);
      const result: GraphUiState = {};
      
      // Extract viewMode
      if (parsed?.viewMode && ['discover', 'followings', 'followers'].includes(parsed.viewMode)) {
        result.viewMode = parsed.viewMode as ViewMode;
      }
      
      // Extract viewport
      if (parsed?.viewport && 
          typeof parsed.viewport.x === 'number' && 
          typeof parsed.viewport.y === 'number' && 
          typeof parsed.viewport.scale === 'number') {
        result.viewport = parsed.viewport;
      }
      
      if (result.viewMode || result.viewport) {
        return result;
      }
    } catch {
      // Malformed data, fall through to legacy
    }
  }
  
  // Fall back to legacy cookies (for migration)
  const legacyState = getLegacyStateFromCookies();
  if (legacyState.viewMode || legacyState.viewport) {
    // Migrate to sessionStorage and clean up legacy cookies
    setStorageValue(GRAPH_UI_STORAGE_KEY, JSON.stringify(legacyState));
    deleteCookie(LEGACY_UI_STATE_COOKIE);
    deleteCookie(LEGACY_VIEW_MODE_COOKIE);
    deleteCookie(LEGACY_VIEWPORT_COOKIE);
    return legacyState;
  }
  
  return {};
}

/**
 * Get state from legacy cookies (for migration)
 */
function getLegacyStateFromCookies(): GraphUiState {
  const result: GraphUiState = {};
  
  // Try legacy unified cookie first
  const legacyUi = getCookieValue(LEGACY_UI_STATE_COOKIE);
  if (legacyUi) {
    try {
      const parsed = JSON.parse(decodeURIComponent(legacyUi));
      if (parsed?.viewMode && ['discover', 'followings', 'followers'].includes(parsed.viewMode)) {
        result.viewMode = parsed.viewMode as ViewMode;
      }
      if (parsed?.viewport && 
          typeof parsed.viewport.x === 'number' && 
          typeof parsed.viewport.y === 'number' && 
          typeof parsed.viewport.scale === 'number') {
        result.viewport = parsed.viewport;
      }
    } catch {
      // Ignore malformed cookie
    }
  }
  
  // Fill in from individual legacy cookies
  if (!result.viewMode) {
    result.viewMode = getLegacyViewMode();
  }
  if (!result.viewport) {
    result.viewport = getLegacyViewport();
  }
  
  return result;
}

/**
 * Get viewMode from legacy cookie
 */
function getLegacyViewMode(): ViewMode | undefined {
  const saved = getCookieValue(LEGACY_VIEW_MODE_COOKIE);
  if (saved && ['discover', 'followings', 'followers'].includes(saved)) {
    return saved as ViewMode;
  }
  return undefined;
}

/**
 * Get viewport from legacy cookie
 */
function getLegacyViewport(): ViewportState | undefined {
  const saved = getCookieValue(LEGACY_VIEWPORT_COOKIE);
  if (saved) {
    try {
      const parsed = JSON.parse(decodeURIComponent(saved));
      if (typeof parsed.x === 'number' && 
          typeof parsed.y === 'number' && 
          typeof parsed.scale === 'number') {
        return parsed;
      }
    } catch {
      // Malformed cookie
    }
  }
  return undefined;
}

/**
 * Save the graph UI state to sessionStorage
 */
export function setGraphUiState(state: GraphUiState): void {
  // Get current state to merge with
  const current = getGraphUiState();
  
  const newState: GraphUiState = {
    viewMode: state.viewMode ?? current.viewMode,
    viewport: state.viewport ?? current.viewport,
  };
  
  setStorageValue(GRAPH_UI_STORAGE_KEY, JSON.stringify(newState));
}

/**
 * Update just the viewMode, preserving viewport
 */
export function setGraphViewMode(viewMode: ViewMode): void {
  setGraphUiState({ viewMode });
}

/**
 * Update just the viewport, preserving viewMode
 */
export function setGraphViewport(viewport: ViewportState): void {
  setGraphUiState({ viewport });
}

/**
 * Clear graph UI state (sessionStorage + legacy cookies)
 */
export function clearGraphUiState(): void {
  removeStorageValue(GRAPH_UI_STORAGE_KEY);
  // Also clean up any legacy cookies
  deleteCookie(LEGACY_UI_STATE_COOKIE);
  deleteCookie(LEGACY_VIEW_MODE_COOKIE);
  deleteCookie(LEGACY_VIEWPORT_COOKIE);
}

/**
 * Get initial view mode with mobile detection
 * On mobile, always returns 'followings'
 */
export function getInitialViewMode(): ViewMode {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return 'followings';
  }
  
  const state = getGraphUiState();
  return state.viewMode ?? 'discover';
}

/**
 * Get initial viewport state (or null if none saved)
 */
export function getInitialViewport(): ViewportState | null {
  const state = getGraphUiState();
  return state.viewport ?? null;
}

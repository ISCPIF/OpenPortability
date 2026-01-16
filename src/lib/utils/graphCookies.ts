/**
 * Centralized graph UI state cookie management
 * 
 * Consolidates the following legacy cookies into a single source of truth:
 * - graph_ui_state (primary - contains both viewMode and viewport)
 * - graph_view_mode (legacy - viewMode only)
 * - graph_viewport_state (legacy - viewport only)
 * 
 * Reading: Falls back to legacy cookies for backward compatibility
 * Writing: Only writes to graph_ui_state
 */

export const GRAPH_UI_COOKIE_NAME = 'graph_ui_state';
export const GRAPH_UI_COOKIE_EXPIRY_DAYS = 30;

// Legacy cookie names (read-only for backward compatibility)
const LEGACY_VIEW_MODE_COOKIE = 'graph_view_mode';
const LEGACY_VIEWPORT_COOKIE = 'graph_viewport_state';

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

// Helper to get cookie value
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

// Helper to set cookie
function setCookieValue(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

// Helper to delete cookie
function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Get the current graph UI state from cookies
 * Falls back to legacy cookies for backward compatibility
 */
export function getGraphUiState(): GraphUiState {
  // Try primary cookie first
  const savedUi = getCookieValue(GRAPH_UI_COOKIE_NAME);
  if (savedUi) {
    try {
      const parsed = JSON.parse(decodeURIComponent(savedUi));
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
      
      // If we got at least one value, return it (with fallbacks for missing parts)
      if (result.viewMode || result.viewport) {
        // Fill in missing parts from legacy cookies
        if (!result.viewMode) {
          result.viewMode = getLegacyViewMode();
        }
        if (!result.viewport) {
          result.viewport = getLegacyViewport();
        }
        return result;
      }
    } catch {
      // Malformed cookie, fall through to legacy
    }
  }
  
  // Fall back to legacy cookies
  return {
    viewMode: getLegacyViewMode(),
    viewport: getLegacyViewport(),
  };
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
 * Save the graph UI state to cookie
 * Only writes to the primary cookie (graph_ui_state)
 */
export function setGraphUiState(state: GraphUiState): void {
  // Get current state to merge with
  const current = getGraphUiState();
  
  const newState: GraphUiState = {
    viewMode: state.viewMode ?? current.viewMode,
    viewport: state.viewport ?? current.viewport,
  };
  
  setCookieValue(GRAPH_UI_COOKIE_NAME, JSON.stringify(newState), GRAPH_UI_COOKIE_EXPIRY_DAYS);
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
 * Clear all graph UI cookies (for reset view)
 */
export function clearGraphUiState(): void {
  deleteCookie(GRAPH_UI_COOKIE_NAME);
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

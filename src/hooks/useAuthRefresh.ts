'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AuthRefreshState {
  isChecking: boolean;
  isValid: boolean;
  requiresReauth: boolean;
  invalidProviders: string[];
  error: string | null;
  noAccountsConfigured: boolean;
  errorCode?: string;  // Specific error code (e.g., 'MastodonRateLimit')
}

// Module-level variables to prevent duplicate API calls across component instances
// These are shared with useAuthTokens via a global window object
const getGlobalAuthState = () => {
  if (typeof window !== 'undefined') {
    // Share state with useAuthTokens to prevent duplicate calls
    if (!(window as any).__authRefreshState) {
      (window as any).__authRefreshState = {
        checked: false,
        result: null as AuthRefreshState | null,
        promise: null as Promise<AuthRefreshState> | null,
      };
    }
    return (window as any).__authRefreshState;
  }
  // SSR fallback
  return { checked: false, result: null, promise: null };
};

const globalAuthChecked = { current: false };
const globalAuthResult = { current: null as AuthRefreshState | null };
let activeAuthPromise: Promise<AuthRefreshState> | null = null;

export function useAuthRefresh() {
  const globalState = getGlobalAuthState();
  
  const [state, setState] = useState<AuthRefreshState>(() => {
    // If we already have a cached result (from this hook or useAuthTokens), use it
    if (globalState.result) {
      return globalState.result;
    }
    if (globalAuthResult.current) {
      return globalAuthResult.current;
    }
    // Check if useAuthTokens has already verified (via window.__authTokensVerified)
    if (typeof window !== 'undefined' && (window as any).__authTokensVerified) {
      return {
        isChecking: false,
        isValid: true,
        requiresReauth: false,
        invalidProviders: [],
        error: null,
        noAccountsConfigured: false,
      };
    }
    return {
      isChecking: true,
      isValid: false,
      requiresReauth: false,
      invalidProviders: [],
      error: null,
      noAccountsConfigured: false,
    };
  });

  const hasCheckedRef = useRef(globalAuthChecked.current || globalState.checked);

  const checkAuth = useCallback(async (force = false): Promise<AuthRefreshState> => {
    // Check if useAuthTokens has already verified
    if (typeof window !== 'undefined' && (window as any).__authTokensVerified && !force) {
      console.log('📊 [useAuthRefresh] Skipping - useAuthTokens already verified');
      const cachedResult: AuthRefreshState = {
        isChecking: false,
        isValid: true,
        requiresReauth: false,
        invalidProviders: [],
        error: null,
        noAccountsConfigured: false,
      };
      setState(cachedResult);
      return cachedResult;
    }
    
    // If already checked and not forcing, return cached result
    if (!force && (hasCheckedRef.current || globalAuthChecked.current || globalState.checked)) {
      const cached = globalState.result || globalAuthResult.current;
      if (cached) {
        console.log('📊 [useAuthRefresh] Skipping - already checked');
        return cached;
      }
    }

    // If there's an active check in progress, reuse that promise
    const existingPromise = activeAuthPromise || globalState.promise;
    if (existingPromise && !force) {
      console.log('📊 [useAuthRefresh] Reusing active promise');
      return existingPromise;
    }

    console.log('📊 [useAuthRefresh] Starting auth check');
    setState(prev => ({ ...prev, isChecking: true, error: null }));

    activeAuthPromise = (async (): Promise<AuthRefreshState> => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Request-ID': `auth-refresh-${Date.now()}`,
          },
          body: JSON.stringify({}),
        });

        const data = await response.json();
        let result: AuthRefreshState;

        if (response.ok && data.success) {
          result = {
            isChecking: false,
            isValid: true,
            requiresReauth: false,
            invalidProviders: [],
            error: null,
            noAccountsConfigured: false,
          };
        } else if (data.error === 'No social accounts configured') {
          result = {
            isChecking: false,
            isValid: false,
            requiresReauth: true,
            invalidProviders: [],
            error: null,
            noAccountsConfigured: true,
          };
        } else if (data.requiresReauth) {
          result = {
            isChecking: false,
            isValid: false,
            requiresReauth: true,
            invalidProviders: data.providers || [],
            error: null,
            noAccountsConfigured: false,
            errorCode: data.errorCode,  // Pass specific error code (e.g., 'MastodonRateLimit')
          };
        } else {
          result = {
            isChecking: false,
            isValid: false,
            requiresReauth: false,
            invalidProviders: [],
            error: data.error || 'Unknown error',
            noAccountsConfigured: false,
          };
        }

        // Cache the result globally
        hasCheckedRef.current = true;
        globalAuthChecked.current = true;
        globalAuthResult.current = result;
        setState(result);
        
        return result;
      } catch (error) {
        console.error('❌ [useAuthRefresh] Error:', error);
        const errorResult: AuthRefreshState = {
          isChecking: false,
          isValid: false,
          requiresReauth: false,
          invalidProviders: [],
          error: error instanceof Error ? error.message : 'Network error',
          noAccountsConfigured: false,
        };
        
        hasCheckedRef.current = true;
        globalAuthChecked.current = true;
        globalAuthResult.current = errorResult;
        setState(errorResult);
        
        return errorResult;
      } finally {
        activeAuthPromise = null;
      }
    })();

    return activeAuthPromise;
  }, []);

  // Check auth on mount (only if not already checked)
  useEffect(() => {
    const globalState = getGlobalAuthState();
    // Skip if already checked by this hook, useAuthTokens, or global state
    if (hasCheckedRef.current || globalAuthChecked.current || globalState.checked) {
      return;
    }
    // Skip if useAuthTokens has already verified successfully
    if (typeof window !== 'undefined' && (window as any).__authTokensVerified) {
      console.log('📊 [useAuthRefresh] Skipping mount check - useAuthTokens already verified');
      setState({
        isChecking: false,
        isValid: true,
        requiresReauth: false,
        invalidProviders: [],
        error: null,
        noAccountsConfigured: false,
      });
      return;
    }
    checkAuth();
  }, [checkAuth]);

  // Function to force recheck (e.g., after login)
  const recheckAuth = useCallback(() => {
    hasCheckedRef.current = false;
    globalAuthChecked.current = false;
    globalAuthResult.current = null;
    return checkAuth(true);
  }, [checkAuth]);

  return {
    ...state,
    recheckAuth,
  };
}

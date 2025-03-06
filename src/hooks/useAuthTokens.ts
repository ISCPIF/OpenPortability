import { useCallback, useEffect, useState, useRef } from "react";

// Module-level variables to track verification state across component instances
const globalTokensVerified = { current: false };
// Shared promise for concurrent verification requests
let activeVerificationPromise: Promise<any> | null = null;

export function useAuthTokens() {
    const [missingProviders, setMissingProviders] = useState<('bluesky' | 'mastodon')[]>([]);
    // Local ref to track if tokens have been verified in this component instance
    const tokensVerifiedRef = useRef(globalTokensVerified.current);
    
    const verifyTokens = useCallback(async () => {
      // If tokens are already verified, return immediately
      if (tokensVerifiedRef.current || globalTokensVerified.current) {
        tokensVerifiedRef.current = true;
        globalTokensVerified.current = true;
        console.log("useAuthTokens: Tokens already verified, skipping API call");
        return { isValid: true };
      }

      // If there's an active verification in progress, reuse that promise
      if (activeVerificationPromise) {
        console.log("useAuthTokens: Verification already in progress, reusing existing promise");
        return activeVerificationPromise;
      }

      // Create a new verification promise
      console.log("useAuthTokens: Starting new token verification");
      activeVerificationPromise = (async () => {
        try {
          console.log("useAuthTokens: Sending API request to verify tokens...");
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 
              'Cache-Control': 'no-cache',
              'X-Request-ID': `auth-refresh-${Date.now()}` // Add unique identifier
            }
          });
          const data = await response.json();
          
          if (!data.success && data.providers) {
            setMissingProviders(data.providers);
          }
          
          tokensVerifiedRef.current = true;
          globalTokensVerified.current = true;
          
          return { isValid: data.success, providers: data.providers };
        } catch (error) {
          console.error('Error verifying tokens:', error);
          return { isValid: false, error };
        } finally {
          // Clear the active promise reference when done
          activeVerificationPromise = null;
        }
      })();

      return activeVerificationPromise;
    }, []);
    
    // Function to manually reset the verification state (useful for logout, etc.)
    const resetTokenVerification = useCallback(() => {
      tokensVerifiedRef.current = false;
      globalTokensVerified.current = false;
      activeVerificationPromise = null;
    }, []);
    
    return { missingProviders, verifyTokens, resetTokenVerification };
}
'use client';

import React, { useEffect } from 'react';

export function ReactScanWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Délai pour laisser React se stabiliser avant d'initialiser react-scan
      const timeoutId = setTimeout(() => {
        try {
          // Charger react-scan de manière dynamique
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/react-scan/dist/auto.global.js';
          script.async = true;
          script.onload = () => {
            console.log('✅ react-scan loaded from CDN');
          };
          script.onerror = () => {
            console.warn('⚠️ Failed to load react-scan from CDN, trying npm import...');
            import('react-scan').then(({ scan }) => {
              scan();
              console.log('✅ react-scan initialized from npm');
            }).catch(err => {
              console.warn('⚠️ react-scan not available:', err);
            });
          };
          document.head.appendChild(script);
        } catch (error) {
          console.warn('⚠️ Error initializing react-scan:', error);
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, []);

  return <>{children}</>;
}
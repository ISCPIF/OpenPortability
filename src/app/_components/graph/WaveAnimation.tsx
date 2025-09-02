'use client'

import React from 'react';

interface WaveAnimationProps {
  className?: string;
}

export function WaveAnimation({ className = '' }: WaveAnimationProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 h-24 pointer-events-none z-10 ${className}`}>
      {/* Première vague */}
      <div 
        className="absolute bottom-0 left-0 w-[200%] h-24 opacity-30"
        style={{
          background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath d='M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z' fill='rgba(42,57,169,0.3)'/%3E%3C/svg%3E") repeat-x`,
          animation: 'wave 15s cubic-bezier(0.36, 0.45, 0.63, 0.53) infinite'
        }}
      />
      
      {/* Deuxième vague */}
      <div 
        className="absolute bottom-2 left-0 w-[200%] h-24 opacity-50"
        style={{
          background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath d='M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z' fill='rgba(42,57,169,0.2)'/%3E%3C/svg%3E") repeat-x`,
          animation: 'wave 17s cubic-bezier(0.36, 0.45, 0.63, 0.53) -0.125s infinite, swell 7s ease -1.25s infinite'
        }}
      />

      {/* Styles CSS pour les animations */}
      <style jsx>{`
        @keyframes wave {
          0% { 
            margin-left: 0; 
          }
          100% { 
            margin-left: -50%; 
          }
        }

        @keyframes swell {
          0%, 100% { 
            transform: translate3d(0, -25px, 0); 
          }
          50% { 
            transform: translate3d(0, 5px, 0); 
          }
        }
      `}</style>
    </div>
  );
}

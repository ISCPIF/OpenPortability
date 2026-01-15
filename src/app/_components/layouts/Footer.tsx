'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { memo, useState } from 'react';
import { Github, Mail } from 'lucide-react';
import { usePathname } from 'next/navigation';
import SupportModal from '../modales/SupportModale';
import logoCNRS from "../../../../public/logo-cnrs-blanc.svg"
import { useTheme } from '@/hooks/useTheme';
import { useCommunityColors } from '@/hooks/useCommunityColors';
import { quantico } from '@/app/fonts/plex';

const Footer = memo(() => {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const { colors, isDark } = useTheme();
  const { colors: communityColors } = useCommunityColors();
  const pathname = usePathname();
  
  // Use community colors for accents
  // For contrast: use light color (index 8-9) on dark theme, dark color (index 0-1) on light theme
  const accentColor = communityColors[7] || '#c0b84f';
  const contrastColor = isDark 
    ? (communityColors[9] || communityColors[8] || '#fad541') // Light color for dark theme
    : (communityColors[0] || communityColors[1] || '#011959'); // Dark color for light theme
  
  // Sur /reconnect et /discover, le footer est fixed en bas
  const isReconnectPage = pathname.includes('/reconnect') || pathname.includes('/discover');
  // Sur /auth/signin, le texte est blanc
  const isSigninPage = pathname.includes('/auth/signin');

  const hostedText = t.raw('hosted.text');
  const cnrsText = t.raw('hosted.cnrs');
  const OpenPortabilityText = t.raw('hosted.openPortability');

  const parts = hostedText.split(/\{(cnrs|hqx|openPortability)\}/);
  const content = parts.map((part: string, index: number) => {
    if (part === 'cnrs') {
      return (
        <a 
          key="cnrs" 
          href="https://iscpif.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-all duration-200"
          style={{ 
            color: isDark ? '#ffffff' : colors.text,
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = contrastColor;
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = isDark ? '#ffffff' : colors.text;
          }}
        >
          {cnrsText}
        </a>
      );
    }
    else if (part === 'openPortability') {
      return (
        <a 
          key="openPortability" 
          href="https://iscpif.fr/openportability"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-all duration-200"
          style={{ 
            color: isDark ? '#ffffff' : colors.text,
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = contrastColor;
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = isDark ? '#ffffff' : colors.text;
          }}
        >
          {OpenPortabilityText}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });

  const iconStyle = {
    color: isDark ? '#ffffff' : colors.text,
  };

  const iconHoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      e.currentTarget.style.color = contrastColor;
      e.currentTarget.style.transform = 'scale(1.1)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      e.currentTarget.style.color = isDark ? '#ffffff' : colors.text;
      e.currentTarget.style.transform = 'scale(1)';
    },
  };

  return (
    <footer 
      className={`${quantico.className} w-full py-1 md:py-2 px-2 md:px-4 border-t ${isReconnectPage ? 'fixed bottom-0 left-0 right-0 z-[100]' : 'mt-auto'}`}
      style={{ 
        backgroundColor: isDark ? 'rgba(10, 15, 31, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        borderColor: isDark ? `${accentColor}26` : 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Top glow line */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: isDark 
            ? 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent)',
        }}
      />

      <div className="max-w-screen-2xl mx-auto flex flex-col items-center gap-0.5 md:gap-1">
        {/* Line 1: Platform text - hidden on mobile */}
        <div 
          className="hidden md:block text-xs font-mono"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : `${colors.text}99` }}
        >
          {content}
        </div>

        {/* Line 2: Icons */}
        <div className="flex items-center gap-2 md:gap-3">
          <a 
            href="https://github.com/ISCPIF/OpenPortability"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-all duration-200"
            style={iconStyle}
            {...iconHoverHandlers}
          >
            <Github className="w-3 h-3 md:w-3.5 md:h-3.5" />
          </a>
          <button 
            onClick={() => setIsSupportModalOpen(true)}
            className="transition-all duration-200"
            style={iconStyle}
            {...iconHoverHandlers}
          >
            <Mail className="w-3 h-3 md:w-3.5 md:h-3.5" />
          </button>
          <a 
            href="https://www.cnrs.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-all duration-200"
            style={iconStyle}
            {...iconHoverHandlers}
          >
            <Image
              src={logoCNRS}
              alt="CNRS"
              width={12}
              height={12}
              className="md:w-[14px] md:h-[14px]"
              style={{ 
                filter: isDark 
                  ? 'none' // Logo is already white, keep it white on dark background
                  : 'invert(1)' // Invert white to black on light background
              }}
            />
          </a>
        </div>

        {/* Line 3: Privacy + Copyright - simplified on mobile */}
        <div className="flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-mono">
          <a 
            href="/privacy_policy"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-all duration-200"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : `${colors.text}99` }}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.color = contrastColor;
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.7)' : `${colors.text}99`;
            }}
          >
            {t('privacy')}
          </a>
          <span className="mx-0.5 md:mx-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0,0,0,0.2)' }}>|</span>
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : `${colors.text}66` }}>
            © {year}
          </span>
        </div>
      </div>

      {/* Modal rendered inside footer but with portal-like z-index */}
      <SupportModal 
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
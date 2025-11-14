'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { memo, useState } from 'react';
import { Github, Mail } from 'lucide-react';
import SupportModal from '../modales/SupportModale';
import logoCNRS from "../../../../public/logo-cnrs-blanc.svg"
import { useTheme } from '@/hooks/useTheme';

const FooterLink = memo(({ href, children }: { href: string; children: React.ReactNode }) => {
  const { isDark } = useTheme();
  const lightClasses = 'text-indigo-700 hover:text-pink-600';
  const darkClasses = 'text-indigo-300 hover:text-pink-400';
  return (
    <a 
      href={href}
      className={`${isDark ? darkClasses : lightClasses} transition-colors duration-200`}
    >
      {children}
    </a>
  );
});

FooterLink.displayName = 'FooterLink';

const Footer = memo(() => {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const { colors, isDark } = useTheme();

  const hostedText = t.raw('hosted.text');
  const cnrsText = t.raw('hosted.cnrs');
  const OpenPortabilityText = t.raw('hosted.openPortability');
  // const hqxText = t.raw('hosted.hqx');

  const parts = hostedText.split(/\{(cnrs|hqx|openPortability)\}/);
  const content = parts.map((part: string, index: number) => {
    if (part === 'cnrs') {
      return (
        <FooterLink key="cnrs" href="https://iscpif.fr/">
          {cnrsText}
        </FooterLink>
      );
    }
    else if (part === 'openPortability')
    {
      return (
        <FooterLink key="openPortability" href="https://iscpif.fr/openportability">
          {OpenPortabilityText}
        </FooterLink>
      );
    }
    return <span key={index}>{part}</span>;
  });

  return (
    <footer className="w-full py-8 mt-auto" style={{ backgroundColor: isDark ? '#0a0f1f' : colors.background, color: isDark ? '#ffffff' : colors.text }}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center gap-3">
          <div className={`${isDark ? 'text-slate-300' : 'text-gray-900'} text-sm font-space-grotesk`}>
            {content}
          </div>
          <FooterLink href="/privacy_policy">
              <span className="text-xs">{t('privacy')}</span>
          </FooterLink>
          <div className="flex gap-4 mt-2 items-center">
            <FooterLink href="https://github.com/ISCPIF/OpenPortability">
              <Github className="w-5 h-5" />
            </FooterLink>
            <button 
              onClick={() => setIsSupportModalOpen(true)}
              className={`${isDark ? 'text-indigo-300 hover:text-pink-400' : 'text-indigo-700 hover:text-pink-600'} transition-colors duration-200`}
            >
              <Mail className="w-5 h-5" />
            </button>
            <FooterLink href="https://www.cnrs.fr">
              <Image
                src={logoCNRS}
                alt={"Centre Nationale de la Recherche Scientifique"}
                width={20}
                height={20}
                className="opacity-80 hover:opacity-100 transition-opacity"
              />
            </FooterLink>
          </div>
          <div className="text-xs text-slate-400 font-space-grotesk">
            {t('copyright', { year })}
          </div>
        </div>
        
      </div>
      <SupportModal 
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
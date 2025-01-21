'use client';

import { useTranslations } from 'next-intl';
import { memo, useState } from 'react';
import { Github, Mail } from 'lucide-react';
import SupportModal from './SupportModale';

const FooterLink = memo(({ href, children }: { href: string; children: React.ReactNode }) => (
  <a 
    href={href}
    className="text-indigo-300 hover:text-pink-400 transition-colors duration-200"
  >
    {children}
  </a>
));

FooterLink.displayName = 'FooterLink';

const Footer = memo(() => {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const hostedText = t.raw('hosted.text');
  const cnrsText = t.raw('hosted.cnrs');
  const hqxText = t.raw('hosted.hqx');

  const parts = hostedText.split(/\{(cnrs|hqx)\}/);
  const content = parts.map((part: string, index: number) => {
    if (part === 'cnrs') {
      return (
        <FooterLink key="cnrs" href="https://iscpif.fr/">
          {cnrsText}
        </FooterLink>
      );
    }
    if (part === 'hqx') {
      return (
        <FooterLink key="hqx" href="https://helloquittex.com/">
          {hqxText}
        </FooterLink>
      );
    }
    return <span key={index}>{part}</span>;
  });

  return (
    <footer className="w-full py-8 mt-auto bg-gradient-to-br from-[#2a39a9] to-[#1f2d8a] border-t border-indigo-500/20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="text-sm text-slate-300 font-space-grotesk">
            {content}
          </div>
          <div className="text-xs text-slate-400 font-space-grotesk">
            {t('copyright', { year })}
          </div>
          <div className="flex gap-4 mt-2">
            <FooterLink href="https://github.com/ISCPIF/helloquittex">
              <Github className="w-5 h-5" />
            </FooterLink>
            <button 
              onClick={() => setIsSupportModalOpen(true)}
              className="text-indigo-300 hover:text-pink-400 transition-colors duration-200"
            >
              <Mail className="w-5 h-5" />
            </button>
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
'use client';

import { useTranslations } from 'next-intl';
import { memo } from 'react';

const FooterLink = memo(({ href, children }: { href: string; children: React.ReactNode }) => (
  <a 
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 hover:text-blue-800 underline"
  >
    {children}
  </a>
));

FooterLink.displayName = 'FooterLink';

const Footer = memo(() => {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

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
    <footer className="w-full py-6 mt-auto bg-[#2a39a9] border-t border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center">
          <div className="text-sm text-foreground font-space-grotesk mb-2">
            {content}
          </div>
          <div className="text-xs text-gray-500 font-space-grotesk">
            {t('copyright', { year })}
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
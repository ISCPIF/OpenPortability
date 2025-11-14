'use client'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingIndicator from '@/app/_components/layouts/LoadingIndicator';
import LoginSea from "@/app/_components/layouts/LoginSea";
import DashboardLoginButtons from '@/app/_components/logins/DashboardLoginButtons';
import { useDashboardState } from '@/hooks/useDashboardState';
import NewsletterSection from '@/app/_components/sections/dashboard/NewsletterSection';
import OnboardingSection from '@/app/_components/sections/dashboard/OnboardingSection';
import TutorialSection from '@/app/_components/sections/dashboard/TutorialSection';
import { useTheme } from '@/hooks/useTheme';
import logoBlanc from "@/../public/logo/logo-openport-blanc.svg";
import logoRose from "@/../public/logos/logo-openport-rose.svg";

export default function DashboardPage() {
  const {
    session,
    update,
    stats,
    globalStats,
    mastodonInstances,
    newsletterData,
    isLoading,
    setIsLoading,
    showNewsletterModal,
    setShowNewsletterModal,
    progress,
    hasMastodon,
    hasBluesky,
    hasTwitter,
    hasOnboarded,
    connectedServicesCount
  } = useDashboardState();

  const [isNewsletterFirstSeenOpen, setIsNewsletterFirstSeenOpen] = useState(false);
  
  const t = useTranslations('dashboard');
  const { locale } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (hasOnboarded && hasMastodon && hasTwitter && hasBluesky) {
      router.push(`/${locale}/reconnect`);
    }
  }, [hasOnboarded, router, locale]);

  const handleNewsletterFirstSeenOpen = (isOpen: boolean) => {
    setIsNewsletterFirstSeenOpen(isOpen);
  };
 

  const { isDark } = useTheme();

  if (isLoading) {
    return (
      <div className="min-h-screen relative w-full m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center">
            <div className="m-auto relative my-32 lg:my-40">
              <LoadingIndicator msg={t('loading')} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Composant principal
  return (
    <div className="w-full">
      <div className="w-full flex flex-col items-center">
        {/* Logo higher than signin: smaller top gap handled by layout, also add slight local margin */}
        <div className="mb-4 sm:mb-6">
          <Image
            src={isDark ? logoBlanc : logoRose}
            alt="OpenPort Logo"
            width={306}
            height={82}
            className="mx-auto sm:w-[240px] md:w-[300px] flex-shrink-0"
            priority
          />
        </div>

        <div className="w-full mt-8">
          <div className="flex flex-col text-center">
            <div className="max-w-3xl mx-auto w-full">
              <div className="flex justify-center items-center w-full">
                <div className="w-full backdrop-blur-xs rounded-2xl">
                  <OnboardingSection 
                    session={session?.user} 
                    mastodonInstances={mastodonInstances}
                    setIsLoading={setIsLoading}
                  />
                </div>
              </div>

              <div className="mt-2">
                <DashboardLoginButtons
                  connectedServices={{
                    twitter: !!session?.user?.twitter_username,
                    bluesky: !!session?.user?.bluesky_username,
                    mastodon: !!session?.user?.mastodon_username
                  }}
                  hasUploadedArchive={true}
                  onLoadingChange={setIsLoading}
                  mastodonInstances={mastodonInstances}
                />
              </div>

              <div className="space-y-8 sm:space-y-16 mt-8 sm:mt-16 mb-16">
                {session?.user?.id && (
                  <NewsletterSection 
                    userId={session.user.id}
                    showModal={showNewsletterModal}
                    setShowModal={setShowNewsletterModal}
                    onUpdate={update}
                    haveSeenNewsletter={!!session.user.have_seen_newsletter}
                    newsletterData={newsletterData}
                    onModalOpenChange={handleNewsletterFirstSeenOpen}
                  />
                )}

                <TutorialSection />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
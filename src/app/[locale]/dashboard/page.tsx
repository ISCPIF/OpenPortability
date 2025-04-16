'use client'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/_components/Header';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import Footer from '@/app/_components/Footer';
import LoadingIndicator from '@/app/_components/LoadingIndicator';
import LoginSea from "@/app/_components/LoginSea";
import LaunchReconnection from '@/app/_components/LaunchReconnection';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';
import { useDashboardState } from '@/hooks/useDashboardState';
import NewsletterSection from '@/app/_components/dashboard/NewsletterSection';
import OnboardingSection from '@/app/_components/dashboard/OnboardingSection';
import TutorialSection from '@/app/_components/dashboard/TutorialSection';

export default function DashboardPage() {
  const {
    session,
    update,
    stats,
    globalStats,
    mastodonInstances,
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
  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
        <div className="container mx-auto py-12">
          <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
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
    <div className="min-h-screen bg-[#2a39a9]">
      <div className="relative z-40">
        <Header />
      </div>
      
      <div className="w-full">
        <div className="flex flex-col text-center text-[#E2E4DF]">
          {/* Sea background that takes full width */}
          <LoginSea />
        </div>

        <div className="relative w-full">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center w-full sm:-mt-16 md:-mt-24">
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
              {/* Section newsletter */}
              {session?.user?.id && (
                <NewsletterSection 
                  userId={session.user.id}
                  showModal={showNewsletterModal}
                  setShowModal={setShowNewsletterModal}
                  onUpdate={update}
                  haveSeenNewsletter={!!session.user.have_seen_newsletter}
                  onModalOpenChange={handleNewsletterFirstSeenOpen}
                />
              )}

              {/* Section tutoriel */}
              <TutorialSection />
            </div>
          </div>
        </div>
        
        <Footer />
      </div>
    </div>
  );
}
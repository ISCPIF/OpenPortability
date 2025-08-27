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
import NodesSea from '@/app/_components/NodesSea';
import LaunchReconnection from '@/app/_components/LaunchReconnection';
import DashboardLoginButtons from '@/app/_components/DashboardLoginButtons';
import { useDashboardState } from '@/hooks/useDashboardState';
import NewsletterSection from '@/app/_components/dashboard/NewsletterSection';
import OnboardingSection from '@/app/_components/dashboard/OnboardingSection';
import TutorialSection from '@/app/_components/dashboard/TutorialSection';
// import NewsLetterConsentsUpdate from '@/app/_components/NewsLetterConsentsUpdate'

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

  console.log(session)

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
  

  // Mock nodes data - 100 nodes avec des données réalistes
  const mockNodes = [
    {
      "id": "3995971978",
      "label": "@APBG_National",
      "x": 8130.4,
      "y": 4217.2,
      "size": 0.3932346972,
      "color": "#F7DC6F",
      "community": 7,
      "degree": 425
    },
    {
      "id": "4092261081",
      "label": "@MathevonNicolas",
      "x": 8567.2,
      "y": -954.8,
      "size": 0.38796146,
      "color": "#F7DC6F",
      "community": 7,
      "degree": 45
    },
    {
      "id": "1083721511075233792",
      "label": "@UserExample1",
      "x": 13152.1,
      "y": 3179.3,
      "size": 0.3002742046,
      "color": "#F7DC6F",
      "community": 7,
      "degree": 13
    },
    {
      "id": "2847593021",
      "label": "@TechInfluencer",
      "x": 5420.8,
      "y": 1890.5,
      "size": 0.4521789,
      "color": "#85C1E9",
      "community": 3,
      "degree": 892
    },
    {
      "id": "9384756102",
      "label": "@DataScientist",
      "x": 11230.7,
      "y": -2340.1,
      "size": 0.3456789,
      "color": "#82E0AA",
      "community": 2,
      "degree": 234
    },
    {
      "id": "5738291047",
      "label": "@ArtisticSoul",
      "x": 2890.3,
      "y": 5670.8,
      "size": 0.2987654,
      "color": "#D7BDE2",
      "community": 5,
      "degree": 156
    },
    {
      "id": "7462018395",
      "label": "@NewsReporter",
      "x": 14567.9,
      "y": 890.2,
      "size": 0.4123456,
      "color": "#F1948A",
      "community": 1,
      "degree": 678
    },
    {
      "id": "1928374650",
      "label": "@GameDeveloper",
      "x": 6789.4,
      "y": -3456.7,
      "size": 0.3678901,
      "color": "#AED6F1",
      "community": 4,
      "degree": 345
    },
    {
      "id": "8374619205",
      "label": "@FoodBlogger",
      "x": 3456.1,
      "y": 2789.4,
      "size": 0.2789012,
      "color": "#A9DFBF",
      "community": 6,
      "degree": 123
    },
    {
      "id": "4729183650",
      "label": "@MusicProducer",
      "x": 9876.5,
      "y": 4321.8,
      "size": 0.4567890,
      "color": "#F8C471",
      "community": 8,
      "degree": 789
    },
    // Générer 90 nodes supplémentaires avec des données variées
    ...Array.from({ length: 90 }, (_, i) => ({
      id: `mock_node_${i + 11}`,
      label: `@User${i + 11}`,
      x: Math.random() * 15000 + 1000,
      y: Math.random() * 8000 - 4000,
      size: 0.2 + Math.random() * 0.3,
      color: [
        "#F7DC6F", "#85C1E9", "#F8C471", "#82E0AA", 
        "#D7BDE2", "#F1948A", "#AED6F1", "#A9DFBF"
      ][Math.floor(Math.random() * 8)],
      community: Math.floor(Math.random() * 10) + 1,
      degree: Math.floor(Math.random() * 500) + 10
    }))
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#2a39a9] relative w-full m-auto">
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
          <NodesSea 
            // maxNodes={500}  // Afficher les 50k plus gros
            showLogo={true}
            showTitle={true}
            height="h-[600px]"
          />
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
                  newsletterData={newsletterData}
                  onModalOpenChange={handleNewsletterFirstSeenOpen}
                />
              )}

              {/* Section tutoriel */}
              <TutorialSection />
            </div>
          </div>
          {/* {session?.user?.have_seen_newsletter && (
            <NewsLetterConsentsUpdate userId={session.user.id} />
          )} */}
        </div>
        
        <Footer />
      </div>
    </div>
  );
}
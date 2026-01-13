'use client';

import { useEffect, useState } from "react";
import React from 'react';
import Header from "./Header";
import Footer from "./Footer";
import LoadingIndicator from "./LoadingIndicator";
import { useTheme } from "@/hooks/useTheme";

interface AppLayoutProps {
    children: React.ReactNode;
    isLoading?: boolean;
    loadingMessage?: string;
  }
  
  export default function AppLayout({ children, isLoading, loadingMessage = 'Loading...' }: AppLayoutProps) {
    const { colors, isDark, mounted } = useTheme();

    // Éviter le flash de contenu avant le montage
    if (!mounted) {
      return null;
    }

    if (isLoading) {
      return (
        <div 
          className="min-h-screen relative w-full max-w-[90rem] m-auto"
          style={{ backgroundColor: colors.primary }}
        >
          <div className="container mx-auto py-12">
            <div className="container flex flex-col m-auto text-center" style={{ color: colors.text }}>
              <div className="m-auto relative my-32 lg:my-40">
                <LoadingIndicator msg={loadingMessage} />
              </div>
            </div>
          </div>
        </div>
      );
    }
  
    return (
      <div 
        className="min-h-screen mt-4 relative w-full max-w-[80rem] m-auto"
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        <div className="relative z-40">
          <Header />
        </div>
        {children}
        <Footer />
      </div>
    );
  }
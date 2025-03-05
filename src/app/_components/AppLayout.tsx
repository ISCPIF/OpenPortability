import { useEffect, useState } from "react";
import React from 'react';
import Header from "./Header";
import Footer from "./Footer";
import LoadingIndicator from "./LoadingIndicator";

interface AppLayoutProps {
    children: React.ReactNode;
    isLoading?: boolean;
    loadingMessage?: string;
  }
  
  export default function AppLayout({ children, isLoading, loadingMessage = 'Loading...' }: AppLayoutProps) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-[#2a39a9] relative w-full max-w-[90rem] m-auto">
          <div className="container mx-auto py-12">
            <div className="container flex flex-col m-auto text-center text-[#E2E4DF]">
              <div className="m-auto relative my-32 lg:my-40">
                <LoadingIndicator msg={loadingMessage} />
              </div>
            </div>
          </div>
        </div>
      );
    }
  
    return (
      <div className="min-h-screen bg-[#2a39a9] mt-4 relative w-full max-w-[80rem] m-auto">
        <div className="relative z-40">
          <Header />
        </div>
        {children}
        <Footer />
      </div>
    );
  }
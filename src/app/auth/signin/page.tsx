"use client";

import { signIn, useSession } from "next-auth/react";
import Header from "@/app/_components/Header";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user?.has_onboarded) {
      console.log("✅ Session found, redirecting to /dashboard");
      router.replace("/dashboard");
    } else if (status === "authenticated") {
      console.log("✅ Session found, redirecting to /upload");
      router.replace("/upload");
    } else {
      setIsLoading(false);
    }
  }, [session, status, router]);

  // Ne rien afficher pendant le chargement ou si on doit rediriger
  if (isLoading || status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Header />
      
      <main className="container mx-auto px-4 pt-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)]"
        >
          <div className="max-w-md w-full space-y-8 p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg">
            <div className="text-center">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 text-transparent bg-clip-text">
                Connexion
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                Connectez-vous pour commencer votre migration
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => signIn("twitter")}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                Continuer avec Twitter
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
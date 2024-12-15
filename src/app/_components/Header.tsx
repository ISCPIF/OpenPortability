'use client'

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import ConnectedAccounts from './ConnectedAccounts';
import { ChevronDown } from 'lucide-react';

const Header = () => {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="relative z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
      
      <div className="relative">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo et Titre */}
            <Link href="/" className="group flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Image
                  src="/logo.png"
                  alt="HelloQuitteX Logo"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-xl overflow-hidden shadow-lg"
                />
              </motion.div>
              
              <div className="flex flex-col">
                <h1 className="font-space-grotesk text-2xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  HelloQuitteX
                </h1>
                <p className="text-xs tracking-wider text-white/60 uppercase">
                  Libérons nos espaces numériques
                </p>
              </div>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-6">
              {session ? (
                <div className="flex items-center gap-6">
                  {/* Profil avec menu déroulant */}
                  <div className="relative">
                    <button
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      {session.user?.image && (
                        <Image
                          src={session.user.image}
                          alt={session.user.name || ''}
                          width={32}
                          height={32}
                          className="rounded-full border border-white/10"
                        />
                      )}
                      <div className="hidden sm:block">
                        <p className="text-sm font-medium text-white">
                          {session.user?.name}
                        </p>
                        <p className="text-xs text-white/60">
                          @{session.user?.twitter_username}
                        </p>
                      </div>
                      <ChevronDown 
                        className={`w-4 h-4 text-white/60 transition-transform duration-200 
                          ${isProfileOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Menu déroulant avec ConnectedAccounts */}
                    <AnimatePresence>
                      {isProfileOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 mt-2 w-80 origin-top-right"
                        >
                          <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl overflow-hidden">
                            <div className="p-4">
                              <ConnectedAccounts />
                            </div>
                            <div className="border-t border-white/10">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={async () => {
                                  try {
                                    if (session?.user?.bluesky_id) {
                                      await fetch('/api/auth/bluesky', {
                                        method: 'DELETE',
                                      });
                                      window.location.href = '/';
                                    } else {
                                      await signOut({ 
                                        callbackUrl: '/',
                                        redirect: true 
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Error signing out:', error);
                                    window.location.href = '/';
                                  }
                                }}
                                className="w-full px-4 py-2 text-sm text-white/80 hover:text-white 
                                         hover:bg-white/5 transition-colors text-left"
                              >
                                Déconnexion
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signIn('twitter')}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r 
                           from-sky-400 to-blue-500 rounded-lg shadow-lg 
                           hover:from-sky-500 hover:to-blue-600"
                >
                  Se connecter avec Twitter
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
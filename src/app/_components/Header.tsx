'use client'

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import ConnectedAccounts from './ConnectedAccounts';
import { ChevronDown } from 'lucide-react';
import logo from '../../../public/logo-2.svg'

const Header = () => {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="relative z-10">
      <div className="absolute inset-0 bg-transparent pointer-events-none" />

      <div className="relative">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-right justify-end">
            {/* Actions */}
            <div className="flex items-center gap-6">
              {session && (
                <div className="flex items-center gap-6">
                  {/* Profil avec menu déroulant */}
                  <div className="relative">
                    <button
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 transition-colors"
                    >
                      {session.user?.image && (
                        <Image
                          src={session.user.image}
                          alt={session.user.name || ''}
                          width={32}
                          height={32}
                          className="rounded-full border border-black/10"
                        />
                      )}
                      <div className="hidden sm:block">
                        <p className="text-sm font-medium text-black">
                          {session.user?.name}
                        </p>
                        <p className="text-xs text-black/60">
                          @{session.user?.twitter_username}
                        </p>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-black/60 transition-transform duration-200 
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
                          <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-black/10 shadow-xl overflow-hidden">
                            <div className="p-4">
                              <ConnectedAccounts />
                            </div>
                            <div className="border-t border-black/10">
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
                                className="w-full px-4 py-2 text-sm text-black/80 hover:text-black 
                                         hover:bg-black/5 transition-colors text-left"
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
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

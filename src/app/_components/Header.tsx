'use client'

import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const Header = () => {
  const { data: session } = useSession();

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
                  {/* Profil */}
                  <div className="flex items-center gap-3">
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
                  </div>

                  {/* Déconnexion */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => signOut()}
                    className="px-4 py-2 text-sm text-white/80 hover:text-white transition-colors rounded-lg border border-white/10 hover:border-white/20 bg-white/5 backdrop-blur-sm"
                  >
                    Déconnexion
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signIn('twitter')}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg"
                >
                  Connexion
                </motion.button>
              )}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}

export default Header;
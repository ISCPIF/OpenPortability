"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Header from "./Header";
import ActionProgressBar from "./ActionProgressBar";
import Image from "next/image";
import type { motion as MotionType } from "framer-motion";
import ErrorModal from "./ErrorModal";
import ConsentModal from "./ConsentModal";
import BlueSkyLogin from "./BlueSkyLogin";
import MigrationComplete from "./MigrationComplete";
import { BskyAgent } from '@atproto/api';
import { processFiles, validateTwitterData } from "./UploadButton";
import { Session } from "next-auth";
import Link from 'next/link';

const UploadButton = dynamic(() => import('./UploadButton'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-12 w-48 rounded-lg"></div>,
  ssr: false
});

const MotionDiv = dynamic(() => import('framer-motion').then((mod) => mod.motion.div), { ssr: false });

interface ClientPageProps {
  session: Session | null;
}

interface UploadStats {
  following: number;
  followers: number;
}

export default function ClientPage({ session }: ClientPageProps) {
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [blueskyProfile, setBlueskyProfile] = useState<{ handle: string; displayName?: string } | null>(null);
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const handleUploadComplete = (stats: UploadStats) => {
    setUploadStats(stats);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    setIsUploading(false);
  };

  const handleCloseError = () => {
    setError(null);
    setShowCreateAccount(false);
  };

  const handleFilesSelected = (files: FileList) => {
    // setPendingFiles(null); // Reset any previous files
    setShowConsent(true);
    setPendingFiles(files);
    console.log('Files selected:', files[0]);
  };

  const handleConsentDecline = () => {
    setShowConsent(false);
    setPendingFiles(null);
  };

  const handleAcceptConsent = async () => {
    setShowConsent(false);
    if (pendingFiles) {
      try {
        const processedFiles = await processFiles(pendingFiles);
        
        if (processedFiles.length === 0) {
          throw new Error('No valid files found');
        }

        console.log('📤 Preparing upload...');
        const formData = new FormData();
        
        const getMimeType = (filename: string) => {
          console.log("filename", filename)
          if (filename.toLowerCase().endsWith('.zip')) return 'application/zip';
          return 'application/javascript';
        };
        
        for (const { name, content } of processedFiles) {
          const textContent = new TextDecoder().decode(content);
          
          const type = name.toLowerCase().includes('following') ? 'following' : 'follower';
          const validationError = validateTwitterData(textContent, type);
          if (validationError) {
            throw new Error(validationError);
          }
          
          console.log(`✅ ${name} validation successful: correct Twitter data format`);
          
          const file = new File([content], name, {
            type: getMimeType(name)
          });
          formData.append('file', file);
        }

        const response = await fetch(`/api/upload/${session?.user?.id}`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const result = await response.json();
        handleUploadComplete(result.stats);
      } catch (error) {
        handleUploadError(error instanceof Error ? error.message : 'Failed to process files');
      } finally {
        setIsUploading(false);
        setPendingFiles(null);
      }
    }
  };

  const handleBlueSkyError = (error: Error) => {
    setError(`Erreur de connexion : ${error.message}. Vous pouvez réessayer ou créer un compte.`);
    setShowCreateAccount(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Header />
      
      <main className="container mx-auto px-4">
        <MotionDiv 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]"
        >
          {session ? (
            <>
              <MotionDiv 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-6 flex flex-col items-center"
              >
                {session.user?.image ? (
                  <div className="w-24 h-24 rounded-full overflow-hidden mb-3 ring-4 ring-pink-500 ring-opacity-50">
                    <Image
                      src={session.user.image}
                      alt={session.user.name || "Profile picture"}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold mb-3">
                    {session.user?.name?.charAt(0) || "?"}
                  </div>
                )}
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
                  Bienvenue, {session.user?.name || "Utilisateur"}
                </h2>
              </MotionDiv>

              <h1 className="text-4xl md:text-5xl font-bold text-center bg-gradient-to-r from-pink-600 to-purple-600 text-transparent bg-clip-text mb-6">
                Votre espace HelloQuitteX
              </h1>
              
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl text-center mb-8">
                Commencez votre migration en toute simplicité
              </p>

              {session?.twitterAccessToken ? (
                <MotionDiv 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="flex flex-col items-center gap-6"
                >
                  {uploadStats ? (
                    <MotionDiv 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center"
                    >
                      {blueskyProfile ? (
                        <MigrationComplete 
                          profile={blueskyProfile}
                          error={error || undefined}
                          onRetry={() => {
                            setError(null);
                            setBlueskyProfile(null);
                          }}
                          onCreateAccount={() => {
                            window.open('https://bsky.app/signup', '_blank');
                          }}
                        />
                      ) : (
                        <BlueSkyLogin onLoginComplete={async (agent: BskyAgent) => {
                          try {
                            if (!agent.session?.handle) {
                              throw new Error('No handle found in session');
                            }
                            const profile = await agent.getProfile({
                              actor: agent.session.handle
                            });
                            
                            setBlueskyProfile({
                              handle: profile.data.handle,
                              displayName: profile.data.displayName
                            });
                            
                            // TODO: Envoyer l'agent à l'API pour commencer la migration
                            // const response = await fetch('/api/migrate', {
                            //   method: 'POST',
                            //   headers: {
                            //     'Content-Type': 'application/json',
                            //   },
                            //   body: JSON.stringify({
                            //     accessJwt: agent.session?.accessJwt,
                            //     refreshJwt: agent.session?.refreshJwt,
                            //     handle: agent.session?.handle,
                            //   }),
                            // });
                            
                          } catch (error) {
                            console.error('Erreur lors de la récupération du profil:', error);
                            handleBlueSkyError(error instanceof Error ? error : new Error('Erreur inconnue'));
                          }
                        }} />
                      )}
                    </MotionDiv>
                  ) : (
                    <MotionDiv 
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="flex flex-col items-center gap-6"
                    >
                      <UploadButton 
                        onUploadComplete={handleUploadComplete} 
                        onError={handleUploadError}
                        onFilesSelected={handleFilesSelected}
                        filesToProcess={showConsent ? null : pendingFiles} // On envoie les fichiers seulement après le consentement
                      />
                      {uploadStats ? (
                        <div className="text-center">
                          <h1 className="text-4xl font-bold text-white mb-4">
                            <span className="text-green-300">Migration en cours !</span>
                          </h1>
                          <p className="text-lg text-gray-300">
                            {/* {uploadStats.following} following et {uploadStats.followers} followers importés avec succès */}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <h1 className="text-4xl font-bold text-white mb-4">
                            Commencez votre migration en toute simplicité
                          </h1>
                          <p className="text-lg text-gray-300">
                            Importez vos données Twitter et rejoignez le Fédiverse
                          </p>
                        </div>
                      )}
                    </MotionDiv>
                  )}
                </MotionDiv>
              ) : (
                <MotionDiv 
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/api/auth/signin" className="text-white">Connecter Twitter</Link>
                </MotionDiv>
              )}
            </>
          ) : (
            <>
              <h1 className="text-4xl md:text-5xl font-bold text-center bg-gradient-to-r from-pink-600 to-purple-600 text-transparent bg-clip-text mb-6">
                Bienvenue sur HelloQuitteX
              </h1>
              
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl text-center mb-8">
                Libérez-vous des réseaux sociaux traditionnels et reprenez le contrôle de votre présence numérique
              </p>

              <MotionDiv 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/api/auth/signin" className="text-white">Commencer l'aventure</Link>
              </MotionDiv>
            </>
          )}
        </MotionDiv>
      </main>
      <ErrorModal
        isOpen={error !== null}
        error={error}
        onClose={handleCloseError}
      />
      
      <ConsentModal
        isOpen={showConsent}
        onAccept={handleAcceptConsent}
        onDecline={handleConsentDecline}
      />
    </div>
  );
}
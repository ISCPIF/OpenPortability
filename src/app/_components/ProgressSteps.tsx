'use client'

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

function ProgressStep({ 
  step, 
  title, 
  description, 
  isCompleted, 
  isLast,
  onClick
}: { 
  step: number; 
  title: string; 
  description: string; 
  isCompleted: boolean;
  isLast?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex-1 relative">
      {/* Ligne de connexion */}
      {!isLast && (
        <div 
          className={`absolute left-[50%] top-6 h-0.5 w-full
            ${isCompleted ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-white/10'}`} 
        />
      )}
      
      {/* Contenu de l'étape */}
      <div 
        className={`relative flex flex-col items-center text-center px-4
          ${onClick ? 'cursor-pointer group' : ''}`}
        onClick={onClick}
      >
        {/* Cercle avec numéro ou check */}
        <div 
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 z-10
            transition-all duration-300 ease-out
            ${isCompleted 
              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg shadow-pink-500/20' 
              : 'bg-white/5 text-white/40 border border-white/10'}
            ${onClick ? 'group-hover:scale-110' : ''}`}
        >
          {isCompleted ? <CheckCircle className="w-6 h-6" /> : step}
        </div>
        
        {/* Texte */}
        <div className="max-w-[150px]">
          <h3 className={`font-medium mb-1 text-sm
            ${isCompleted ? 'text-white' : 'text-white/60'}`}>
            {title}
          </h3>
          <p className={`text-xs leading-tight
            ${isCompleted ? 'text-white/80' : 'text-white/40'}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ProgressStepsProps {
  hasTwitter: boolean;
  hasBluesky: boolean;
  hasMastodon: boolean;
  hasOnboarded: boolean;
  stats: {
    following: number;
    followers: number;
  };
}

export default function ProgressSteps({ 
  hasTwitter, 
  hasBluesky, 
  hasMastodon, 
  hasOnboarded,
  stats 
}: ProgressStepsProps) {
  const [isShared, setIsShared] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'Goodbye X',
        text: 'Je migre mes abonnements Twitter vers d\'autres réseaux sociaux avec Goodbye X !',
        url: window.location.href
      });
      setIsShared(true);
    } catch (error) {
      console.error('Erreur lors du partage:', error);
    }
  };

  return (
    <div className="bg-black/20 backdrop-blur-lg rounded-2xl p-8">
      <div className="flex items-start gap-4">
        <ProgressStep
          step={1}
          title="Dashboard"
          description="Connexion réussie à la plateforme HelloQuitteX !"
          isCompleted={true}
        />
        
        <ProgressStep
          step={2}
          title="Réseaux sociaux"
          description={
            hasTwitter && (hasBluesky || hasMastodon)
              ? "Connexion à plusieurs réseaux"
              : "Connectez un autre réseau"
          }
          isCompleted={hasTwitter && (hasBluesky || hasMastodon)}
        />
        
        <ProgressStep
          step={3}
          title="Import"
          description={
            hasOnboarded
              ? `${stats.following} abos, ${stats.followers} abonnés`
              : "Importez vos abonnements"
          }
          isCompleted={hasOnboarded}
        />
        
        <ProgressStep
          step={4}
          title="Partage"
          description="Aidez vos amis à migrer"
          isCompleted={isShared}
          isLast={true}
          onClick={handleShare}
        />
      </div>
    </div>
  );
}
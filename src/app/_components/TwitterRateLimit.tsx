'use client'

import { motion } from "framer-motion"
import { SiMastodon, SiBluesky } from 'react-icons/si'
import { plex } from "@/app/fonts/plex"

interface TwitterRateLimitProps {
  onShowAlternatives: () => void;
}

export default function TwitterRateLimit({ onShowAlternatives }: TwitterRateLimitProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className={`${plex.className} text-sm font-medium text-blue-800`}>
            Twitter est temporairement indisponible
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>En raison d'un grand nombre de requêtes, Twitter n'est pas accessible pour le moment.</p>
            <p className="mt-2">Vous pouvez :</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Réessayer dans quelques minutes</li>
              <li>Utiliser une autre plateforme pour vous connecter</li>
            </ul>
          </div>
          <div className="mt-4">
            <button
              onClick={onShowAlternatives}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="flex items-center gap-2">
                <SiMastodon className="h-5 w-5" />
                <SiBluesky className="h-5 w-5" />
                Voir les alternatives
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
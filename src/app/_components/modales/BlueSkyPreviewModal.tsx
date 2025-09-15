'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { plex } from '../../fonts/plex'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import blueskyIcon from '../../../../public/newSVG/BS.svg'
import { handleShare } from '@/lib/utils'

interface BlueSkyPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  message: string
  session: any
  onSuccess?: () => void
  onError?: () => void
}

export default function BlueSkyPreviewModal({
  isOpen,
  onClose,
  message,
  session,
  onSuccess,
  onError
}: BlueSkyPreviewModalProps) {
  const t = useTranslations('blueskyPreviewModale')
  const modalRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [charCount, setCharCount] = useState(0)
  const [buttonHovered, setButtonHovered] = useState(false)
  
  // Max character count for BlueSky
  const MAX_CHARS = 300

  // Permettre à l'utilisateur de modifier le message avant de publier
  useEffect(() => {
    if (isOpen && messageRef.current) {
      messageRef.current.value = message
      setCharCount(message.length)
      messageRef.current.focus()
    }
  }, [isOpen, message])

  // Fermer la modale si on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Gérer le partage effectif sur BlueSky
  const handlePublish = () => {
    if (messageRef.current) {
      handleShare(messageRef.current.value, 'bluesky', session, onSuccess, onError)
      onClose()
    }
  }

  // Mettre à jour le compteur de caractères
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharCount(e.target.value.length)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            {/* Overlay avec effet de flou */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[#2a39a9]/30 backdrop-blur-md" 
              onClick={onClose}
            />

            {/* Contenu de la modale */}
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 30 
              }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 overflow-hidden transform"
            >
              {/* En-tête de la modale avec logo BlueSky */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-[#0085ff]/10 p-2 rounded-full">
                    <Image
                      src={blueskyIcon}
                      alt="Bluesky"
                      width={28}
                      height={28}
                      className="w-7 h-7"
                    />
                  </div>
                  <h2 className={`text-xl font-semibold text-[#2a39a9] ${plex.className}`}>
                    {t('previewTitle', { platform: 'Bluesky' })}
                  </h2>
                </div>
                
                {/* Bouton de fermeture amélioré */}
                <button
                  onClick={onClose}
                  className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                  aria-label="Fermer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Zone de texte avec compteur de caractères */}
              <div className="mb-5 w-full">
                <div className="relative">
                  <textarea
                    ref={messageRef}
                    onChange={handleTextChange}
                    className={`w-full p-4 border ${charCount > MAX_CHARS ? 'border-red-500' : 'border-gray-200'} 
                    rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2a39a9]/50 focus:border-transparent 
                    shadow-sm min-h-[150px] text-gray-700 resize-none ${plex.className}`}
                    defaultValue={message}
                    placeholder="Votre message sur Bluesky..."
                  />
                  
                  {/* Compteur de caractères */}
                  <div className={`absolute bottom-3 right-3 text-xs font-medium ${
                    charCount > MAX_CHARS ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {charCount}/{MAX_CHARS}
                  </div>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={onClose}
                  className={`px-5 py-2.5 border border-gray-200 rounded-full text-gray-700 
                  hover:bg-gray-50 transition-all duration-200 ${plex.className}`}
                >
                  {t('cancel')}
                </button>
                
                <motion.button
                  onClick={handlePublish}
                  disabled={charCount > MAX_CHARS || charCount === 0}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onHoverStart={() => setButtonHovered(true)}
                  onHoverEnd={() => setButtonHovered(false)}
                  className={`px-5 py-2.5 rounded-full ${plex.className}
                  ${charCount > MAX_CHARS || charCount === 0 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-[#2a39a9] hover:bg-[#1e2b8a] text-white shadow-md hover:shadow-lg'
                  } transition-all duration-200`}
                >
                  <span className="flex items-center gap-1.5">
                    {t('publish')}
                    {buttonHovered && charCount <= MAX_CHARS && charCount > 0 && (
                      <motion.svg
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-4 h-4" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </motion.svg>
                    )}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
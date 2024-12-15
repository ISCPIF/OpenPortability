'use client'

import { useState } from 'react'
import { FaTwitter, FaMastodon } from 'react-icons/fa'
import { SiBluesky } from "react-icons/si"
import { Share2, Mail, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'

interface PartageButtonProps {
  onShare: (url: string, platform: string) => void
}

export default function PartageButton({ onShare }: PartageButtonProps) {
  const { data: session } = useSession()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const shareText = "Je migre mes abonnements Twitter vers d'autres réseaux sociaux avec Goodbye X !"
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  const shareOptions = [
    {
      name: 'Twitter',
      icon: <FaTwitter className="w-5 h-5" />,
      color: 'bg-[#1DA1F2]',
      isAvailable: !!session?.user?.twitter_id,
      shareUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'Bluesky',
      icon: <SiBluesky className="w-5 h-5" />,
      color: 'bg-[#0085FF]',
      isAvailable: !!session?.user?.bluesky_id,
      shareUrl: `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`
    },
    {
      name: 'Mastodon',
      icon: <FaMastodon className="w-5 h-5" />,
      color: 'bg-[#6364FF]',
      isAvailable: !!session?.user?.mastodon_id,
      shareUrl: session?.user?.mastodon_instance 
        ? `${session.user.mastodon_instance}/share?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`
        : ''
    },
    {
      name: 'Email',
      icon: <Mail className="w-5 h-5" />,
      color: 'bg-emerald-500',
      isAvailable: true,
      shareUrl: `mailto:?subject=${encodeURIComponent('Ma migration avec HelloQuitteX')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`
    }
  ]

  const handleClick = (url: string, platform: string) => {
    setIsModalOpen(false)
    onShare(url, platform)
  }

  return (
    <>
      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 
                   text-white rounded-xl border border-white/20 transition-all duration-200"
        >
          <Share2 className="w-5 h-5" />
          Partager
        </motion.button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md mx-4"
            >
              <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 
                          shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="text-lg font-medium text-white">Partager votre migration</h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {shareOptions.map((option) => (
                    <motion.button
                      key={option.name}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleClick(option.shareUrl, option.name)}
                      disabled={!option.isAvailable}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-white 
                              transition-all duration-200 ${option.color} 
                              ${!option.isAvailable ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110'}`}
                    >
                      {option.icon}
                      <span>Partager sur {option.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
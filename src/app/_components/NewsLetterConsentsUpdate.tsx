'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { plex } from '@/app/fonts/plex'
import { Switch } from '@headlessui/react'
import { ConsentType } from '@/hooks/useNewsLetter'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Badge from '../../../public/v2/HQX-badge.svg'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Info } from 'lucide-react'

interface NewsLetterConsentsUpdateProps {
  userId: string
  onSubmit?: () => void
}

export default function NewsLetterConsentsUpdate({ userId, onSubmit }: NewsLetterConsentsUpdateProps) {
  const { data: session } = useSession()
  const t = useTranslations('settings')
  const { locale } = useParams()
  
  // États pour les consentements existants (pré-remplis à partir de session.user)
  const [localConsents, setLocalConsents] = useState({
    email_newsletter: false,
    oep_newsletter: false, 
    research_participation: false,
    personalized_support: false,
    bluesky_dm: false,
    mastodon_dm: false
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasConsents, setHasConsents] = useState(false)
  
  // Vérifier si l'utilisateur a Bluesky ou Mastodon
  const hasBlueskyAccount = !!session?.user?.bluesky_username
  const hasMastodonAccount = !!session?.user?.mastodon_username
  const hasNoSocialAccounts = !hasBlueskyAccount && !hasMastodonAccount
  
  // Vérifier si l'utilisateur a déjà des consentements dans le nouveau système
  useEffect(() => {
    const checkExistingConsents = async () => {
      try {
        const response = await fetch('/api/newsletter/request')
        const data = await response.json()
        
        // Si l'utilisateur a déjà des consentements dans le nouveau système, 
        // on ne montre pas le composant
        if (data && Object.keys(data).some(key => 
          ['email_newsletter', 'oep_newsletter', 'research_participation', 'personalized_support', 'bluesky_dm', 'mastodon_dm'].includes(key)
        )) {
          setHasConsents(true)
        } else {
          // Initialiser les consentements à partir de session.user
          setLocalConsents({
            email_newsletter: session?.user?.hqx_newsletter || false,
            oep_newsletter: session?.user?.oep_accepted || false,
            research_participation: session?.user?.research_accepted || false,
            personalized_support: false, // nouveau consentement
            bluesky_dm: false, // nouveau consentement
            mastodon_dm: false // nouveau consentement
          })
        }
      } catch (error) {
        console.error('Error checking consents:', error)
      }
    }
    
    if (userId) {
      checkExistingConsents()
    }
  }, [userId, session])
  
  // Gérer le changement d'un consentement
  const handleConsentChange = (type: ConsentType, value: boolean) => {
    setLocalConsents(prev => ({ ...prev, [type]: value }))
    
    // Si personalized_support est désactivé, désactiver aussi bluesky_dm et mastodon_dm
    if (type === 'personalized_support' && !value) {
      setLocalConsents(prev => ({ 
        ...prev, 
        [type]: value,
        bluesky_dm: false,
        mastodon_dm: false
      }))
    }
  }
  
  // Soumettre les consentements
  const handleSubmit = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/newsletter/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consents: Object.entries(localConsents).map(([type, value]) => ({
            type,
            value
          }))
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update consents')
      }
      
      // Marquer que l'utilisateur a maintenant des consentements (pour fermer la modale)
      setHasConsents(true)
      
      if (onSubmit) {
        onSubmit()
      }
      
    } catch (error) {
      console.error('Error updating consents:', error)
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Rendre un interrupteur avec son explication
  const renderSwitch = (
    type: ConsentType,
    title: string,
    description: string,
    checked: boolean,
    onChange: (value: boolean) => void
  ) => (
    <div className="flex items-center space-x-3 py-3">
      <Switch
        checked={checked}
        onChange={(value) => onChange(value)}
        className={`${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        } relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
      >
        <span
          className={`${
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          } inline-block h-[20px] w-[20px] transform rounded-full bg-white transition-transform`}
        />
      </Switch>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <span className="text-xs text-gray-500 mt-1">{description}</span>
      </div>
    </div>
  )
  
  // Si l'utilisateur a déjà des consentements, ne pas afficher le composant
  if (hasConsents) {
    return null
  }
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Image src={Badge} alt="HelloQuitteX" width={40} height={40} />
            <h2 className={`${plex.className} text-xl font-bold ml-4 text-gray-800`}>
              {t('consentUpdate.title')}
            </h2>
          </div>
          
          <p className="text-gray-600 mb-6">
            {t('consentUpdate.description')}
          </p>
          
          <div className="space-y-2 mb-6">
            {/* Consentements existants */}
            <h3 className={`${plex.className} text-sm font-medium text-gray-700 mb-3`}>
              {t('consentUpdate.currentConsents')}
            </h3>
            
            {renderSwitch(
              'email_newsletter',
              t('notifications.hqxNewsletter.title'),
              t('notifications.hqxNewsletter.description'),
              localConsents.email_newsletter,
              (value) => handleConsentChange('email_newsletter', value)
            )}
            
            {renderSwitch(
              'oep_newsletter',
              t('notifications.oepNewsletter.title'),
              t('notifications.oepNewsletter.description'),
              localConsents.oep_newsletter,
              (value) => handleConsentChange('oep_newsletter', value)
            )}
            
            {renderSwitch(
              'research_participation',
              t('notifications.research.title'),
              t('notifications.research.description'),
              localConsents.research_participation,
              (value) => handleConsentChange('research_participation', value)
            )}
            
            {/* Nouveaux consentements */}
            <h3 className={`${plex.className} text-sm font-medium text-gray-700 mt-6 mb-3`}>
              {t('consentUpdate.newConsents')}
            </h3>
            
            {renderSwitch(
              'personalized_support',
              t('notifications.personalizedSupport.title'),
              t('notifications.personalizedSupport.description'),
              localConsents.personalized_support,
              (value) => handleConsentChange('personalized_support', value)
            )}
            
            {/* Options de support personnalisé conditionnelles */}
            {localConsents.personalized_support && (
              <div className="ml-6 space-y-3 border-l-2 border-gray-200 pl-4 mt-2">
                {/* Message d'avertissement si aucun compte social n'est lié */}
                {hasNoSocialAccounts ? (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Info className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          {t('consentUpdate.dmLinkWarning')}
                        </p>
                        <p className="text-sm text-yellow-700 mt-2">
                          {t('consentUpdate.validateAnyway')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Afficher les options seulement si l'utilisateur a des comptes liés */}
                    {hasBlueskyAccount && renderSwitch(
                      'bluesky_dm',
                      t('notifications.blueskyDm.title'),
                      t('notifications.blueskyDm.description'),
                      localConsents.bluesky_dm,
                      (value) => handleConsentChange('bluesky_dm', value)
                    )}
                    
                    {hasMastodonAccount && renderSwitch(
                      'mastodon_dm',
                      t('notifications.mastodonDm.title'),
                      t('notifications.mastodonDm.description'),
                      localConsents.mastodon_dm,
                      (value) => handleConsentChange('mastodon_dm', value)
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          
          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-[#46489B] text-white rounded-lg font-semibold hover:bg-opacity-90 
                      transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                {t('loading')}
              </span>
            ) : (
              t('consentUpdate.confirmButton')
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
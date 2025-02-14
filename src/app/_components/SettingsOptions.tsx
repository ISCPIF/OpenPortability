'use client'

import { Fragment, useState, useEffect } from 'react'
import { Menu, Transition, Dialog } from '@headlessui/react'
import { signOut } from 'next-auth/react'
import { IoEllipsisVertical } from 'react-icons/io5'
import { useTranslations } from 'next-intl'
import { Trash2, CheckCircle2 } from 'lucide-react'
import { plex } from '@/app/fonts/plex'
import { Switch } from '@headlessui/react'

export default function SettingsOptions() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptOEP, setAcceptOEP] = useState(false)
  const [acceptResearch, setAcceptResearch] = useState(false)
  const [acceptOEPNewsletter, setAcceptOEPNewsletter] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const t = useTranslations('settings')

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/newsletter', { method: 'GET' });
        if (response.ok) {
          const responseData = await response.json();
          const preferences = responseData.data;
          setAcceptResearch(!!preferences.research_accepted);
          setAcceptOEP(!!preferences.oep_accepted);
          setAcceptOEPNewsletter(!!preferences.oep_newsletter);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      }
    };
    fetchPreferences();
  }, []);

  const handleSwitchChange = async (type: 'research' | 'oep' | 'oepNewsletter', value: boolean) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acceptOEP: type === 'oep' ? value : acceptOEP,
          research_accepted: type === 'research' ? value : acceptResearch,
          oep_newsletter: type === 'oepNewsletter' ? value : acceptOEPNewsletter,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      if (type === 'research') {
        setAcceptResearch(value);
      } else if (type === 'oep') {
        setAcceptOEP(value);
      } else {
        setAcceptOEPNewsletter(value);
      }
      
      // Show success message
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      const response = await fetch('/api/delete', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete account')
      }

      signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Error deleting account:', error)
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="relative">
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors">
          <IoEllipsisVertical className="w-5 h-5 text-white/60" />
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-white/10 shadow-lg focus:outline-none z-50">
            <div className="px-3 py-2">
              <h1>NOTIFICATION OPTIONS</h1>
              {showSuccess && (
                <div className="flex items-center gap-2 text-xs text-green-400 mb-2 bg-green-500/10 p-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('preferencesUpdated')}</span>
                </div>
              )}
              <div className="border-b border-white/10 pb-2 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">{t('newsletter')}</span>
                  <Switch
                    disabled={isLoading}
                    checked={acceptOEP}
                    onChange={(value) => handleSwitchChange('oep', value)}
                    className={`${
                      acceptOEP ? 'bg-blue-600' : 'bg-gray-700'
                    } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        acceptOEP ? 'translate-x-5' : 'translate-x-1'
                      } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/60">{t('oepNewsletter')}</span>
                  <Switch
                    disabled={isLoading}
                    checked={acceptOEPNewsletter}
                    onChange={(value) => handleSwitchChange('oepNewsletter', value)}
                    className={`${
                      acceptOEPNewsletter ? 'bg-blue-600' : 'bg-gray-700'
                    } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        acceptOEPNewsletter ? 'translate-x-5' : 'translate-x-1'
                      } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">{t('research')}</span>
                  <Switch
                    disabled={isLoading}
                    checked={acceptResearch}
                    onChange={(value) => handleSwitchChange('research', value)}
                    className={`${
                      acceptResearch ? 'bg-blue-600' : 'bg-gray-700'
                    } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      className={`${
                        acceptResearch ? 'translate-x-5' : 'translate-x-1'
                      } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                </div>
              </div>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleDeleteAccount}
                    className={`${
                      active ? 'bg-red-500/10' : ''
                    } group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:text-red-300 transition-colors`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('deleteAccount')}
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      <Transition appear show={showDeleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteConfirm(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-white/10">
                  <Dialog.Title as="h3" className={`${plex.className} text-sm font-medium leading-6 text-white mb-2`}>
                    {t('deleteConfirm.title')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-xs text-gray-300 whitespace-pre-line">
                      {t('deleteConfirm.message')}
                    </p>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t('deleteConfirm.cancel')}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:from-red-600 hover:to-red-700 transition-all"
                      onClick={confirmDelete}
                    >
                      {t('deleteConfirm.confirm')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
'use client'

import { Fragment, useState } from 'react'
import { Menu, Transition, Dialog } from '@headlessui/react'
import { signOut } from 'next-auth/react'
import { IoEllipsisVertical } from 'react-icons/io5'
import { useTranslations } from 'next-intl'

export default function SettingsOptions() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const t = useTranslations('settings')

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

      // Si la suppression réussit, déconnectez l'utilisateur
      signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Error deleting account:', error)
      // Vous pouvez ajouter ici une notification d'erreur pour l'utilisateur
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
          <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-white backdrop-blur-xl border border-white/10 shadow-lg focus:outline-none z-50">
            <div className="px-1 py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleDeleteAccount}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm text-red-600`}
                  >
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
            <div className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {t('deleteConfirm.title')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 whitespace-pre-line">
                      {t('deleteConfirm.message')}
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t('deleteConfirm.cancel')}
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none"
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
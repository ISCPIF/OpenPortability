"use client"

import { ModalBody, ModalFooter, ModalHeader, ModalShell } from "./ModalShell"

interface TestCModaleProps {
  isOpen: boolean
  onClose: () => void
  /** If true, clicking overlay or pressing Escape will NOT close the modal */
  strict?: boolean
}

export function TestCModale({ isOpen, onClose, strict = false }: TestCModaleProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Test modal"
      size="md"
      closeOnOverlayClick={!strict}
      closeOnEscape={!strict}
      showCloseButton={!strict}
    >
      <ModalHeader className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Test modal
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-300">
          Use this test component to validate focus trap, keyboard support, and closing behaviors.
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        <label className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-200">
          <span>Sample input (focus should stay inside the modal)</span>
          <input
            type="text"
            placeholder="Type here"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-200">
          <span>Another input to tab through</span>
          <input
            type="email"
            placeholder="email@example.com"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
      </ModalBody>

      <ModalFooter className="mt-6 flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 sm:w-auto"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
          onClick={onClose}
        >
          Confirm
        </button>
      </ModalFooter>
    </ModalShell>
  )
}

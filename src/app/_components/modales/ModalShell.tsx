"use client"

import {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "../ui/utils"

type ModalTheme = "light" | "dark"
type ModalSize = "sm" | "md" | "lg" | "xl"

const themeClasses: Record<ModalTheme, string> = {
  light:
    "bg-white text-gray-900 border border-gray-200 shadow-2xl shadow-black/5",
  dark:
    "bg-[#0a0f1f]/95 text-white border border-white/10 shadow-[0_0_40px_rgba(59,130,246,0.35)]",
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, details, [tabindex]:not([tabindex="-1"])'

const isFocusableElement = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && typeof el.focus === "function"

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return []
  const nodes = container.querySelectorAll(FOCUSABLE_SELECTOR)
  return Array.from(nodes).filter(
    (el): el is HTMLElement =>
      isFocusableElement(el) && !el.hasAttribute("disabled") && el.tabIndex !== -1 && el.offsetParent !== null,
  )
}

export interface ModalShellProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  theme?: ModalTheme
  size?: ModalSize
  showCloseButton?: boolean
  className?: string
  overlayClassName?: string
  ariaLabel?: string
  /**
   * When true, clicking on the overlay closes the modal (default: true).
   */
  closeOnOverlayClick?: boolean
  /**
   * When true, pressing Escape closes the modal (default: true).
   */
  closeOnEscape?: boolean
}

export function ModalShell({
  isOpen,
  onClose,
  children,
  theme = "light",
  size = "lg",
  showCloseButton = true,
  className,
  overlayClassName,
  ariaLabel,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalShellProps) {
  const titleId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)

  // Ensure we only render portal on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Capture the element that had focus before opening
  useEffect(() => {
    if (isOpen) {
      lastActiveElementRef.current = document.activeElement as HTMLElement | null
    }
  }, [isOpen])

  // Trap focus within the modal while open
  const focusTrap = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || event.key !== "Tab" || !contentRef.current) return

      const focusableElements = getFocusableElements(contentRef.current)

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const isShift = event.shiftKey
      const activeElement = document.activeElement

      if (!isShift && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      } else if (isShift && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    },
    [isOpen],
  )

  // Handle Esc to close + Tab trap
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && closeOnEscape) {
        event.preventDefault()
        onClose()
      } else if (event.key === "Tab") {
        focusTrap(event)
      }
    },
    [isOpen, onClose, focusTrap, closeOnEscape],
  )

  // Return focus to trigger on close
  useEffect(() => {
    if (!isOpen && lastActiveElementRef.current) {
      lastActiveElementRef.current.focus()
    }
  }, [isOpen])

  // Attach/detach keydown listener and set initial focus
  useEffect(() => {
    if (!isOpen) return

    const content = contentRef.current
    if (content) {
      const focusableElements = getFocusableElements(content)
      const focusTarget =
        focusableElements.find((el) => !el.hasAttribute("data-modal-ignore-autofocus")) ?? focusableElements[0]
      if (focusTarget) {
        focusTarget.focus()
      } else {
        content.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const handleOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!closeOnOverlayClick) return
      if (event.target === overlayRef.current) {
        onClose()
      }
    },
    [closeOnOverlayClick, onClose],
  )

  const ariaLabelledBy = useMemo(() => (ariaLabel ? undefined : titleId), [ariaLabel, titleId])

  // Don't render anything on server or before mount
  if (!mounted) return null

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className={cn(
            "fixed inset-0 z-[9999] flex min-h-screen items-center justify-center px-4 py-8 backdrop-blur-sm overflow-y-auto",
            overlayClassName,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ backgroundColor: "rgba(2, 6, 23, 0.65)" }}
          onClick={handleOverlayClick}
          aria-labelledby={ariaLabelledBy}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className={cn(
              "relative w-full rounded-2xl p-8 max-h-[90vh] overflow-y-auto",
              // Custom scrollbar styling (defined in globals.css)
              theme === "light" ? "modal-scrollbar-light" : "modal-scrollbar-dark",
              themeClasses[theme],
              sizeClasses[size],
              className,
            )}
            onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
            tabIndex={-1}
            aria-label={ariaLabel}
            id={ariaLabel ? undefined : titleId}
          >
            {showCloseButton && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className={cn(
                  "absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-offset-2",
                  theme === "light"
                    ? "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-gray-200"
                    : "border-white/20 text-white/80 hover:bg-white/10 hover:text-white focus-visible:ring-white/30",
                )}
              >
                <X className="size-4" />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // Render modal in a portal to document.body to avoid stacking context issues
  return createPortal(modalContent, document.body)
}

export function ModalHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("mb-6", className)}>{children}</div>
}

export function ModalBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("space-y-6", className)}>{children}</div>
}

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mt-8 flex gap-3", className)}>
      {children}
    </div>
  )
}

"use client"

import { ReactNode, useId, type MouseEvent } from "react"
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
}: ModalShellProps) {
  const titleId = useId()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm",
            overlayClassName,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ backgroundColor: "rgba(2, 6, 23, 0.65)" }}
          onClick={onClose}
          aria-labelledby={ariaLabel ? undefined : titleId}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className={cn(
              "relative w-full rounded-2xl p-8",
              themeClasses[theme],
              sizeClasses[size],
              className,
            )}
            onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
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
    <div className={cn("mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  )
}

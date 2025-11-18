"use client"

import { Switch } from "@headlessui/react"
import { ReactNode } from "react"

import { cn } from "./utils"

interface CyberSwitchProps {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  accentColor?: string
  className?: string
  size?: "base" | "compact"
  statusTextOn?: string
  statusTextOff?: string
}

const sizePadding: Record<NonNullable<CyberSwitchProps["size"]>, string> = {
  base: "p-5 sm:p-6",
  compact: "p-4",
}

export function CyberSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  accentColor = "#ff007f",
  className,
  size = "base",
  statusTextOn = "[ ACTIVE ]",
  statusTextOff = "[ DISABLED ]",
}: CyberSwitchProps) {
  const borderColor = accentColor
  const bgGlow = checked ? `${accentColor}33` : "rgba(59,130,246,0.15)"

  const handleToggle = () => {
    if (disabled) return
    onChange(!checked)
  }

  return (
    <div
      role="button"
      aria-pressed={checked}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          handleToggle()
        }
      }}
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-2xl border text-left transition-all duration-300",
        sizePadding[size],
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
      style={{
        borderColor,
        boxShadow: checked
          ? `0 0 25px ${borderColor}55, inset 0 0 18px ${borderColor}22`
          : "0 0 18px rgba(59,130,246,0.35), inset 0 0 18px rgba(59,130,246,0.15)",
        backgroundColor: "rgba(5,8,20,0.7)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `linear-gradient(135deg, ${bgGlow}, transparent 65%)`,
        }}
      />

      <div className="relative flex flex-col gap-4">
        <div className="space-y-2">
          <p
            className="text-[0.65rem] uppercase tracking-[0.4em] text-white"
            style={{
              color: checked ? borderColor : "rgba(226,232,240,0.8)",
              textShadow: `0 0 12px ${checked ? borderColor : "rgba(148,163,184,0.5)"}`,
              fontFamily: "monospace",
            }}
          >
            {label}
          </p>
          {description && (
            <div
              className="text-xs leading-relaxed text-white/70"
              style={{ fontFamily: "monospace" }}
            >
              {description}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.4em]"
            style={{
              color: checked ? borderColor : "rgba(226,232,240,0.6)",
              fontFamily: "monospace",
            }}
          >
            <span className="inline-flex h-2 w-2 rounded-full"
              style={{
                backgroundColor: borderColor,
                boxShadow: `0 0 10px ${borderColor}`,
              }}
            />
            {checked ? statusTextOn : statusTextOff}
          </div>

          <div className="flex justify-start sm:justify-end">
            <Switch
              checked={checked}
              disabled={disabled}
              onChange={(value) => {
                // Prevent double toggle when container already handled the click
                onChange(value)
              }}
              className="relative h-7 w-14 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              style={{
                borderColor,
                backgroundColor: checked ? `${borderColor}33` : "rgba(59,130,246,0.2)",
                boxShadow: checked
                  ? `0 0 18px ${borderColor}77, inset 0 0 10px ${borderColor}33`
                  : "0 0 18px rgba(59,130,246,0.35), inset 0 0 10px rgba(59,130,246,0.2)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="sr-only">{typeof label === "string" ? label : undefined}</span>
              <span
                aria-hidden
                className={"absolute top-0.5 h-5 w-5 rounded-full transition-all duration-300"}
                style={{
                  left: checked ? "calc(100% - 22px)" : "2px",
                  backgroundColor: borderColor,
                  boxShadow: `0 0 15px ${borderColor}, 0 0 35px ${borderColor}`,
                }}
              />
            </Switch>
          </div>
        </div>
      </div>
    </div>
  )
}

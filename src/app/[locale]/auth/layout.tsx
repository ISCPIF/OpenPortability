'use client'
import type { ReactNode } from 'react'
import Header from '@/app/_components/layouts/Header'
import Footer from '@/app/_components/layouts/Footer'
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground'
import { useTheme } from '@/hooks/useTheme'

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { colors } = useTheme()

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: colors.background }}
    >
      {/* Background behind everything */}
      <ParticulesBackground />

      {/* Header on top */}
      <div className="relative z-20">
        <Header />
      </div>

      {/* Main content centered */}
      <main className="relative z-10 flex-1 flex items-center justify-center">
        {children}
      </main>

      {/* Footer visible at bottom */}
      <div className="relative z-20">
        <Footer />
      </div>
    </div>
  )
}

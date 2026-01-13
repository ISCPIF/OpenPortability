import { auth } from "@/app/auth"
import { redirect } from "next/navigation"
import Header from '@/app/_components/layouts/Header'
import Footer from '@/app/_components/layouts/Footer'
import { ParticulesBackground } from '@/app/_components/layouts/ParticulesBackground'
import { quantico } from '@/app/fonts/plex'
import type { ReactNode } from 'react'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/auth/signin")
  }

  // Server components cannot use hooks directly; theme background is handled by ParticulesBackground layer.
  return (
    <div className={`${quantico.className} relative min-h-screen flex flex-col`}>
      <ParticulesBackground maskSourceId="dashboard" />
      <div className="relative z-20">
        <Header />
      </div>
      {/* Place content higher than sign-in: top padding, no vertical centering */}
      <main className="relative z-30 flex-1 flex flex-col items-center pt-8 sm:pt-10 md:pt-12 lg:pt-16">
        {children}
      </main>
      <div className="relative z-20">
        <Footer />
      </div>
    </div>
  )
}

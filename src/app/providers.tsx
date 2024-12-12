'use client'

import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {

    console.log("Session provider called !")
  return <SessionProvider>{children}</SessionProvider>
}
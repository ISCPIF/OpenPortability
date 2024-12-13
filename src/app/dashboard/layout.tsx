import { auth } from "@/app/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth();  
  if (!session?.user || !session) {
    redirect('/auth/signin');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex w-full flex-1 flex-col">
        {children}
      </main>
    </div>
  )
}
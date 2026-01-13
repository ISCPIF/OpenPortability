import { ReactNode } from 'react';
import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import Header from '@/app/_components/layouts/Header';
import Footer from '@/app/_components/layouts/Footer';
import { plex } from '../../fonts/plex';

export default async function ReconnectLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div className={`relative min-h-screen flex flex-col ${plex.className}`}>
      <div className="relative z-20">
        <Header />
      </div>
      <main className="relative z-30 flex-1 flex flex-col">
        {children}
      </main>
      <div className="relative z-20">
        <Footer />
      </div>
    </div>
  );
}
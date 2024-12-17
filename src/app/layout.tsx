import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, Space_Grotesk } from 'next/font/google'
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/app/auth";
import { MotionConfig } from "framer-motion";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk'
})

export const metadata: Metadata = {
  title: "HelloQuitteX",
  description: "Libérez vos espaces numériques",
};

async function getSession() {
  return await auth();
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${inter.className} antialiased`}>
        <Providers>
          <main className="min-h-screen">
            <MotionConfig reducedMotion="user">
              {children}
            </MotionConfig>
          </main>
        </Providers>
      </body>
    </html>
  );
}

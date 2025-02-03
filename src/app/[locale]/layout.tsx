import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, Space_Grotesk } from 'next/font/google'
import "../globals.css";
import { Providers } from "../providers";
import { auth } from "@/app/auth";
import { MotionConfig } from "framer-motion";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk'
})

export const metadata: Metadata = {
  title: "OpenPortability",
  description: "Libérez vos espaces numériques",
};

async function getSession() {
  return await auth();
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: Props) {
  const messages = await getMessages();
  const session = await getSession();
  const { locale } = await params;

  return (
    <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${inter.className} antialiased bg-gray-800`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers session={session}>
            <main className="min-h-screen">
              <MotionConfig reducedMotion="user">
                {children}
              </MotionConfig>
            </main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
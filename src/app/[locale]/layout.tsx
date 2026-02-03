import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, Space_Grotesk } from 'next/font/google'
import Script from "next/script";
import "../globals.css";
import { Providers } from "../providers";
import { auth } from "@/app/auth";
import { MotionWrapper } from "../_components/layouts/MotionWrapper";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Toaster } from 'sonner';
import { ReactScanWrapper } from "../_components/layouts/ReactScanWrapper";

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
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
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
      <head>
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="1ab53139-e458-4796-a0f5-ed330149637b"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${inter.className} antialiased bg-gray-800`}>
        <ReactScanWrapper>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <Providers session={session}>
              <main className="min-h-screen">
              <MotionWrapper>
              {children}
              </MotionWrapper>
              </main>
              <Toaster position="top-right" />
            </Providers>
          </NextIntlClientProvider>
        </ReactScanWrapper>
      </body>
    </html>
  );
}
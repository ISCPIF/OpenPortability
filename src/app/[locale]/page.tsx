import { redirect } from "next/navigation";
import { auth } from "../auth";
import { getLocale } from 'next-intl/server';

// Indiquer à Next.js que cette page est dynamique
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function Home() {
  const session = await auth();
  
  const locale = await getLocale();
  
  if (!session) {
    redirect(`/${locale}/auth/signin`);
  }
  
  // if (!session.user.has_onboarded){
  //   redirect(`/${locale}/dashboard`);
  // } else {
    redirect(`/${locale}/reconnect`);
  // }
}
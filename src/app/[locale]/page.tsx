import { redirect } from "next/navigation";
import { auth } from "../auth";
import { getLocale } from 'next-intl/server';

// Indiquer à Next.js que cette page est dynamique
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function Home() {
  console.log("🏠 [Home] Starting home page render...");
  
  try {
    const session = await auth();
    console.log("🔑 [Home] Session:", session ? "Found" : "Not found");
    
    const locale = await getLocale();
    console.log("🌍 [Home] Current locale:", locale);
    
    if (!session) {
      console.log("➡️ [Home] Redirecting to signin page...");
      redirect(`/${locale}/auth/signin`);
    }
    
    console.log("➡️ [Home] Redirecting to dashboard...");
    redirect(`/${locale}/dashboard`);
  } catch (error) {
    console.error("❌ [Home] Error:", error);
    throw error;
  }
}
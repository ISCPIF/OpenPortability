import { auth } from "./app/auth"
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['fr', 'en'];
const defaultLocale = 'en';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

export default auth(async (req) => {
  // Pour la racine, rediriger vers la page de connexion avec la locale
  if (req.nextUrl.pathname === '/') {
    const locale = req.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/auth/signin`, req.nextUrl));
  }

  // Pour tous les autres chemins, utiliser le middleware next-intl
  return intlMiddleware(req);
});

export const config = {
  matcher: ['/', '/(fr|en)/:path*']
};
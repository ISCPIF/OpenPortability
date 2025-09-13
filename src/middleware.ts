import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['fr', 'en', 'es', 'it', 'de', 'sv', 'pt'];
const defaultLocale = 'en';

// Create the i18n middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

// Middleware handler
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass i18n middleware for public OAuth discovery endpoints
  // e.g. /jwks.json, /client-metadata.json and locale-prefixed variants like /en/jwks.json
  const localePrefixPattern = `/(?:${locales.join('|')})`;
  const jwksOrMetadataPattern = /\/(jwks\.json|client-metadata\.json)$/;

  // Direct root paths
  if (jwksOrMetadataPattern.test(pathname)) {
    return NextResponse.next();
  }

  // Locale-prefixed paths
  const localePrefixed = new RegExp(`^${localePrefixPattern}${jwksOrMetadataPattern.source}`);
  if (localePrefixed.test(pathname)) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

// Add matcher configuration to limit middleware execution
export const config = {
  matcher: [
    // Skip all internal paths (_next), API routes, and static files
    // Keep the matcher broad; we bypass specific endpoints in the handler above
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
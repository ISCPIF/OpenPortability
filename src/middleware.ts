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

// List of deprecated cookies to delete (added 2026-01-14)
// These cookies were migrated to sessionStorage or are no longer needed
const DEPRECATED_COOKIES = [
  'hqx_lasso_selection',  // Migrated to sessionStorage for GDPR compliance
];

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

  // Get response from intl middleware
  const response = intlMiddleware(request);

  // Delete deprecated cookies by setting them with expired date
  for (const cookieName of DEPRECATED_COOKIES) {
    if (request.cookies.has(cookieName)) {
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
      });
    }
  }

  return response;
}

// Add matcher configuration to limit middleware execution
export const config = {
  matcher: [
    // Skip all internal paths (_next), API routes, and static files
    // Keep the matcher broad; we bypass specific endpoints in the handler above
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
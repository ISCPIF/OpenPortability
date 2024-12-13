import { auth } from "./app/auth"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default auth(async (req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')

  // Si on est sur la page d'accueil, rediriger vers /auth/signin
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/auth/signin', req.nextUrl))
  }

  // Not logged in: only allow auth pages
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth/signin', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
}
import { auth } from "./app/auth"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default auth(async (req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard')

  // Si on est sur la page d'accueil, rediriger vers /auth/signin
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/auth/signin', req.nextUrl))
  }

  // Not logged in: only allow auth pages
  if (!isLoggedIn && !isAuthPage) {
    let redirectUrl = new URL('/auth/signin', req.nextUrl)
    if (isDashboard) {
      redirectUrl.searchParams.set('callbackUrl', '/dashboard')
    }
    return NextResponse.redirect(redirectUrl)
  }

  // Logged in: don't allow auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
}
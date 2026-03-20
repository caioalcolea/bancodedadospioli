import { NextResponse } from 'next/server'

/**
 * Next.js middleware to inject internal API key for frontend requests.
 * External requests must provide their own API key.
 * Frontend (same-origin) requests get auto-authenticated.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl

  // Only handle /api/* routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Health check is always public
  if (pathname === '/api/health') return NextResponse.next()

  // If request already has auth, let it through
  if (request.headers.get('authorization') || request.headers.get('x-api-key')) {
    return NextResponse.next()
  }

  // For same-origin requests (frontend), inject internal API key
  const referer = request.headers.get('referer') || ''
  const origin = request.headers.get('origin') || ''
  const host = request.headers.get('host') || ''

  const isSameOrigin = referer.includes(host) || origin.includes(host) ||
    request.headers.get('sec-fetch-site') === 'same-origin'

  if (isSameOrigin && process.env.API_KEY) {
    const headers = new Headers(request.headers)
    headers.set('x-api-key', process.env.API_KEY)
    return NextResponse.next({ request: { headers } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*'
}

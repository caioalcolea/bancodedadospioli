import { NextResponse } from 'next/server'

/**
 * Validates API key from Authorization header or x-api-key header.
 * Returns null if valid, or a NextResponse error if invalid.
 *
 * If API_KEY env is not set, authentication is disabled (development mode).
 */
export function requireAuth(request) {
  const apiKey = process.env.API_KEY
  if (!apiKey) return null // Auth disabled if no API_KEY set

  const authHeader = request.headers.get('authorization')
  const xApiKey = request.headers.get('x-api-key')

  const token = authHeader?.replace('Bearer ', '') || xApiKey

  if (token !== apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid API key via Authorization: Bearer <key> or x-api-key header.' },
      { status: 401 }
    )
  }

  return null
}

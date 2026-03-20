import { NextResponse } from 'next/server'
import pool, { ensureInit, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

const MAX_LIMIT = 200

export async function GET(request) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '30') || 30))
  const offset = (page - 1) * limit

  try {
    await ensureInit()
    const countResult = await pool.query('SELECT COUNT(*) FROM _webhook_logs')
    const result = await pool.query(
      'SELECT * FROM _webhook_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    )
    return NextResponse.json({
      data: result.rows,
      pagination: {
        page, limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

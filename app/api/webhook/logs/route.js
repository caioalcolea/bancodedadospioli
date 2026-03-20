import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '30')
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
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

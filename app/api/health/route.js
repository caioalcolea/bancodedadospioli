import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'

export async function GET() {
  try {
    await ensureInit()
    const result = await pool.query('SELECT NOW()')
    return NextResponse.json({ status: 'ok', timestamp: result.rows[0].now })
  } catch (err) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'

export async function GET() {
  try {
    await ensureInit()
    const result = await pool.query('SELECT NOW()')
    const poolInfo = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    return NextResponse.json({ status: 'ok', timestamp: result.rows[0].now, pool: poolInfo })
  } catch (err) {
    return NextResponse.json({ status: 'error', message: 'Database connection failed' }, { status: 500 })
  }
}

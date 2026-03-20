import { NextResponse } from 'next/server'
import pool, { isValidTable, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table } = await params
  try {
    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    )
    return NextResponse.json(result.rows)
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table } = await params
  try {
    // Only allow deleting tables we manage
    const managed = await pool.query('SELECT table_name FROM _meta_tables WHERE table_name = $1', [table])
    if (managed.rows.length === 0) {
      return NextResponse.json({ error: 'Table not found or not managed by this system' }, { status: 404 })
    }

    await pool.query(`DROP TABLE IF EXISTS "${table}"`)
    await pool.query('DELETE FROM _meta_tables WHERE table_name = $1', [table])
    return NextResponse.json({ message: `Table "${table}" deleted` })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

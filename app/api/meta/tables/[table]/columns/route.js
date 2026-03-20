import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request, { params }) {
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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { table } = await params
  try {
    await pool.query(`DROP TABLE IF EXISTS "${table}"`)
    await pool.query('DELETE FROM _meta_tables WHERE table_name = $1', [table])
    return NextResponse.json({ message: `Table "${table}" deleted` })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

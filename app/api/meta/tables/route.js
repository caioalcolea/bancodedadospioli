import { NextResponse } from 'next/server'
import pool, { ensureInit, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  try {
    await ensureInit()
    const result = await pool.query(`
      SELECT t.table_name, t.display_name, t.description, t.columns, t.created_at, t.updated_at
      FROM _meta_tables t ORDER BY t.table_name
    `)

    const tables = []
    for (const row of result.rows) {
      let rowCount = 0
      try {
        const c = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`)
        rowCount = parseInt(c.rows[0].count)
      } catch (e) { /* table might not exist */ }
      tables.push({ ...row, row_count: rowCount })
    }

    return NextResponse.json(tables)
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

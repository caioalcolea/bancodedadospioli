import { NextResponse } from 'next/server'
import pool, { ensureInit, isValidTable, getTableColumns, filterValidColumns, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table, id } = await params
  try {
    await ensureInit()
    if (!(await isValidTable(table))) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }
    const result = await pool.query(`SELECT * FROM "${table}" WHERE id = $1`, [id])
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table, id } = await params
  try {
    await ensureInit()
    if (!(await isValidTable(table))) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const validColumns = await getTableColumns(table)
    const body = await request.json()
    const data = filterValidColumns(body, validColumns)

    const keys = Object.keys(data)
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No valid columns provided' }, { status: 400 })
    }

    const values = Object.values(data)
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
    values.push(id)

    const result = await pool.query(
      `UPDATE "${table}" SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table, id } = await params
  try {
    await ensureInit()
    if (!(await isValidTable(table))) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }
    const result = await pool.query(`DELETE FROM "${table}" WHERE id = $1 RETURNING *`, [id])
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Deleted', record: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

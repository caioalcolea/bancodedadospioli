import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request, { params }) {
  const { table, id } = await params
  try {
    const result = await pool.query(`SELECT * FROM "${table}" WHERE id = $1`, [id])
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const { table, id } = await params
  const data = await request.json()

  try {
    const keys = Object.keys(data)
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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { table, id } = await params
  try {
    const result = await pool.query(`DELETE FROM "${table}" WHERE id = $1 RETURNING *`, [id])
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Deleted', record: result.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'

export async function GET(request, { params }) {
  const { table } = await params
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const sort = searchParams.get('sort')
  const order = searchParams.get('order') || 'asc'
  const search = searchParams.get('search')

  try {
    await ensureInit()

    // Verify table exists
    const tableCheck = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['public', table]
    )
    if (tableCheck.rows.length === 0) {
      return NextResponse.json({ error: `Table "${table}" not found` }, { status: 404 })
    }

    let query = `SELECT * FROM "${table}"`
    const values = []
    const conditions = []
    let paramIdx = 1

    // Collect filter params (exclude known params)
    const reserved = ['page', 'limit', 'sort', 'order', 'search']
    for (const [key, value] of searchParams.entries()) {
      if (!reserved.includes(key)) {
        conditions.push(`"${key}"::text ILIKE $${paramIdx}`)
        values.push(`%${value}%`)
        paramIdx++
      }
    }

    // Search across all text columns
    if (search) {
      const cols = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      )
      const searchConds = cols.rows.map(col => {
        values.push(`%${search}%`)
        return `"${col.column_name}"::text ILIKE $${paramIdx++}`
      })
      if (searchConds.length > 0) {
        conditions.push(`(${searchConds.join(' OR ')})`)
      }
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

    // Count
    const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"${whereClause}`, values)
    const total = parseInt(countResult.rows[0].count)

    // Sort
    if (sort) {
      query += whereClause + ` ORDER BY "${sort}" ${order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`
    } else {
      query += whereClause + ' ORDER BY id ASC'
    }

    // Paginate
    const offset = (page - 1) * limit
    query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`
    values.push(limit, offset)

    const result = await pool.query(query, values)

    return NextResponse.json({
      data: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  const { table } = await params
  const data = await request.json()

  try {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const placeholders = keys.map((_, i) => `$${i + 1}`)

    const result = await pool.query(
      `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

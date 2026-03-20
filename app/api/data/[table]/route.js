import { NextResponse } from 'next/server'
import pool, { ensureInit, isValidTable, getTableColumns, filterValidColumns, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

const MAX_LIMIT = 500

export async function GET(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table } = await params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50))
  const sort = searchParams.get('sort')
  const order = searchParams.get('order') || 'asc'
  const search = searchParams.get('search')

  try {
    await ensureInit()

    if (!(await isValidTable(table))) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const validColumns = await getTableColumns(table)

    let query = `SELECT * FROM "${table}"`
    const values = []
    const conditions = []
    let paramIdx = 1

    // Collect filter params (only valid columns)
    const reserved = ['page', 'limit', 'sort', 'order', 'search']
    for (const [key, value] of searchParams.entries()) {
      if (!reserved.includes(key) && validColumns.includes(key)) {
        conditions.push(`"${key}"::text ILIKE $${paramIdx}`)
        values.push(`%${value}%`)
        paramIdx++
      }
    }

    // Search across all text columns
    if (search) {
      const searchConds = validColumns.map(col => {
        values.push(`%${search}%`)
        return `"${col}"::text ILIKE $${paramIdx++}`
      })
      if (searchConds.length > 0) {
        conditions.push(`(${searchConds.join(' OR ')})`)
      }
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

    // Count
    const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"${whereClause}`, values)
    const total = parseInt(countResult.rows[0].count)

    // Sort - validate column name
    if (sort && validColumns.includes(sort)) {
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
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table } = await params

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
    const placeholders = keys.map((_, i) => `$${i + 1}`)

    const result = await pool.query(
      `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

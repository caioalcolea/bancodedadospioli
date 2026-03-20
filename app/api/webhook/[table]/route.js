import { NextResponse } from 'next/server'
import pool, { ensureInit, isValidTable, getTableColumns, filterValidColumns, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

async function logWebhook(table, action, recordCount, ip, status, error = null) {
  try {
    await pool.query(
      'INSERT INTO _webhook_logs (table_name, action, payload, ip_address, status, error_message) VALUES ($1, $2, $3, $4, $5, $6)',
      [table, action, JSON.stringify({ records: recordCount }), ip, status, error]
    )
  } catch (e) {
    console.error('Log webhook error:', e.message)
  }
}

export async function POST(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table } = await params
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  try {
    await ensureInit()

    if (!(await isValidTable(table))) {
      await logWebhook(table, 'error', 0, ip, 'error', `Table "${table}" not found`)
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const body = await request.json()
    const { match_field, ...rawData } = body
    const validColumns = await getTableColumns(table)
    const data = filterValidColumns(rawData, validColumns)

    const keys = Object.keys(data)
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No valid columns provided' }, { status: 400 })
    }

    // Validate match_field if provided
    if (match_field && !validColumns.includes(match_field)) {
      return NextResponse.json({ error: `Invalid match_field: "${match_field}"` }, { status: 400 })
    }

    if (match_field && data[match_field] !== undefined) {
      const existing = await pool.query(
        `SELECT id FROM "${table}" WHERE "${match_field}" = $1 LIMIT 1`,
        [data[match_field]]
      )

      if (existing.rows.length > 0) {
        const values = Object.values(data)
        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
        values.push(existing.rows[0].id)

        const result = await pool.query(
          `UPDATE "${table}" SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
          values
        )
        await logWebhook(table, 'update', 1, ip, 'success')
        return NextResponse.json({ action: 'updated', record: result.rows[0] })
      }
    }

    // Insert new record
    const values = Object.values(data)
    const placeholders = keys.map((_, i) => `$${i + 1}`)

    const result = await pool.query(
      `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    )

    await logWebhook(table, 'insert', 1, ip, 'success')
    return NextResponse.json({ action: 'created', record: result.rows[0] }, { status: 201 })
  } catch (err) {
    await logWebhook(table, 'error', 0, ip, 'error', err.message)
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

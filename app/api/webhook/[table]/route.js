import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'

async function logWebhook(table, action, payload, ip, status, error = null) {
  try {
    await pool.query(
      'INSERT INTO _webhook_logs (table_name, action, payload, ip_address, status, error_message) VALUES ($1, $2, $3, $4, $5, $6)',
      [table, action, JSON.stringify(payload), ip, status, error]
    )
  } catch (e) {
    console.error('Log webhook error:', e.message)
  }
}

export async function POST(request, { params }) {
  const { table } = await params
  const ip = request.headers.get('x-forwarded-for') || 'unknown'

  try {
    await ensureInit()
    const body = await request.json()
    const { match_field, ...data } = body

    // Verify table exists
    const tableCheck = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['public', table]
    )
    if (tableCheck.rows.length === 0) {
      await logWebhook(table, 'upsert', body, ip, 'error', `Table "${table}" not found`)
      return NextResponse.json({ error: `Table "${table}" not found` }, { status: 404 })
    }

    const payload = { ...data }

    if (match_field && payload[match_field] !== undefined) {
      const existing = await pool.query(
        `SELECT id FROM "${table}" WHERE "${match_field}" = $1 LIMIT 1`,
        [payload[match_field]]
      )

      if (existing.rows.length > 0) {
        const keys = Object.keys(payload)
        const values = Object.values(payload)
        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
        values.push(existing.rows[0].id)

        const result = await pool.query(
          `UPDATE "${table}" SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
          values
        )
        await logWebhook(table, 'update', body, ip, 'success')
        return NextResponse.json({ action: 'updated', record: result.rows[0] })
      }
    }

    const keys = Object.keys(payload)
    const values = Object.values(payload)
    const placeholders = keys.map((_, i) => `$${i + 1}`)

    const result = await pool.query(
      `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    )

    await logWebhook(table, 'insert', body, ip, 'success')
    return NextResponse.json({ action: 'created', record: result.rows[0] }, { status: 201 })
  } catch (err) {
    await logWebhook(table, 'error', {}, ip, 'error', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'

export async function POST(request, { params }) {
  const { table } = await params
  const ip = request.headers.get('x-forwarded-for') || 'unknown'

  try {
    await ensureInit()
    const { records, match_field } = await request.json()

    if (!Array.isArray(records)) {
      return NextResponse.json({ error: 'Body must contain a "records" array' }, { status: 400 })
    }

    const results = { inserted: 0, updated: 0, errors: [] }

    for (const record of records) {
      try {
        if (match_field && record[match_field] !== undefined) {
          const existing = await pool.query(
            `SELECT id FROM "${table}" WHERE "${match_field}" = $1 LIMIT 1`,
            [record[match_field]]
          )

          if (existing.rows.length > 0) {
            const keys = Object.keys(record)
            const values = Object.values(record)
            const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
            values.push(existing.rows[0].id)
            await pool.query(`UPDATE "${table}" SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`, values)
            results.updated++
            continue
          }
        }

        const keys = Object.keys(record)
        const values = Object.values(record)
        const placeholders = keys.map((_, i) => `$${i + 1}`)
        await pool.query(
          `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
          values
        )
        results.inserted++
      } catch (err) {
        results.errors.push({ record, error: err.message })
      }
    }

    await pool.query(
      'INSERT INTO _webhook_logs (table_name, action, payload, ip_address, status) VALUES ($1, $2, $3, $4, $5)',
      [table, 'batch', JSON.stringify({ total: records.length }), ip, 'success']
    )

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

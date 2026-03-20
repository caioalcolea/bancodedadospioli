import { NextResponse } from 'next/server'
import pool, { ensureInit, isValidTable, getTableColumns, filterValidColumns, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

const MAX_BATCH_SIZE = 1000

export async function POST(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table } = await params
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  try {
    await ensureInit()

    if (!(await isValidTable(table))) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const body = await request.json()
    const { records, match_field } = body

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Body must contain a non-empty "records" array' }, { status: 400 })
    }

    if (records.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` }, { status: 400 })
    }

    const validColumns = await getTableColumns(table)

    // Validate match_field
    if (match_field && !validColumns.includes(match_field)) {
      return NextResponse.json({ error: `Invalid match_field: "${match_field}"` }, { status: 400 })
    }

    const results = { inserted: 0, updated: 0, errors: [] }
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      for (const rawRecord of records) {
        try {
          const record = filterValidColumns(rawRecord, validColumns)
          const keys = Object.keys(record)
          if (keys.length === 0) continue

          if (match_field && record[match_field] !== undefined) {
            const existing = await client.query(
              `SELECT id FROM "${table}" WHERE "${match_field}" = $1 LIMIT 1`,
              [record[match_field]]
            )

            if (existing.rows.length > 0) {
              const values = Object.values(record)
              const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
              values.push(existing.rows[0].id)
              await client.query(`UPDATE "${table}" SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`, values)
              results.updated++
              continue
            }
          }

          const values = Object.values(record)
          const placeholders = values.map((_, i) => `$${i + 1}`)
          await client.query(
            `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          )
          results.inserted++
        } catch (err) {
          results.errors.push({ error: err.message })
        }
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    await pool.query(
      'INSERT INTO _webhook_logs (table_name, action, payload, ip_address, status) VALUES ($1, $2, $3, $4, $5)',
      [table, 'batch', JSON.stringify({ total: records.length, inserted: results.inserted, updated: results.updated }), ip, 'success']
    )

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

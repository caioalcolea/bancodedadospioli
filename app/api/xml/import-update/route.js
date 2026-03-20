import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'
import { XMLParser } from 'fast-xml-parser'

export async function POST(request) {
  try {
    await ensureInit()
    const { searchParams } = new URL(request.url)

    let xmlData, matchField
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      xmlData = await file.text()
      matchField = formData.get('match_field') || searchParams.get('match_field')
    } else {
      const body = await request.json()
      xmlData = body.xml
      matchField = body.match_field || searchParams.get('match_field')
    }

    if (!xmlData) return NextResponse.json({ error: 'No XML data provided' }, { status: 400 })

    const parser = new XMLParser({
      ignoreAttributes: false, attributeNamePrefix: '',
      parseAttributeValue: true, trimValues: true
    })
    const parsed = parser.parse(xmlData)
    const database = parsed.database
    if (!database?.table) return NextResponse.json({ error: 'Invalid XML format' }, { status: 400 })

    const tables = Array.isArray(database.table) ? database.table : [database.table]
    const results = []

    for (const table of tables) {
      const tableName = table.name
      const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column]
      const colNames = columns.map(c => c.name)
      const field = matchField || colNames[0]

      let inserted = 0, updated = 0

      if (table.rows?.row) {
        const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row]

        for (const row of rows) {
          const matchValue = row[field]
          if (matchValue !== undefined) {
            const existing = await pool.query(
              `SELECT id FROM "${tableName}" WHERE "${field}" = $1 LIMIT 1`,
              [matchValue]
            )

            if (existing.rows.length > 0) {
              const updateCols = colNames.filter(c => c !== field && row[c] !== undefined)
              if (updateCols.length > 0) {
                const setItems = updateCols.map((c, i) => `"${c}" = $${i + 1}`)
                const setValues = updateCols.map(c => row[c])
                setValues.push(existing.rows[0].id)
                await pool.query(
                  `UPDATE "${tableName}" SET ${setItems.join(', ')}, updated_at = NOW() WHERE id = $${setValues.length}`,
                  setValues
                )
              }
              updated++
              continue
            }
          }

          const values = colNames.map(col => row[col] !== undefined ? row[col] : null)
          const placeholders = values.map((_, i) => `$${i + 1}`)
          await pool.query(
            `INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          )
          inserted++
        }
      }

      results.push({ table: tableName, inserted, updated })
    }

    return NextResponse.json({ success: true, tables: results })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

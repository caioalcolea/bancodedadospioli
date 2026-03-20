import { NextResponse } from 'next/server'
import pool, { ensureInit, isValidTable, getTableColumns, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { XMLParser } from 'fast-xml-parser'

const MAX_XML_SIZE = 50 * 1024 * 1024

export async function POST(request) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  try {
    await ensureInit()
    const { searchParams } = new URL(request.url)

    let xmlData, matchField
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      if (file.size > MAX_XML_SIZE) return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
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
      parseAttributeValue: false, trimValues: true,
      processEntities: false,
    })
    const parsed = parser.parse(xmlData)
    const database = parsed.database
    if (!database?.table) return NextResponse.json({ error: 'Invalid XML format' }, { status: 400 })

    const tables = Array.isArray(database.table) ? database.table : [database.table]
    const results = []

    for (const table of tables) {
      const tableName = table.name

      if (!(await isValidTable(tableName))) {
        results.push({ table: tableName, error: 'Table not found' })
        continue
      }

      const validColumns = await getTableColumns(tableName)
      const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column]
      const colNames = columns.map(c => c.name).filter(c => validColumns.includes(c))
      const field = matchField || colNames[0]

      if (!validColumns.includes(field)) {
        results.push({ table: tableName, error: `Invalid match_field: "${field}"` })
        continue
      }

      let inserted = 0, updated = 0

      if (table.rows?.row) {
        const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row]

        const BATCH_SIZE = 200
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            for (const row of batch) {
              const matchValue = row[field]
              if (matchValue !== undefined) {
                const existing = await client.query(
                  `SELECT id FROM "${tableName}" WHERE "${field}" = $1 LIMIT 1`,
                  [String(matchValue)]
                )

                if (existing.rows.length > 0) {
                  const updateCols = colNames.filter(c => c !== field && row[c] !== undefined)
                  if (updateCols.length > 0) {
                    const setItems = updateCols.map((c, j) => `"${c}" = $${j + 1}`)
                    const setValues = updateCols.map(c => String(row[c]))
                    setValues.push(existing.rows[0].id)
                    await client.query(
                      `UPDATE "${tableName}" SET ${setItems.join(', ')}, updated_at = NOW() WHERE id = $${setValues.length}`,
                      setValues
                    )
                  }
                  updated++
                  continue
                }
              }

              const values = colNames.map(col => row[col] !== undefined && row[col] !== '' ? String(row[col]) : null)
              const ph = values.map((_, j) => `$${j + 1}`)
              await client.query(
                `INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${ph.join(', ')})`,
                values
              )
              inserted++
            }
            await client.query('COMMIT')
          } catch (err) {
            await client.query('ROLLBACK')
            console.error(`Import-update batch error at row ${i}:`, err.message)
          } finally {
            client.release()
          }
        }
      }

      results.push({ table: tableName, inserted, updated })
    }

    return NextResponse.json({ success: true, tables: results })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

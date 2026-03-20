import { NextResponse } from 'next/server'
import pool, { ensureInit, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { XMLParser } from 'fast-xml-parser'

const MAX_XML_SIZE = 50 * 1024 * 1024 // 50MB
const VALID_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i

function mapXmlTypeToPg(xmlType) {
  const map = {
    text: 'TEXT', string: 'TEXT', integer: 'INTEGER', int: 'INTEGER',
    number: 'NUMERIC', float: 'NUMERIC', decimal: 'NUMERIC',
    boolean: 'BOOLEAN', bool: 'BOOLEAN', date: 'DATE',
    datetime: 'TIMESTAMP', timestamp: 'TIMESTAMP'
  }
  return map[(xmlType || 'text').toLowerCase()] || 'TEXT'
}

function sanitizeIdentifier(name) {
  return String(name).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
}

export async function POST(request) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  try {
    await ensureInit()

    let xmlData
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      if (file.size > MAX_XML_SIZE) return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })
      xmlData = await file.text()
    } else {
      const body = await request.json()
      xmlData = body.xml
    }

    if (!xmlData) return NextResponse.json({ error: 'No XML data provided' }, { status: 400 })

    const parser = new XMLParser({
      ignoreAttributes: false, attributeNamePrefix: '',
      parseAttributeValue: false, trimValues: true,
      processEntities: false, // Prevent XXE
    })
    const parsed = parser.parse(xmlData)

    const database = parsed.database
    if (!database?.table) {
      return NextResponse.json({ error: 'Invalid XML format. Expected <database><table>...</table></database>' }, { status: 400 })
    }

    const tables = Array.isArray(database.table) ? database.table : [database.table]
    const results = []

    for (const table of tables) {
      const tableName = sanitizeIdentifier(table.name)
      if (!VALID_IDENTIFIER.test(tableName)) {
        results.push({ table: tableName, error: 'Invalid table name' })
        continue
      }

      const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column]
      const safeColumns = columns.map(col => ({
        name: sanitizeIdentifier(col.name),
        type: col.type || 'text'
      })).filter(col => VALID_IDENTIFIER.test(col.name))

      const colDefs = safeColumns.map(col => `"${col.name}" ${mapXmlTypeToPg(col.type)}`)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id SERIAL PRIMARY KEY,
          ${colDefs.join(',\n          ')},
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)

      await pool.query(`
        INSERT INTO _meta_tables (table_name, display_name, columns)
        VALUES ($1, $2, $3)
        ON CONFLICT (table_name) DO UPDATE SET columns = $3, updated_at = NOW()
      `, [tableName, table.display_name || tableName, JSON.stringify(safeColumns)])

      let inserted = 0
      if (table.rows?.row) {
        const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row]
        const colNames = safeColumns.map(c => c.name)

        // Batch insert using transactions
        const BATCH_SIZE = 200
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            for (const row of batch) {
              const values = colNames.map(col => {
                const val = row[col]
                return val !== undefined && val !== '' ? String(val) : null
              })
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
            console.error(`Import batch error at row ${i}:`, err.message)
          } finally {
            client.release()
          }
        }
      }

      results.push({ table: tableName, columns: safeColumns.length, rows_inserted: inserted })
    }

    return NextResponse.json({ success: true, tables: results })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

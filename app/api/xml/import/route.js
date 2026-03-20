import { NextResponse } from 'next/server'
import pool, { ensureInit } from '@/lib/db'
import { XMLParser } from 'fast-xml-parser'

function mapXmlTypeToPg(xmlType) {
  const map = {
    text: 'TEXT', string: 'TEXT', integer: 'INTEGER', int: 'INTEGER',
    number: 'NUMERIC', float: 'NUMERIC', decimal: 'NUMERIC',
    boolean: 'BOOLEAN', bool: 'BOOLEAN', date: 'DATE',
    datetime: 'TIMESTAMP', timestamp: 'TIMESTAMP'
  }
  return map[(xmlType || 'text').toLowerCase()] || 'TEXT'
}

export async function POST(request) {
  try {
    await ensureInit()

    let xmlData
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      xmlData = await file.text()
    } else {
      const body = await request.json()
      xmlData = body.xml
    }

    if (!xmlData) return NextResponse.json({ error: 'No XML data provided' }, { status: 400 })

    const parser = new XMLParser({
      ignoreAttributes: false, attributeNamePrefix: '',
      parseAttributeValue: true, trimValues: true
    })
    const parsed = parser.parse(xmlData)

    const database = parsed.database
    if (!database?.table) {
      return NextResponse.json({ error: 'Invalid XML format. Expected <database><table>...</table></database>' }, { status: 400 })
    }

    const tables = Array.isArray(database.table) ? database.table : [database.table]
    const results = []

    for (const table of tables) {
      const tableName = table.name
      const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column]

      const colDefs = columns.map(col => `"${col.name}" ${mapXmlTypeToPg(col.type)}`)

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
      `, [tableName, table.display_name || tableName, JSON.stringify(columns)])

      let inserted = 0
      if (table.rows?.row) {
        const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row]
        const colNames = columns.map(c => c.name)

        for (const row of rows) {
          const values = colNames.map(col => row[col] !== undefined ? row[col] : null)
          const placeholders = values.map((_, i) => `$${i + 1}`)
          await pool.query(
            `INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          )
          inserted++
        }
      }

      results.push({ table: tableName, columns: columns.length, rows_inserted: inserted })
    }

    return NextResponse.json({ success: true, tables: results })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

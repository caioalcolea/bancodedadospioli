import { NextResponse } from 'next/server'
import pool, { isValidTable, safeError } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { XMLBuilder } from 'fast-xml-parser'

function mapPgTypeToXml(pgType) {
  const map = {
    text: 'text', 'character varying': 'text', integer: 'integer',
    bigint: 'integer', numeric: 'number', 'double precision': 'number',
    boolean: 'boolean', date: 'date',
    'timestamp without time zone': 'datetime', 'timestamp with time zone': 'datetime'
  }
  return map[pgType] || 'text'
}

export async function GET(request, { params }) {
  const authErr = requireAuth(request)
  if (authErr) return authErr

  const { table } = await params

  try {
    if (!(await isValidTable(table))) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }

    const colsResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       AND column_name NOT IN ('id', 'created_at', 'updated_at')
       ORDER BY ordinal_position`,
      [table]
    )

    const dataResult = await pool.query(`SELECT * FROM "${table}" ORDER BY id`)

    const columns = colsResult.rows.map(col => ({
      name: col.column_name,
      type: mapPgTypeToXml(col.data_type)
    }))

    const rows = dataResult.rows.map(row => {
      const xmlRow = {}
      for (const col of columns) {
        xmlRow[col.name] = row[col.name] !== null ? row[col.name] : ''
      }
      return xmlRow
    })

    const xmlObj = {
      database: {
        table: {
          name: table, display_name: table,
          columns: { column: columns },
          rows: { row: rows }
        }
      }
    }

    const builder = new XMLBuilder({
      ignoreAttributes: false, attributeNamePrefix: '',
      format: true, indentBy: '  '
    })

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(xmlObj)
    const safeFilename = table.replace(/[^a-zA-Z0-9_-]/g, '_')

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename}.xml"`
      }
    })
  } catch (err) {
    return NextResponse.json({ error: safeError(err) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import pool from '@/lib/db'
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
  const { table } = await params

  try {
    const colsResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       AND column_name NOT IN ('id', 'created_at', 'updated_at')
       ORDER BY ordinal_position`,
      [table]
    )

    if (colsResult.rows.length === 0) {
      return NextResponse.json({ error: `Table "${table}" not found` }, { status: 404 })
    }

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

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${table}.xml"`
      }
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

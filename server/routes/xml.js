const express = require('express');
const multer = require('multer');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/xml/import - Import XML data (creates table if needed)
router.post('/import', upload.single('file'), async (req, res) => {
  const pool = req.app.locals.pool;

  try {
    let xmlData;
    if (req.file) {
      xmlData = req.file.buffer.toString('utf-8');
    } else if (req.body.xml) {
      xmlData = req.body.xml;
    } else {
      return res.status(400).json({ error: 'Send XML as file upload or in "xml" body field' });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true
    });
    const parsed = parser.parse(xmlData);

    // Expected format: <database><table name="table_name"><columns><column name="col" type="text"/></columns><rows><row><col>value</col></row></rows></table></database>
    const database = parsed.database;
    if (!database || !database.table) {
      return res.status(400).json({ error: 'Invalid XML format. Expected <database><table>...</table></database>' });
    }

    const tables = Array.isArray(database.table) ? database.table : [database.table];
    const results = [];

    for (const table of tables) {
      const tableName = table.name;
      const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column];

      // Create table if not exists
      const colDefs = columns.map(col => {
        const pgType = mapXmlTypeToPg(col.type || 'text');
        return `"${col.name}" ${pgType}`;
      });

      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id SERIAL PRIMARY KEY,
          ${colDefs.join(',\n          ')},
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Register in meta
      await pool.query(`
        INSERT INTO _meta_tables (table_name, display_name, columns)
        VALUES ($1, $2, $3)
        ON CONFLICT (table_name) DO UPDATE SET columns = $3, updated_at = NOW()
      `, [tableName, table.display_name || tableName, JSON.stringify(columns)]);

      // Insert rows
      let inserted = 0;
      if (table.rows && table.rows.row) {
        const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row];
        const colNames = columns.map(c => c.name);

        for (const row of rows) {
          const values = colNames.map(col => row[col] !== undefined ? row[col] : null);
          const placeholders = values.map((_, i) => `$${i + 1}`);

          await pool.query(
            `INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          inserted++;
        }
      }

      results.push({ table: tableName, columns: columns.length, rows_inserted: inserted });
    }

    res.json({ success: true, tables: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/xml/import-update - Import XML and update existing records (upsert by match_field)
router.post('/import-update', upload.single('file'), async (req, res) => {
  const pool = req.app.locals.pool;
  const matchField = req.body.match_field || req.query.match_field;

  try {
    let xmlData;
    if (req.file) {
      xmlData = req.file.buffer.toString('utf-8');
    } else if (req.body.xml) {
      xmlData = req.body.xml;
    } else {
      return res.status(400).json({ error: 'Send XML as file upload or in "xml" body field' });
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true
    });
    const parsed = parser.parse(xmlData);
    const database = parsed.database;
    if (!database || !database.table) {
      return res.status(400).json({ error: 'Invalid XML format' });
    }

    const tables = Array.isArray(database.table) ? database.table : [database.table];
    const results = [];

    for (const table of tables) {
      const tableName = table.name;
      const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column];
      const colNames = columns.map(c => c.name);
      const field = matchField || colNames[0]; // default to first column

      let inserted = 0, updated = 0;

      if (table.rows && table.rows.row) {
        const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row];

        for (const row of rows) {
          const matchValue = row[field];
          if (matchValue !== undefined) {
            const existing = await pool.query(
              `SELECT id FROM "${tableName}" WHERE "${field}" = $1 LIMIT 1`,
              [matchValue]
            );

            if (existing.rows.length > 0) {
              const setItems = colNames
                .filter(c => c !== field && row[c] !== undefined)
                .map((c, i) => `"${c}" = $${i + 1}`);
              const setValues = colNames
                .filter(c => c !== field && row[c] !== undefined)
                .map(c => row[c]);
              setValues.push(existing.rows[0].id);

              if (setItems.length > 0) {
                await pool.query(
                  `UPDATE "${tableName}" SET ${setItems.join(', ')}, updated_at = NOW() WHERE id = $${setValues.length}`,
                  setValues
                );
              }
              updated++;
              continue;
            }
          }

          const values = colNames.map(col => row[col] !== undefined ? row[col] : null);
          const placeholders = values.map((_, i) => `$${i + 1}`);
          await pool.query(
            `INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
            values
          );
          inserted++;
        }
      }

      results.push({ table: tableName, inserted, updated });
    }

    res.json({ success: true, tables: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/xml/export/:table - Export table as XML
router.get('/export/:table', async (req, res) => {
  const pool = req.app.locals.pool;
  const { table } = req.params;

  try {
    // Get columns info
    const colsResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       AND column_name NOT IN ('id', 'created_at', 'updated_at')
       ORDER BY ordinal_position`,
      [table]
    );

    if (colsResult.rows.length === 0) {
      return res.status(404).json({ error: `Table "${table}" not found` });
    }

    // Get all data
    const dataResult = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);

    const columns = colsResult.rows.map(col => ({
      name: col.column_name,
      type: mapPgTypeToXml(col.data_type)
    }));

    const rows = dataResult.rows.map(row => {
      const xmlRow = {};
      for (const col of columns) {
        xmlRow[col.name] = row[col.name] !== null ? row[col.name] : '';
      }
      return xmlRow;
    });

    const xmlObj = {
      database: {
        table: {
          name: table,
          display_name: table,
          columns: { column: columns },
          rows: { row: rows }
        }
      }
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      format: true,
      indentBy: '  '
    });

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(xmlObj);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${table}.xml"`);
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function mapXmlTypeToPg(xmlType) {
  const map = {
    'text': 'TEXT',
    'string': 'TEXT',
    'integer': 'INTEGER',
    'int': 'INTEGER',
    'number': 'NUMERIC',
    'float': 'NUMERIC',
    'decimal': 'NUMERIC',
    'boolean': 'BOOLEAN',
    'bool': 'BOOLEAN',
    'date': 'DATE',
    'datetime': 'TIMESTAMP',
    'timestamp': 'TIMESTAMP'
  };
  return map[xmlType.toLowerCase()] || 'TEXT';
}

function mapPgTypeToXml(pgType) {
  const map = {
    'text': 'text',
    'character varying': 'text',
    'integer': 'integer',
    'bigint': 'integer',
    'numeric': 'number',
    'double precision': 'number',
    'boolean': 'boolean',
    'date': 'date',
    'timestamp without time zone': 'datetime',
    'timestamp with time zone': 'datetime'
  };
  return map[pgType] || 'text';
}

module.exports = router;

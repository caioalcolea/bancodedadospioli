/**
 * Seeds the database from XML files in /data directory.
 * Usage: node scripts/seed.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const DATA_DIR = path.join(__dirname, '../data');

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:894291802448b50603a3ca64f5f43f01@localhost:5432/bancodedadospioli'
  });

  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS _meta_tables (
      id SERIAL PRIMARY KEY, table_name VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255), description TEXT, columns JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS _webhook_logs (
      id SERIAL PRIMARY KEY, table_name VARCHAR(255), action VARCHAR(50),
      payload JSONB, ip_address VARCHAR(45), status VARCHAR(20) DEFAULT 'success',
      error_message TEXT, created_at TIMESTAMP DEFAULT NOW()
    )`);

    const xmlFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xml'));
    if (xmlFiles.length === 0) {
      console.log('No XML files found. Run "npm run convert-xlsx" first.');
      process.exit(0);
    }

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true, trimValues: true });

    for (const xmlFile of xmlFiles) {
      console.log(`Processing ${xmlFile}...`);
      const xml = fs.readFileSync(path.join(DATA_DIR, xmlFile), 'utf-8');
      const parsed = parser.parse(xml);
      if (!parsed.database?.table) { console.warn(`  Skipping ${xmlFile}`); continue; }

      const tables = Array.isArray(parsed.database.table) ? parsed.database.table : [parsed.database.table];

      for (const table of tables) {
        const tableName = table.name;
        const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column];
        const colNames = columns.map(c => c.name);

        console.log(`  Creating "${tableName}" (${columns.length} columns)...`);
        await pool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);

        const colDefs = columns.map(col => `"${col.name}" TEXT`);
        await pool.query(`CREATE TABLE "${tableName}" (
          id SERIAL PRIMARY KEY, ${colDefs.join(', ')},
          created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
        )`);

        await pool.query(`INSERT INTO _meta_tables (table_name, display_name, columns)
          VALUES ($1, $2, $3) ON CONFLICT (table_name) DO UPDATE SET columns = $3, updated_at = NOW()`,
          [tableName, table.display_name || tableName, JSON.stringify(columns)]);

        if (table.rows?.row) {
          const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row];
          console.log(`  Inserting ${rows.length} rows...`);
          let inserted = 0;

          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              for (const row of batch) {
                const values = colNames.map(col => row[col] !== undefined && row[col] !== '' ? row[col] : null);
                const ph = values.map((_, j) => `$${j + 1}`);
                await client.query(`INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${ph.join(', ')})`, values);
                inserted++;
              }
              await client.query('COMMIT');
            } catch (err) {
              await client.query('ROLLBACK');
              console.error(`  Error at row ${i}:`, err.message);
            } finally { client.release(); }
            if (inserted % 1000 === 0) console.log(`  ... ${inserted} rows`);
          }
          console.log(`  Done: ${inserted} rows in "${tableName}"`);
        }
      }
    }
    console.log('\nSeed complete!');
  } finally { await pool.end(); }
}

seed();

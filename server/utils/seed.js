/**
 * Seeds the database from the XML file in /data directory.
 * Usage: node server/utils/seed.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const DATA_DIR = path.join(__dirname, '../../data');

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:894291802448b50603a3ca64f5f43f01@localhost:5432/bancodedadospioli'
  });

  try {
    // Initialize meta tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _meta_tables (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        description TEXT,
        columns JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS _webhook_logs (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255),
        action VARCHAR(50),
        payload JSONB,
        ip_address VARCHAR(45),
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Find all XML files in data directory
    const xmlFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xml'));
    if (xmlFiles.length === 0) {
      console.log('No XML files found in /data directory. Run "npm run convert-xlsx" first.');
      process.exit(0);
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true
    });

    for (const xmlFile of xmlFiles) {
      console.log(`Processing ${xmlFile}...`);
      const xml = fs.readFileSync(path.join(DATA_DIR, xmlFile), 'utf-8');
      const parsed = parser.parse(xml);

      const database = parsed.database;
      if (!database || !database.table) {
        console.warn(`  Skipping ${xmlFile}: invalid format`);
        continue;
      }

      const tables = Array.isArray(database.table) ? database.table : [database.table];

      for (const table of tables) {
        const tableName = table.name;
        const columns = Array.isArray(table.columns.column) ? table.columns.column : [table.columns.column];
        const colNames = columns.map(c => c.name);

        console.log(`  Creating table "${tableName}" with ${columns.length} columns...`);

        // Drop and recreate
        await pool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);

        const colDefs = columns.map(col => {
          const pgType = col.type === 'integer' ? 'INTEGER' :
                         col.type === 'number' ? 'NUMERIC' :
                         col.type === 'boolean' ? 'BOOLEAN' :
                         col.type === 'date' ? 'DATE' :
                         col.type === 'datetime' ? 'TIMESTAMP' : 'TEXT';
          return `"${col.name}" ${pgType}`;
        });

        await pool.query(`
          CREATE TABLE "${tableName}" (
            id SERIAL PRIMARY KEY,
            ${colDefs.join(',\n            ')},
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

        // Insert data in batches
        if (table.rows && table.rows.row) {
          const rows = Array.isArray(table.rows.row) ? table.rows.row : [table.rows.row];
          console.log(`  Inserting ${rows.length} rows...`);

          let inserted = 0;
          const BATCH_SIZE = 100;

          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const client = await pool.connect();

            try {
              await client.query('BEGIN');
              for (const row of batch) {
                const values = colNames.map(col => {
                  const val = row[col];
                  return val !== undefined && val !== '' ? val : null;
                });
                const placeholders = values.map((_, j) => `$${j + 1}`);
                await client.query(
                  `INSERT INTO "${tableName}" (${colNames.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
                  values
                );
                inserted++;
              }
              await client.query('COMMIT');
            } catch (err) {
              await client.query('ROLLBACK');
              console.error(`  Error inserting batch at row ${i}:`, err.message);
            } finally {
              client.release();
            }

            if (inserted % 1000 === 0) console.log(`  ... ${inserted} rows inserted`);
          }

          console.log(`  Done: ${inserted} rows inserted into "${tableName}"`);
        }
      }
    }

    console.log('\nSeed complete!');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await pool.end();
  }
}

seed();
